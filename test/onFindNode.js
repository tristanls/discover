/*

onFindNode.js - transport.emit('findNode', ...) test

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

test["on 'findNode' returns the contact with id and data if node is one of registered nodes"] = function (test) {
    test.expect(2);
    var fooBase64 = new Buffer("foo").toString("base64");

    var sender = {id: fooBase64};
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({
        transport: transport
    });
    discover.register({id: fooBase64});
    transport.emit('findNode', fooBase64, sender, function (error, contact) {
        test.ok(!error);
        test.deepEqual(contact, {id: fooBase64, vectorClock: 0});
        test.done();
    });
};

test["on 'findNode' returns the contact with id and data if node is one of registered nodes and sender is undefined"] = function (test) {
    test.expect(2);
    var fooBase64 = new Buffer("foo").toString("base64");

    var sender = undefined;
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({
        transport: transport
    });
    discover.register({id: fooBase64});
    transport.emit('findNode', fooBase64, sender, function (error, contact) {
        test.ok(!error);
        test.deepEqual(contact, {id: fooBase64, vectorClock: 0});
        test.done();
    });
};

test["on 'findNode' returns the contact with id and data if node has been 'reached'"] = function (test) {
    test.expect(2);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");

    var sender = {id: fooBase64};
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    transport.findNode = function () {
        test.fail("used transport.findNode()");
    };
    var discover = new Discover({transport: transport});
    discover.register({id: fooBase64});
    transport.emit('reached', {id: barBase64});
    // "bar" should now be in "foo" kBucket
    transport.emit('findNode', barBase64, sender, function (error, contact) {
        test.ok(!error);
        test.equal(contact.id, barBase64);
        test.done();
    });
};

test["on 'findNode' returns the contact with id and data if node has been 'reached' and sender is undefined"] = function (test) {
    test.expect(2);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");

    var sender = undefined;
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    transport.findNode = function () {
        test.fail("used transport.findNode()");
    };
    var discover = new Discover({transport: transport});
    discover.register({id: fooBase64});
    transport.emit('reached', {id: barBase64});
    // "bar" should now be in "foo" kBucket
    transport.emit('findNode', barBase64, sender, function (error, contact) {
        test.ok(!error);
        test.equal(contact.id, barBase64);
        test.done();
    });
};

test["on 'findNode' returns closest nodes if node is not one of registered nodes"] = function (test) {
    test.expect(2);
    // this test has one kBucket for registered nodeId "bar"
    // within this kBucket is two nodes closer to "bar" than "foo": "bas", "baz"
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var basBase64 = new Buffer("bas").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");

    var sender = {id: fooBase64};
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({
        transport: transport
    });
    discover.register({id: fooBase64});
    transport.emit('reached', {id: basBase64});
    transport.emit('reached', {id: bazBase64});
    // "bas" and "baz" should now be in "foo" kBucket
    transport.emit('findNode', barBase64, sender, function (error, contacts) {
        test.ok(!error);
        test.deepEqual(contacts, [{id: basBase64}, {id: bazBase64}]);
        test.done();
    });
};

test["on 'findNode' returns closest nodes if node is not one of registered nodes and sender is undefined"] = function (test) {
    test.expect(2);
    // this test has one kBucket for registered nodeId "bar"
    // within this kBucket is two nodes closer to "bar" than "foo": "bas", "baz"
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var basBase64 = new Buffer("bas").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");

    var sender = undefined;
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({
        transport: transport
    });
    discover.register({id: fooBase64});
    transport.emit('reached', {id: basBase64});
    transport.emit('reached', {id: bazBase64});
    // "bas" and "baz" should now be in "foo" kBucket
    transport.emit('findNode', barBase64, sender, function (error, contacts) {
        test.ok(!error);
        test.deepEqual(contacts, [{id: basBase64}, {id: bazBase64}]);
        test.done();
    });
};

test["on 'findNode' adds the sender to the closest KBucket to the sender"] = function (test) {
    test.expect(4);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBuffer = new Buffer("bar");
    var barBase64 = barBuffer.toString("base64");

    var sender = {id: barBase64, data: 'bar', host: '127.0.0.1', port: 6999};
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({
        // inlineTrace: true,
        transport: transport
    });
    discover.register({id: fooBase64, data: 'foo'});
    var kBucket = discover.kBuckets[fooBase64].kBucket;
    transport.emit('findNode', barBase64, sender, function (error, contacts) {
        test.ok(!error);
        test.deepEqual(contacts, []);
        var closest = kBucket.closest({id: barBuffer});
        test.equal(closest.length, 1);
        test.equal(closest[0].id.toString("base64"), barBase64);
        test.done();
    });
};

test["on 'findNode' adds the sender as the local KBucket contact if id matches a local KBucket and arbiter returns candidate"] = function (test) {
    test.expect(4);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBuffer = new Buffer("bar");
    var barBase64 = barBuffer.toString("base64");

    var arbiter = function arbiter(incumbent, candidate) {
        return candidate;
    };
    var arbiterDefaults = function arbiterDefaults(contact) {
        return contact;
    };
    var sender = {id: fooBase64, data: 'updated'};
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({
        arbiter: arbiter,
        arbiterDefaults: arbiterDefaults,
        // inlineTrace: true,
        transport: transport
    });
    discover.register({id: fooBase64, data: 'foo'});
    transport.emit('findNode', barBase64, sender, function (error, contacts) {
        test.ok(!error);
        test.deepEqual(contacts, []);
        var contact = discover.kBuckets[fooBase64].contact;
        test.equal(contact.id, fooBase64);
        test.equal(contact.data, "updated");
        test.done();
    });
};
