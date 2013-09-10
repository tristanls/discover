/*

onFindNode.js - transport.emit('findNode', ...) test

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

test["on 'findNode' returns the contact with id and data if node is one of registered nodes"] = function (test) {
    test.expect(2);
    var localBase64 = new Buffer("local").toString("base64");
    var transport = new events.EventEmitter();
    var discover = new Discover({
        transport: transport
    });
    discover.register({id: localBase64});
    transport.emit('findNode', localBase64, function (error, contact) {
        test.ok(!error);
        test.deepEqual(contact, {id: localBase64, vectorClock: 0});
    });
    test.done();
};

test["on 'findNode' returns the contact with id and data if node has been 'reached'"] = function (test) {
    test.expect(2);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    transport.findNode = function () {
        test.fail("used transport.findNode()");
    };
    var discover = new Discover({transport: transport});
    discover.register({id: fooBase64});
    transport.emit('reached', {id: barBase64});
    // "bar" should now be in "foo" kBucket
    transport.emit('findNode', barBase64, function (error, contact) {
        test.ok(!error);
        test.deepEqual(contact, {id: barBase64});
    });
    test.done();
};

test["on 'findNode' returns closest nodes if node is not one of registered nodes"] = function (test) {
    test.expect(2);
    // this test has one kBucket for registered nodeId "bar"
    // within this kBucket is two nodes closer to "bar" than "foo": "bas", "baz"
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var basBase64 = new Buffer("bas").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var transport = new events.EventEmitter();
    var discover = new Discover({
        transport: transport
    });
    discover.register({id: fooBase64});
    transport.emit('reached', {id: basBase64});
    transport.emit('reached', {id: bazBase64});
    // "bas" and "baz" should now be in "foo" kBucket
    transport.emit('findNode', barBase64, function (error, contacts) {
        test.ok(!error);
        test.deepEqual(contacts, [{id: basBase64}, {id: bazBase64}]);
    });
    test.done();
};