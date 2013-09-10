/*

onPing.js - kBucket.emit('ping', ...) test

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

test["on 'ping' forces transport.ping() of all old contacts"] = function (test) {
    test.expect(4);
    var fooBuffer = new Buffer("foo");
    var fooBufferBase64 = fooBuffer.toString("base64");
    var barBuffer = new Buffer("bar");
    var barBufferBase64 = barBuffer.toString("base64");
    var bazBuffer = new Buffer("baz");
    var bazBufferBase64 = bazBuffer.toString("base64");
    var fuzBuffer = new Buffer("fuz");
    var fuzBufferBase64 = fuzBuffer.toString("base64");

    var transport = new events.EventEmitter();
    transport.findNode = function (contact, nodeId) {};
    var count = 0;
    transport.ping = function (contact) {
        test.ok([fooBufferBase64, barBufferBase64, bazBufferBase64].indexOf(contact.id) > -1);
        count++;
        if (count == 3) {
            test.done();
        }
    };
    var discover = new Discover({transport: transport});
    var contact = discover.register({data: 'foo'});
    test.ok(contact.id);
    var kBucket = discover.kBuckets[contact.id].kBucket;
    kBucket.emit('ping', 
        [{id: fooBuffer}, {id: barBuffer}, {id: bazBuffer}],
        {id: fuzBuffer});
};

test["on 'ping' adds new contact if old contact is unreachable"] = function (test) {
    test.expect(3);
    var fooBuffer = new Buffer("foo");
    var fooBufferBase64 = fooBuffer.toString("base64");
    var barBuffer = new Buffer("bar");
    var barBufferBase64 = barBuffer.toString("base64");
    
    var transport = new events.EventEmitter();
    transport.ping = function (contact) {
        test.equal(contact.id, fooBufferBase64);
        transport.emit('unreachable', contact);
    };
    var discover = new Discover({transport: transport});
    var contact = discover.register({data: 'foo'});
    transport.emit('reached', {id: fooBufferBase64});
    test.ok(contact.id);
    var kBucket = discover.kBuckets[contact.id].kBucket;
    kBucket.add = function (contact) {
        test.equal(contact.id.toString("base64"), barBuffer.toString("base64"));
        test.done();
    };
    kBucket.emit('ping', [{id: fooBuffer}], {id: barBuffer});
};

test["on 'ping' removes reached and unreachable listeners if all old contacts are reached"] = function (test) {
    test.expect(6);
    var fooBuffer = new Buffer("foo");
    var fooBufferBase64 = fooBuffer.toString("base64");
    var barBuffer = new Buffer("bar");
    var barBufferBase64 = barBuffer.toString("base64");
    
    var transport = new events.EventEmitter();
    var kBucket;
    transport.ping = function (contact) {
        test.equal(contact.id, fooBufferBase64);
        // discover and the 'ping' handler listening to 'reached'
        test.equal(transport.listeners('reached').length, 2);
        test.equal(transport.listeners('unreachable').length, 2);
        transport.emit('reached', contact);
        // 'ping' handler listening to 'reached' is removed
        test.equal(transport.listeners('reached').length, 1);
        test.equal(transport.listeners('unreachable').length, 1);
        test.done();
    };
    var discover = new Discover({transport: transport});
    var contact = discover.register({data: 'foo'});
    transport.emit('reached', {id: fooBufferBase64});
    test.ok(contact.id);
    kBucket = discover.kBuckets[contact.id].kBucket;
    kBucket.emit('ping', [{id: fooBuffer}], {id: barBuffer});    
};


test["on 'ping' removes reached and unreachable listeners if one of old contacts is unreachable"] = function (test) {
    test.expect(6);
    var fooBuffer = new Buffer("foo");
    var fooBufferBase64 = fooBuffer.toString("base64");
    var barBuffer = new Buffer("bar");
    var barBufferBase64 = barBuffer.toString("base64");
    
    var transport = new events.EventEmitter();
    var kBucket;
    transport.ping = function (contact) {
        test.equal(contact.id, fooBufferBase64);
        // discover and the 'ping' handler listening to 'reached'
        test.equal(transport.listeners('reached').length, 2);
        test.equal(transport.listeners('unreachable').length, 2);
        transport.emit('unreachable', contact);
        // 'ping' handler listening to 'reached' is removed
        test.equal(transport.listeners('reached').length, 1);
        test.equal(transport.listeners('unreachable').length, 1);
        test.done();
    };
    var discover = new Discover({transport: transport});
    var contact = discover.register({data: 'foo'});
    transport.emit('reached', {id: fooBufferBase64});
    test.ok(contact.id);
    kBucket = discover.kBuckets[contact.id].kBucket;
    kBucket.emit('ping', [{id: fooBuffer}], {id: barBuffer});    
};