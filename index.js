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
    KBucket = require('k-bucket'),
    TcpTransport = require('discover-tcp-transport');

var Discover = module.exports = function Discover (options) {
    var self = this;
    options = options || {};

    self.CONCURRENCY_CONSTANT = options.CONCURRENCY_CONSTANT || 3;
    self.seeds = options.seeds || [];
    self.transport = options.transport;
    if (!self.transport) {
        var TcpTransport = require('discover-tcp-transport');
        self.transport = new TcpTransport(options);
    }

    self.kBuckets = {};
};

// query: Object *required* object containing query state for this request
//   nodeId: String (base64) *required* Base64 encoded node id to find
//   nodes: Array *required* nodes to query for nodeId arranged from closest to
//          furthest
//     node: 
//       id: String (base64) *required* Base64 encoded contact id
// callback: Function *required* callback to call with result
Discover.prototype.executeQuery = function executeQuery (query, callback) {
    var self = this;

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

            // request has been handled
            // TODO: what happens if two requests for the same nodeId are
            //       happening at the same time?
            // maybe do a check prior to executeQuery to not duplicate searches
            // for the same nodeId across the network?
            query.ongoingRequests--;

            if (error) {
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

            // TODO: process response
            console.log("NO ERROR... TODO");
            // console.log(error, contact, nodeId, response);
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

Discover.prototype.find = function find (nodeId, callback) {
    var self = this;

    // if we have no kBuckets, that means we haven't registered any nodes yet
    // the only nodes we are aware of are the seed nodes
    if (Object.keys(self.kBuckets).length == 0) {
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

    // we pick the closest kBucket to chose nodes from as it will have the
    // most information about nodes closest to nodeId
    var closestKBucket = self.kBuckets[closestKBuckets[0].id].kBucket;
    // get three closest nodes
    var closestContacts = closestKBucket.closest(
        {id: new Buffer(closestKBucket.id, "base64")}, 3);

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

    // if we have no seeds, that means we don't know of any other nodes to query
    if (!self.seeds || self.seeds.length == 0) {
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
// callback: Function *required* callback to call with result
Discover.prototype.queryCompletionCheck = function queryCompletionCheck (query, callback) {
    var self = this;
    // console.log("QUERY COMPLETION CHECK");
    // are we done?
    if (query.index == query.nodes.length
        && query.ongoingRequests == 0) {
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
        query.nodes = newNodes;
        query.closest = query.nodes[0];
        
        return process.nextTick(function () {
            self.executeQuery(query, callback);
        });
    } // are we done?
    // console.log("FAILED QUERY COMPLETION CHECK >>> KEEP GOING");
};

Discover.prototype.register = function register (nodeId, vectorClock) {
    var self = this;
    // there is no bootstrap procedure.. register does it! (I think)
};

Discover.prototype.unregister = function unregister (nodeId) {
    var self = this;
};