/*

onNode.js - transport.emit('node', ...) test

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

test["on 'node' adds the reached contact to the closest KBucket"] = function (test) {
    test.expect(4);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({
        noCache: true,
        transport: transport
    });
    discover.register({id: fooBase64});
    // "foo" is the closest (and only) KBucket

    var done = expectDone(test, 3);

    discover.on('stats.timers.find.ms', function (latency) {
        test.ok(true); // 1
        done();
    });
    discover.on('stats.timers.find.request.ms', function (latency) {
        test.equal(latency, 0); // 1
        done();
    });
    discover.on('stats.timers.find.round.ms', function (latency) {
        test.ok(false, 'stats.timers.find.round.ms should not be called');
    });

    transport.emit('node', null, {id: barBase64});
    discover.find(barBase64, function (error, contact) {
        test.ok(!error);
        test.deepEqual(contact, {id: barBase64});
    });
    done();
};

test["on 'node' adds the reached contact as the local KBucket contact if id matches a local KBucket and arbiter returns candidate"] = function (test) {
    test.expect(5);
    var fooBase64 = new Buffer("foo").toString("base64");

    var arbiter = function arbiter(incumbent, candidate) {
        return candidate;
    };
    var arbiterDefaults = function arbiterDefaults(contact) {
        return contact;
    };

    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({
        arbiter: arbiter,
        arbiterDefaults: arbiterDefaults,
        // inlineTrace: true,
        noCache: true,
        transport: transport
    });
    discover.register({id: fooBase64, data: "foo"});

    var done = expectDone(test, 3);

    discover.on('stats.timers.find.ms', function (latency) {
        test.ok(true); // 1
        done();
    });
    discover.on('stats.timers.find.request.ms', function (latency) {
        test.equal(latency, 0); // 1
        done();
    });
    discover.on('stats.timers.find.round.ms', function (latency) {
        test.ok(false, 'stats.timers.find.round.ms should not be called');
    });

    transport.emit('node', null, {id: fooBase64, data: "updated"});
    discover.find(fooBase64, function (error, contact) {
        test.ok(!error);
        test.equal(contact.id, fooBase64);
        test.equal(contact.data, "updated");
    });
    done();
};

test["on 'node' adds the response as the local KBucket contact if id matches a local KBucket and arbiter returns candidate"] = function (test) {
    test.expect(2);
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
    var response = {id: barBase64, data: 'updated'};

    var transport = new events.EventEmitter();
    transport.findNode = function () {};
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({
        arbiter: arbiter,
        arbiterDefaults: arbiterDefaults,
        // inlineTrace: true,
        seeds: [
            {id: fooBase64, transport: {}}
        ],
        transport: transport
    });
    discover.register({id: barBase64, data: 'bar'});
    transport.emit('node', null, sender, barBase64, response);
    var contact = discover.kBuckets[barBase64].contact;
    test.equal(contact.id, barBase64);
    test.equal(contact.data, "updated");
    test.done();
};

test["on 'node' adds the responses as the local KBucket contacts if id matches a local KBucket and arbiter returns candidate"] = function (test) {
    test.expect(6);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var bazBase64 = new Buffer("baz").toString("base64");
    var basBase64 = new Buffer("bas").toString("base64");

    var arbiter = function arbiter(incumbent, candidate) {
        return candidate;
    };
    var arbiterDefaults = function arbiterDefaults(contact) {
        return contact;
    };

    var sender = {id: fooBase64, data: 'updated'};
    var responses = [
        {id: barBase64, data: 'updated'},
        {id: bazBase64, data: 'updated'},
        {id: basBase64, data: 'updated'}
    ];

    var transport = new events.EventEmitter();
    transport.findNode = function () {};
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({
        arbiter: arbiter,
        arbiterDefaults: arbiterDefaults,
        // inlineTrace: true,
        seeds: [
            {id: fooBase64, transport: {}}
        ],
        transport: transport
    });

    discover.register({id: barBase64, data: 'bar'});
    discover.register({id: bazBase64, data: 'baz'});
    discover.register({id: basBase64, data: 'bas'});

    transport.emit('node', null, sender, barBase64, responses);

    var barContact = discover.kBuckets[barBase64].contact;
    test.equal(barContact.id, barBase64);
    test.equal(barContact.data, "updated");

    var bazContact = discover.kBuckets[bazBase64].contact;
    test.equal(bazContact.id, bazBase64);
    test.equal(bazContact.data, "updated");

    var basContact = discover.kBuckets[basBase64].contact;
    test.equal(basContact.id, basBase64);
    test.equal(basContact.data, "updated");

    test.done();
};
