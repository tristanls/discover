/*

unreachable.js - discover.unreachable(contact) test

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

test["unreachable() removes the unreachable contact from the closest KBucket"] = function (test) {
    test.expect(8);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    var initial = true;
    transport.setTransportInfo = function (contact) {
        return contact;
    };    
    transport.findNode = function (contact, nodeId) {
        if (initial) {
            test.equal(contact.id, "baz");
            test.equal(contact.ip, "127.0.0.1");
            test.equal(contact.port, 6742);
            test.equal(nodeId, fooBase64);
            initial = false;
        } else {
            test.equal(contact.id, "baz");
            test.equal(contact.ip, "127.0.0.1");
            test.equal(contact.port, 6742);
            test.equal(nodeId, barBase64);
            test.done();
        }
    };
    var discover = new Discover({
        // inlineTrace: true, 
        seeds: [{id: "baz", ip: "127.0.0.1", port: 6742}],
        transport: transport
    });
    discover.register({id: fooBase64});
    // "foo" is the closest (and only) KBucket
    transport.emit('reached', {id: barBase64});
    // "bar" is put in "foo" KBucket
    discover.unreachable({id: barBase64});
    discover.find(barBase64, function (error, contact) {
        // because unreachable removed "bar"
        // we expect findNode request to happen
    });    
};

test["unreachable() removes the unreachable contact from non-kBucket LRU cache"] = function (test) {
    test.expect(8);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    var initial = true;
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    transport.findNode = function (contact, nodeId) {
        if (initial) {
            test.equal(contact.id, "baz");
            test.equal(contact.transport.ip, "127.0.0.1");
            test.equal(contact.transport.port, 6742);
            test.equal(nodeId, fooBase64);
            initial = false;
        } else {
            test.equal(contact.id, "baz");
            test.equal(contact.transport.ip, "127.0.0.1");
            test.equal(contact.transport.port, 6742);
            test.equal(nodeId, barBase64);
            test.done();
        }
    };
    var discover = new Discover({
        // inlineTrace: true,
        seeds: [{id: "baz", transport: {ip: "127.0.0.1", port: 6742}}],
        transport: transport
    });
    discover.register({id: fooBase64});
    // "foo" is the closest (and only) KBucket
    transport.emit('reached', {id: barBase64});
    // "bar" is put in "foo" KBucket
    discover.unreachable({id: barBase64});
    discover.find(barBase64, function (error, contact) {
        // because unreachable removed "bar"
        // we expect findNode request to happen
    });
};
