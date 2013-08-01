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
    net = require('net'),
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
