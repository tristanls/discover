/*

find.js - discover.find(nodeId, callback) test

The MIT License (MIT)

Copyright (c) 2013-2014 Tristan Slominski

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

var expectDone = function expectDone(test, expected) {
    return function () {
        if (--expected == 0) {
            test.done();
        }
    };
};

test['find() calls callback with an error if no registered nodes and no seeds'] = function (test) {
    test.expect(3);
    var fooBase64 = new Buffer("foo").toString("base64");
    var transport = new events.EventEmitter();
    var discover = new Discover({transport: transport});

    var done = expectDone(test, 2);

    discover.on('stats.timers.find.ms', function (latency) {
        test.ok(true);
        done();
    });
    discover.on('stats.timers.find.request.ms', function (latency) {
        test.ok(false, 'stats.timers.find.request.ms should not be emitted');
    });
    discover.on('stats.timers.find.round.ms', function (latency) {
        test.ok(false, 'stats.timers.find.round.ms should not be emitted');
    });

    discover.find(fooBase64, function (error, contact) {
        test.ok(error instanceof Error);
        test.ok(!contact);
        done();
    });
};

test['find() calls callback with an error if no registered nodes and seeds are unreachable'] = function (test) {
    test.expect(7);
    var fooBase64 = new Buffer("foo").toString("base64");
    var transport = new events.EventEmitter();
    transport.findNode = function (contact, nodeId, sender) {
        process.nextTick(function () {
            transport.emit('node', new Error('unreachable'), contact, nodeId);
        });
    };
    var discover = new Discover({
        seeds: [
            {id: "foo", transport: {host: '127.0.0.1', port: 6742}},
            {id: "bar", transport: {host: '127.0.0.1', port: 6743}},
            {id: "baz", transport: {host: '127.0.0.1', port: 6744}}
        ],
        transport: transport
    });

    var done = expectDone(test, 6);

    discover.on('stats.timers.find.ms', function (latency) {
        test.ok(true);
        done();
    });
    discover.on('stats.timers.find.request.ms', function (latency) {
        test.ok(true);
        done();
    });
    discover.on('stats.timers.find.round.ms', function (latency) {
        test.ok(true);
        done();
    });

    discover.find(fooBase64, function (error, contact) {
        test.ok(error instanceof Error);
        test.ok(!contact);
        done();
    });    
};

test['find() calls transport.findNode() on the seeds if no registered nodes'] = function (test) {
    test.expect(6);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var seeds = [
        {id: bazBase64, transport: {host: '127.0.0.1', port: 6744}},
        {id: barBase64, transport: {host: '127.0.0.1', port: 6743}}
    ];
    var transport = new events.EventEmitter();
    var first = true;

    transport.findNode = function (contact, nodeId, sender) {
        if (first) {
            first = false;
            test.equal(contact.id, seeds[0].id);
            test.equal(contact.transport.host, seeds[0].transport.host);
            test.equal(contact.transport.port, seeds[0].transport.port);
        } else {
            test.equal(contact.id, seeds[1].id);
            test.equal(contact.transport.host, seeds[1].transport.host);
            test.equal(contact.transport.port, seeds[1].transport.port);
            test.done();
        }
    };
    var discover = new Discover({seeds: seeds, transport: transport});

    // we never emit 'node' event on transport, so no stats will be unavailable
    discover.on('stats.timers.find.ms', function (latency) {
        test.ok(false, 'stats.timers.find.ms should not be called');
    });
    discover.on('stats.timers.find.request.ms', function (latency) {
        test.ok(false, 'stats.timers.find.request.ms should not be called');
    });
    discover.on('stats.timers.find.round.ms', function (latency) {
        test.ok(false, 'stats.timers.find.round.ms should not be called');
    });

    discover.find(fooBase64, function (error, contact) {});
};

test['find() returns found node if found node while contacting a seed on first round'] = function (test) {
    test.expect(6);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var seeds = [
        {id: bazBase64, transport: {host: '127.0.0.1', port: 6744}},
        {id: barBase64, transport: {host: '127.0.0.1', port: 6743}}
    ];
    var transport = new events.EventEmitter();
    transport.findNode = function (contact, nodeId, sender) {
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

    var done = expectDone(test, 5);

    discover.on('stats.timers.find.ms', function (latency) {
        test.ok(true);
        done();
    });
    discover.on('stats.timers.find.request.ms', function (latency) {
        test.ok(true);
        done();
    });
    discover.on('stats.timers.find.round.ms', function (latency) {
        test.ok(true);
        done();
    });

    discover.find(fooBase64, function (error, contact) {
        test.equal(contact.id, fooBase64);
        test.deepEqual(contact.data, {foo: 'bar'});
        done();
    });
};

test['find() queries closest nodes if not found on first round by querying seed nodes'] = function (test) {
    test.expect(7);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var fopBase64 = new Buffer("fop").toString("base64");
    var seeds = [
        {id: bazBase64, transport: {host: '127.0.0.1', port: 6744}},
        {id: barBase64, transport: {host: '127.0.0.1', port: 6743}}
    ];
    var transport = new events.EventEmitter();
    transport.findNode = function (contact, nodeId, sender) {
        if (contact.id == seeds[1].id) {
            process.nextTick(function () {
                transport.emit('node', null, contact, nodeId, [{
                    id: fopBase64, transport: {host: '192.168.0.1', port: 5553}
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

    var done = expectDone(test, 6);

    discover.on('stats.timers.find.ms', function (latency) {
        test.ok(true); // 1
        done();
    });
    discover.on('stats.timers.find.request.ms', function (latency) {
        test.ok(true); // 3
        done();
    });
    discover.on('stats.timers.find.round.ms', function (latency) {
        test.ok(true); // 2
        done();
    });

    discover.find(fooBase64, function (error, contact) {
        test.equal(contact.id, fooBase64);
        test.deepEqual(contact.data, {foo: 'bar'});
        done();
    });
};

test['find() queries nodes from closest kBucket of a registered node'] = function (test) {
    test.expect(14);
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
    transport.setTransportInfo = function (contact) {
        return contact;
    };    
    transport.findNode = function (contact, nodeId, sender) {
        if (contact.id == bazBase64) {
            process.nextTick(function () {
                transport.emit('node', null, contact, nodeId, [{
                    id: fopBase64, transport: {host: '192.168.0.1', port: 5553}
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
                    transport: {
                        host: '192.168.0.2',
                        port: 5554
                    }
                });
            });       
        } else {
            transport.emit('node', new Error("unreachable"), contact, nodeId);
        }
    };
    var seeds = [{id: bazBase64, transport: {host: '192.168.0.2', port: 5554}}];
    var discover = new Discover({
        // inlineTrace: true, 
        seeds: seeds, 
        transport: transport
    });

    var done = expectDone(test, 9);

    discover.on('stats.timers.find.ms', function (latency) {
        test.ok(true); // find baz, find foo = 2
        done();
    });
    discover.on('stats.timers.find.request.ms', function (latency) {
        test.ok(true); // find baz, find foo, find fop = 3
        done();
    });
    discover.on('stats.timers.find.round.ms', function (latency) {
        test.ok(true); // find baz, find foo, find fop = 3
        done();
    });

    discover.register({id: barBase64}); // creates kBucket with "bar" node id
    discover.find(bazBase64, function (error, contact) {
        test.ok(!error, error);
        // make sure our testing setup is proceeding correctly
        test.equal(contact.id, bazBase64);
        test.equal(contact.transport.host, '192.168.0.2');
        test.equal(contact.transport.port, 5554);
        // "baz" node should now be present in "bar" kBucket
        discover.find(fooBase64, function (error, contact) {
            // should select "bar" kBucket
            // should find closest node "baz"
            // should query "baz" and get back "fop"
            // should queyr "fop" and get back "foo"
            test.equal(contact.id, fooBase64);
            test.deepEqual(contact.data, {foo: 'bar'});
            done();
        });
    });
};

test['find() returns local node without querying the network'] = function (test) {
    test.expect(4);
    var fooBase64 = new Buffer("foo").toString("base64");    
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({transport: transport});

    discover.register({id: fooBase64, data: 'my data'});

    var done = expectDone(test, 2);

    discover.on('stats.timers.find.ms', function (latency) {
        test.ok(true); // 1
        done();
    });
    discover.on('stats.timers.find.request.ms', function (latency) {
        test.ok(false, 'stats.timers.find.request.ms should not be called');
    });
    discover.on('stats.timers.find.round.ms', function (latency) {
        test.ok(false, 'stats.timers.find.round.ms should not be called');
    });

    discover.find(fooBase64, function (error, contact) {
        test.ok(!error, error);
        test.equal(contact.id, fooBase64);
        test.equal(contact.data, 'my data');
        done();
    });
};

test['find() returns local kBucket data on node without querying the network'] = function (test) {
    test.expect(3);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };    
    transport.findNode = function () {
        test.fail("queried the network via transport.findNode()");
    };
    var discover = new Discover({transport: transport});
    discover.register({id: fooBase64, data: 'my data'});
    transport.emit('reached', {id: barBase64, data: 'bar data'});

    var done = expectDone(test, 2);

    discover.on('stats.timers.find.ms', function (latency) {
        test.ok(true); // 1
        done();
    });
    discover.on('stats.timers.find.request.ms', function (latency) {
        test.ok(false, 'stats.timers.find.request.ms should not be called');
    });
    discover.on('stats.timers.find.round.ms', function (latency) {
        test.ok(false, 'stats.timers.find.round.ms should not be called');
    });

    discover.find(barBase64, function (error, contact) {
        test.ok(!error, error);
        test.deepEqual(contact, {id: barBase64, data: 'bar data'});
        done();
    });
};
