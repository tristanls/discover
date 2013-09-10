/*

index.js - "discover": Node discovery based on Kademlia DHT protocol

The MIT License (MIT)

Copyright (c) 2013 Tristan Slominski

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

*/
"use strict";

var clone = require('clone'),
    crypto = require('crypto'),
    events = require('events'),
    KBucket = require('k-bucket'),
    TcpTransport = require('discover-tcp-transport'),
    util = require('util');

var Discover = module.exports = function Discover (options) {
    var self = this;
    options = options || {};

    self.CONCURRENCY_CONSTANT = options.CONCURRENCY_CONSTANT || 3;
    self.seeds = options.seeds || [];
    // configure tracing for debugging purposes
    // TODO: probably change this to some sort of sane logging
    if (options.eventTrace && options.inlineTrace) {
        self.trace = function (message) {
            console.log('~trace', message);
            self.emit('~trace', message);
        };
    } else if (options.eventTrace) {
        self.trace = function (message) {
            self.emit('~trace', message);
        };
    } else if (options.inlineTrace) {
        self.trace = function (message) {
            console.log('~trace', message);
        };
    } else {
        self.trace = function () {};
    }
    self.trace('tracing is enabled');

    self.transport = options.transport;
    if (!self.transport) {
        var TcpTransport = require('discover-tcp-transport');
        self.transport = new TcpTransport(options);
    }

    // register a listener to update our k-buckets with nodes that we manage 
    // contact with
    self.transport.on('node', function (error, contact, nodeId, response) {
        if (error) return; // failed contact

        if (Object.keys(self.kBuckets).length == 0) return; // no k-buckets to update

        // we successfully contacted the "contact", add it
        // we pick the closest kBucket to the node id of our contact to store
        // the data in, since they have the most space to accomodate near-by
        // node ids (inherent KBucket property)
        // TODO: change self.kBuckets data structure so that this operation is
        //       O(log n) instead of O(n)
        var closestKBuckets = [];
        var contactIdBuffer = new Buffer(contact.id, "base64");
        Object.keys(self.kBuckets).forEach(function (kBucketKey) {
            var kBucket = self.kBuckets[kBucketKey];
            var kBucketIdBuffer = new Buffer(kBucket.id, "base64");
            closestKBuckets.push({
                id: kBucket.id,
                distance: KBucket.distance(contactIdBuffer, kBucketIdBuffer)
            });
        });

        closestKBuckets = closestKBuckets.sort(function (a, b) {
            return a.distance - b.distance;
        });

        var closestKBucketId = closestKBuckets[0].id;
        var closestKBucket = self.kBuckets[closestKBucketId].kBucket;
        var clonedContact = clone(contact);
        self.trace('adding ' + util.inspect(clonedContact) + ' to kBucket ' + closestKBucketId);
        clonedContact.id = contactIdBuffer;
        closestKBucket.add(clonedContact);
    });

    self.kBuckets = {};
};

util.inherits(Discover, events.EventEmitter);

// query: Object *required* object containing query state for this request
//   nodeId: String (base64) *required* Base64 encoded node id to find
//   nodes: Array *required* nodes to query for nodeId arranged from closest to
//          furthest
//     node: 
//       id: String (base64) *required* Base64 encoded contact id
//   nodesMap: Object *required* Map to nodes present in `nodes`
// callback: Function *required* callback to call with result
Discover.prototype.executeQuery = function executeQuery (query, callback) {
    var self = this;

    if (query.done) return; // query already successfully completed

    // if we have no nodes, we can't query anything
    if (!query.nodes || query.nodes.length == 0) {
        return callback( new Error("No known nodes to query"));
    }

    if (query.index === undefined) query.index = 0;
    if (query.closest === undefined) query.closest = query.nodes[0];
    if (query.ongoingRequests === undefined) query.ongoingRequests = 0;
    if (query.newNodes === undefined) query.newNodes = [];

    // we listen for `node` events that contain the nodeId we asked for
    // this helps to decouple discover from the transport and allows us to
    // benefit from other ongoing queries (TODO: "prove" this)
    // 
    // because executeQuery can be called multiple times on the same query,
    // we keep the state
    if (!query.listener) {
        // TODO: maybe there is an opportunity here to generate events
        // uniquely named by "nodeId" so I don't have to have tons of listeners
        // listen to everything and throw away what they don't want?
        query.listener = function (error, contact, nodeId, response) {
            // filter other queries
            if (nodeId != query.nodeId) return;

            if (query.done) return; // query already successfully completed

            // request has been handled
            // TODO: what happens if two requests for the same nodeId are
            //       happening at the same time?
            // maybe do a check prior to executeQuery to not duplicate searches
            // for the same nodeId across the network?
            query.ongoingRequests--;

            if (error) {
                self.trace('error response from ' + util.inspect(contact) + 
                    ' looking for ' + nodeId + ': ' + util.inspect(error));
                var contactRecord = query.nodesMap[contact.id];
    
                if (!contactRecord) return;

                if (contactRecord.kBucket) {
                    // we have a kBucket to report unreachability to
                    // remove from kBucket
                    contactRecord.kBucket.remove({
                        id: new Buffer(contactRecord.id, 'base64'),
                        vectorClock: contactRecord.vectorClock
                    });
                }
                
                contactRecord.contacted = true;

                // console.log("NODE EVENT HANDLER");
                // console.dir(query);

                // initiate next request if there are still queries to be made
                if (query.index < query.nodes.length
                    && query.ongoingRequests < self.CONCURRENCY_CONSTANT) {
                    process.nextTick(function () {
                        self.executeQuery(query, callback);
                    });
                } else {
                    self.queryCompletionCheck(query, callback);
                }
                return; // handled error
            }

            // we have a response, it could be an Object or Array

            self.trace('response from ' + util.inspect(contact) + 
                ' looking for ' + nodeId + ': ' + util.inspect(response));
            if (Array.isArray(response)) {
                // add the closest contacts to new nodes
                query.newNodes = query.newNodes.concat(response);

                // TODO: same code inside error handler
                // initiate next request if there are still queries to be made
                if (query.index < query.nodes.length
                    && query.ongoingRequests < self.CONCURRENCY_CONSTANT) {
                    process.nextTick(function () {
                        self.executeQuery(query, callback);
                    });
                } else {
                    self.queryCompletionCheck(query, callback);
                }
                return;
            }

            // we have a response Object, found the contact! return it and stop
            // the querying
            callback(null, response);
            query.done = true;
            self.transport.removeListener('node', query.listener);
            return;
        };
        self.transport.on('node', query.listener);
    }

    for (query.index = query.index || 0; 
        query.index < query.nodes.length
            && query.ongoingRequests < self.CONCURRENCY_CONSTANT; 
        query.index++) {

        query.ongoingRequests++;
        self.transport.findNode(query.nodes[query.index], query.nodeId);
    }

    // console.log("INSIDE EXECUTE QUERY");
    // console.dir(query);
    self.queryCompletionCheck(query, callback);
};

// nodeId: String (base64) *required* Base64 encoded node id to find
// callback: Function *required* callback to call with result
// announce: Boolean if set to true, can't answer with local result, the
//           purpose of this flag is for announcing contact's existence
//           to the network 
Discover.prototype.find = function find (nodeId, callback, announce) {
    var self = this;
    var traceHeader = "find(" + nodeId + "): ";

    // see if we have a local match, and return it if not announcing
    if (!announce && self.kBuckets[nodeId]) {
        return callback(null, self.kBuckets[nodeId].contact);
    }

    // if we have no kBuckets, that means we haven't registered any nodes yet
    // the only nodes we are aware of are the seed nodes
    if (Object.keys(self.kBuckets).length == 0) {
        self.trace(traceHeader + 'no kBuckets, delegating to findViaSeeds()');
        return self.findViaSeeds(nodeId, callback);
    }

    var closestKBuckets = [];
    var nodeIdBuffer = new Buffer(nodeId, "base64");
    Object.keys(self.kBuckets).forEach(function (kBucketKey) {
        var kBucket = self.kBuckets[kBucketKey];
        var kBucketIdBuffer = new Buffer(kBucket.id, "base64");
        closestKBuckets.push({
            id: kBucket.id,
            distance: KBucket.distance(nodeIdBuffer, kBucketIdBuffer)
        });
    });

    closestKBuckets = closestKBuckets.sort(function (a, b) {
        return a.distance - b.distance;
    });

    self.trace(traceHeader + 'have ' + closestKBuckets.length + ' kBuckets');

    // we pick the closest kBucket to chose nodes from as it will have the
    // most information about nodes closest to nodeId, if closest kBucket has
    // no nodes, we pick the next one, until we find a kBucket with nodes in it
    // or reach the end
    var closestContacts = [];
    var closestKBucketsIndex = 0;
    while (closestContacts.length == 0 
            && closestKBucketsIndex < closestKBuckets.length) {
        var closestKBucketId = closestKBuckets[closestKBucketsIndex].id;
        var closestKBucket = self.kBuckets[closestKBucketId].kBucket;
        // get three closest nodes
        closestContacts = closestKBucket.closest(
            {id: new Buffer(nodeId, "base64")}, 3);
        closestKBucketsIndex++;
    }

    // if none of our local kBuckets have any contacts (should only happend
    // when bootstrapping), talk to the seeds
    if (closestContacts.length == 0) {
        self.trace(traceHeader + 'no contacts in kBuckets, delegating to findViaSeeds()');
        return self.findViaSeeds(nodeId, callback);
    }

    // closestContacts will contain contacts with id as a Buffer, we clone
    // the contacts so that we can have id be a base64 encoded String
    var closestNodes = [];
    var nodesMap = {};
    closestContacts.forEach(function (contact) {
        var clonedContact = clone(contact);
        clonedContact.id = clonedContact.id.toString("base64");
        clonedContact.kBucket = closestKBucket; // for reference later
        closestNodes.push(clonedContact);
        nodesMap[clonedContact.id] = clonedContact;
    });

    var query = {
        nodeId: nodeId,
        nodes: closestNodes,
        nodesMap: nodesMap
    };
    self.executeQuery(query, callback);
};

// nodeId: String (base64) *required* Base64 encoded node id to find
// callback: Function *required* callback to call with result
Discover.prototype.findViaSeeds = function findViaSeeds (nodeId, callback) {
    var self = this;
    var traceHeader = "findViaSeeds(" + nodeId + "): ";

    // if we have no seeds, that means we don't know of any other nodes to query
    if (!self.seeds || self.seeds.length == 0) {
        self.trace(traceHeader + 'No known seeds to query');
        return callback(new Error("No known seeds to query"));
    }

    var closestNodes = [];
    var nodesMap = {};
    var nodeIdBuffer = new Buffer(nodeId, "base64");
    self.seeds.forEach(function (seed) {
        var seedIdBuffer = new Buffer(seed.id, "base64");
        var clonedSeed = clone(seed);
        clonedSeed.distance = KBucket.distance(nodeIdBuffer, seedIdBuffer);
        closestNodes.push(clonedSeed);
        nodesMap[clonedSeed.id] = clonedSeed;
    });

    closestNodes = closestNodes.sort(function (a, b) {
        return a.distance - b.distance;
    });

    // distances are now sorted, closest being first
    // TODO: probably refactor Query object to be it's own thing
    var query = {
        nodeId: nodeId,
        nodes: closestNodes,
        nodesMap: nodesMap
    };
    self.executeQuery(query, callback);
};

// query: Object *required* object containing query state for this request
//   nodeId: String (base64) *required* Base64 encoded node id to find
//   nodes: Array *required* nodes to query for nodeId arranged from closest to
//          furthest
//     node: 
//       id: String (base64) *required* Base64 encoded contact id
//   nodesMap: Object *required* Map to nodes present in `nodes`
// callback: Function *required* callback to call with result
Discover.prototype.queryCompletionCheck = function queryCompletionCheck (query, callback) {
    var self = this;
    // console.log("QUERY COMPLETION CHECK");
    // are we done?
    if (query.index == query.nodes.length
        && query.ongoingRequests == 0 && !query.done) {
        // find out if any new nodes are closer than the closest
        // node in order to determine if we should keep going or
        // stop
        
        // console.log('sorting new nodes');
        // sort the new nodes according to distance
        var newNodes = [];
        var nodeIdBuffer = new Buffer(query.nodeId, "base64");
        query.newNodes.forEach(function (newNode) {
            var clonedNewNode = clone(newNode);
            var newNodeIdBuffer = new Buffer(newNode.id, "base64");
            clonedNewNode.distance = 
                KBucket.distance(nodeIdBuffer, newNodeIdBuffer);
            // only add nodes that are closer to short circuit the
            // computation
            if (clonedNewNode.distance < query.closest.distance) {
                newNodes.push(clonedNewNode);
            }
        });

        // console.log('sorted new nodes');

        // if we don't have any closer nodes, we didn't find
        // what we are looking for
        if (newNodes.length == 0) {
            // we are done done
            self.transport.removeListener('node', query.listener);

            // console.log('listener removed');
            // console.dir(query);
            // sanity check, just in case closest node is the one
            // we are looking for and wasn't short-circuited
            // somewhere else
            if (query.closest.id == query.nodeId) {
                // console.log("returning closest node", query.closest);
                return callback(null, query.closest);
            } else {
                // console.log("returning not found error");
                return callback(new Error("not found"));
            }
        }

        // console.log("found closer nodes", newNodes);

        // found closer node, sort according to length
        newNodes = newNodes.sort(function (a, b) {
            return a.distance - b.distance;
        });

        // update query state and go another round
        query.index = 0;
        query.ongoingRequests = 0;
        query.nodes = newNodes; // these are sorted with distance (unlike query.newNodes)
        query.closest = query.nodes[0];
        query.newNodes = [];
        
        return process.nextTick(function () {
            self.executeQuery(query, callback);
        });
    } // are we done?
    // console.log("FAILED QUERY COMPLETION CHECK >>> KEEP GOING");
};

// contact: Object *required*
//   id: String (base64) base64 encoded node id
//   data: Any data to include with contact
//   vectorClock: Integer 
Discover.prototype.register = function register (contact) {
    var self = this;
    contact = contact || {};
    contact = clone(contact); // separate references from outside
    
    if (!contact.id) contact.id = crypto.createHash('sha1').digest('base64');
    if (!contact.vectorClock) contact.vectorClock = 0;

    if (!self.kBuckets[contact.id]) {
        var kBucket = new KBucket({localNodeId: contact.id});
        self.kBuckets[contact.id] = {
            contact: contact,
            id: contact.id,
            kBucket: kBucket
        };
    } else {
        self.kBuckets[contact.id].contact = contact;
    }

    // issuing find(contact.id) against own contact.id, populates the DHT
    // with contact
    self.find(contact.id, function () {}, true /*announce*/);

    return clone(contact); // don't leak internal implementation
};

Discover.prototype.unregister = function unregister (contact) {
    var self = this;
    var kBucket = self.kBuckets[contact.id];
    if (kBucket) {
        // vectorClock check
        if (kBucket.contact.vectorClock && contact.vectorClock
            && kBucket.contact.vectorClock > contact.vectorClock) {
            return;
        }   
        delete self.kBuckets[contact.id];
    }

    // current implemenation deletes all that "closest" contact information
    // that was gathered in the unregistering kBucket

    // TODO: elaborate the implementation to distribute known nodes in this
    //       kBucket to ones that aren't being deleted
};