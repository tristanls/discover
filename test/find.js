/*

find.js - discover.find(nodeId, callback) test

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

var events = require('events'),
    Discover = require('../index.js');

var test = module.exports = {};

test['find() calls callback with an error if no registered nodes and no seeds'] = function (test) {
    test.expect(2);
    var fooBase64 = new Buffer("foo").toString("base64");
    var transport = new events.EventEmitter();
    var discover = new Discover({transport: transport});
    discover.find(fooBase64, function (error, contact) {
        test.ok(error instanceof Error);
        test.ok(!contact);
        test.done();
    });
};

test['find() calls callback with an error if no registered nodes and seeds are unreachable'] = function (test) {
    test.expect(2);
    var fooBase64 = new Buffer("foo").toString("base64");
    var transport = new events.EventEmitter();
    transport.findNode = function (contact, nodeId) {
        process.nextTick(function () {
            transport.emit('node', new Error('unreachable'), contact, nodeId);
        });
    };
    var discover = new Discover({
        seeds: [
            {id: "foo", ip: '127.0.0.1', port: 6742},
            {id: "bar", ip: '127.0.0.1', port: 6743},
            {id: "baz", ip: '127.0.0.1', port: 6744}
        ],
        transport: transport
    });
    discover.find(fooBase64, function (error, contact) {
        test.ok(error instanceof Error);
        test.ok(!contact);
        test.done();
    });    
};

test['find() calls transport.findNode() on the seeds if no registered nodes'] = function (test) {
    test.expect(6);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var seeds = [
        {id: bazBase64, ip: '127.0.0.1', port: 6744},
        {id: barBase64, ip: '127.0.0.1', port: 6743}
    ];
    var transport = new events.EventEmitter();
    var first = true;
    transport.findNode = function (contact, nodeId) {
        if (first) {
            first = false;
            test.equal(contact.id, seeds[0].id);
            test.equal(contact.ip, seeds[0].ip);
            test.equal(contact.port, seeds[0].port);
        } else {
            test.equal(contact.id, seeds[1].id);
            test.equal(contact.ip, seeds[1].ip);
            test.equal(contact.port, seeds[1].port);
            test.done();
        }
    };
    var discover = new Discover({seeds: seeds, transport: transport});
    discover.find(fooBase64, function (error, contact) {});
};

test['find() returns found node if found node while contacting a seed on first round'] = function (test) {
    test.expect(2);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var seeds = [
        {id: bazBase64, ip: '127.0.0.1', port: 6744},
        {id: barBase64, ip: '127.0.0.1', port: 6743}
    ];
    var transport = new events.EventEmitter();
    transport.findNode = function (contact, nodeId) {
        if (contact.id == seeds[0].id) {
            process.nextTick(function () {
                transport.emit('node', null, contact, nodeId, {
                    id: fooBase64,
                    data: {
                        foo: 'bar'
                    }
                });
            });
        } else {
            transport.emit('node', new Error("unreachable"), contact, nodeId);
        }
    };
    var discover = new Discover({seeds: seeds, transport: transport});
    discover.find(fooBase64, function (error, contact) {
        test.equal(contact.id, fooBase64);
        test.deepEqual(contact.data, {foo: 'bar'});
        test.done();
    });
};

test['find() queries closest nodes if not found on first round by querying seed nodes'] = function (test) {
    test.expect(2);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var fopBase64 = new Buffer("fop").toString("base64");
    var seeds = [
        {id: bazBase64, ip: '127.0.0.1', port: 6744},
        {id: barBase64, ip: '127.0.0.1', port: 6743}
    ];
    var transport = new events.EventEmitter();
    transport.findNode = function (contact, nodeId) {
        if (contact.id == seeds[1].id) {
            process.nextTick(function () {
                transport.emit('node', null, contact, nodeId, [{
                    id: fopBase64, ip: '192.168.0.1', port: 5553
                }]);
            });
        } else if (contact.id == fopBase64) {
            process.nextTick(function () {
                transport.emit('node', null, contact, nodeId, {
                    id: fooBase64,
                    data: {
                        foo: 'bar'
                    }                    
                });
            });
        } else {
            transport.emit('node', new Error("unreachable"), contact, nodeId);
        }
    };
    var discover = new Discover({seeds: seeds, transport: transport});
    discover.find(fooBase64, function (error, contact) {
        test.equal(contact.id, fooBase64);
        test.deepEqual(contact.data, {foo: 'bar'});
        test.done();
    });
};

test['find() queries nodes from closest kBucket of a registered node'] = function (test) {
    test.expect(6);
    // this test has one kBucket for registered nodeId "bar"
    // within this kBucket is one node with id "baz" (closer than "bar" to "foo")
    // querying "baz" responds with closer node "fop"
    // querying "fop" responds with node "foo" which we are looking for
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var fopBase64 = new Buffer("fop").toString("base64");
    // console.log("foo", fooBase64);
    // console.log("bar", barBase64);
    // console.log("baz", bazBase64);
    // console.log("fop", fopBase64);
    var transport = new events.EventEmitter();
    transport.findNode = function (contact, nodeId) {
        if (contact.id == bazBase64) {
            process.nextTick(function () {
                transport.emit('node', null, contact, nodeId, [{
                    id: fopBase64, ip: '192.168.0.1', port: 5553
                }]);
            }); 
        } else if (contact.id == fopBase64) {
            process.nextTick(function () {
                transport.emit('node', null, contact, nodeId, {
                    id: fooBase64,
                    data: {
                        foo: 'bar'
                    }                    
                });
            });
        } else if (nodeId == bazBase64) {
            // someone is looking for bazBase64, want to respond to it
            process.nextTick(function () {
                transport.emit('node', null, contact, nodeId, {
                    id: bazBase64,
                    ip: '192.168.0.2',
                    port: 5554
                });
            });       
        } else {
            transport.emit('node', new Error("unreachable"), contact, nodeId);
        }
    };
    var seeds = [{id: bazBase64, ip: '192.168.0.2', port: 5554}];
    var discover = new Discover({
        // inlineTrace: true, 
        seeds: seeds, 
        transport: transport
    });
    discover.register({id: barBase64}); // creates kBucket with "bar" node id
    discover.find(bazBase64, function (error, contact) {
        test.ok(!error, error);
        // make sure our testing setup is proceeding correctly
        test.equal(contact.id, bazBase64);
        test.equal(contact.ip, '192.168.0.2');
        test.equal(contact.port, 5554);
        // "baz" node should now be present in "bar" kBucket
        discover.find(fooBase64, function (error, contact) {
            // should select "bar" kBucket
            // should find closest node "baz"
            // should query "baz" and get back "fop"
            // should queyr "fop" and get back "foo"
            test.equal(contact.id, fooBase64);
            test.deepEqual(contact.data, {foo: 'bar'});
            test.done();
        });
    });
};

test['find() returns local node without querying the network'] = function (test) {
    test.expect(3);
    var fooBase64 = new Buffer("foo").toString("base64");    
    var transport = new events.EventEmitter();
    var discover = new Discover({transport: transport});
    discover.register({id: fooBase64, data: 'my data'});
    discover.find(fooBase64, function (error, contact) {
        test.ok(!error, error);
        test.equal(contact.id, fooBase64);
        test.equal(contact.data, 'my data');
        test.done();
    });
};