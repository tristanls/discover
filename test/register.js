/*

register.js - discover.register(nodeId, vectorClock) test

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

test['register() creates a new kBucket from randomly generated contact.id'] = function (test) {
    test.expect(3);
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    transport.findNode = function (contact, nodeId) {};
    var discover = new Discover({transport: transport});
    var contact = discover.register({data: 'foo'});
    test.ok(contact.id);
    test.equal(contact.vectorClock, 0);
    // TODO: doing this check is a design smell.. why am I reaching in here?
    test.equal(Object.keys(discover.kBuckets).length, 1);
    test.done();
};

test["register() registers 'ping' listener on newly created kBucket"] = function (test) {
    test.expect(3);
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    transport.findNode = function (contact, nodeId) {};
    var discover = new Discover({transport: transport});
    var contact = discover.register({data: 'foo'});
    test.ok(contact.id);
    var kBucket = discover.kBuckets[contact.id].kBucket;
    test.ok(kBucket);
    test.equal(kBucket.listeners('ping').length, 1);
    test.done();
};

test['register() stores registered contact info (enriched with transport info) with newly created kBucket'] = function (test) {
    test.expect(2);
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        test.ok(true);
        contact.transport = {host: 'foo.com', port: 8888};
        return contact;
    };
    transport.findNode = function () {};
    var discover = new Discover({transport: transport});
    var contact = discover.register({data: {foo: 'bar'}});
    test.deepEqual(discover.kBuckets[contact.id].contact, contact);
    test.done();
};

test['register() does not re-create an existing kBucket'] = function (test) {
    test.expect(1);
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    transport.findNode = function (contact, nodeId) {};
    var discover = new Discover({transport: transport});
    var contact = discover.register({data: 'foo'});
    // TODO: doing this check is a design smell.. why am I reaching in here?
    var originalKBucketReference = discover.kBuckets[contact.id];
    discover.register(contact);
    test.ok(originalKBucketReference === discover.kBuckets[contact.id]);
    test.done();
};

test['register() updates previous contact info when re-registering'] = function (test) {
    test.expect(1);
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    transport.findNode = function () {};
    var discover = new Discover({transport: transport});
    var contact = discover.register({data: {foo: 'bar'}});
    contact.data = 'something else';
    discover.register(contact);
    test.deepEqual(discover.kBuckets[contact.id].contact, contact);
    test.done();
};

test['register() calls transport.findNode() on the seeds if there are no ' +
    'previously registered nodes'] = function (test) {
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
    transport.setTransportInfo = function (contact) {
        return contact;
    };
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
    discover.register({id: fooBase64, data: 'foo'});
};

test['register() arbiters local contact info with remote contact if found'] = function (test) {
    test.expect(9);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var seeds = [
        {id: bazBase64, ip: '127.0.0.1', port: 6744},
        {id: barBase64, ip: '127.0.0.1', port: 6743}
    ];
    var transport = new events.EventEmitter();
    var first = true;
    transport.setTransportInfo = function (contact) {
        return contact;
    };
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
            transport.emit('node', null, {id: fooBase64, data: "updated"});
        }
    };
    var discover = new Discover({seeds: seeds, transport: transport});
    discover.register({id: fooBase64, data: 'foo'});
    discover.find(fooBase64, function (error, contact) {
        test.ok(!error);
        test.equal(contact.id, fooBase64);
        test.equal(contact.data, "updated");
        test.done();
    });
};

test['register() queries closest nodes if not found on first round by querying' +
    ' seed nodes'] = function (test) {
    test.expect(1);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var fopBase64 = new Buffer("fop").toString("base64");
    var seeds = [
        {id: bazBase64, ip: '127.0.0.1', port: 6744},
        {id: barBase64, ip: '127.0.0.1', port: 6743}
    ];
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
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
                test.ok(true); // assert being here
                test.done();
            });
        } else {
            transport.emit('node', new Error("unreachable"), contact, nodeId);
        }
    };
    var discover = new Discover({seeds: seeds, transport: transport});
    discover.register({id: fooBase64, data: 'foo'});
};