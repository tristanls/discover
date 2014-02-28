/*

add.js - discover.add(remoteContact) test

The MIT License (MIT)

Copyright (c) 2014 Tristan Slominski

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

var events = require('events');

var Discover = require('../index.js');

var test = module.exports = {};

test['add() should throw an exception if contact is missing id'] = function (test) {
    test.expect(1);
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({transport: transport});
    test.throws(function () {
        discover.add({});
    }, Error);    
    test.done();
};

test['add() should throw an exception if contact id is not a string'] = function (test) {
    test.expect(1);
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({transport: transport});
    test.throws(function () {
        discover.add({id: 1});
    }, Error);    
    test.done();
};

test['add() should return null if no KBuckets to add to'] = function (test) {
    test.expect(1);
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({transport: transport});
    var contact = discover.add({id: barBase64});
    test.strictEqual(contact, null);
    test.done();
};

test['add() adds the remote contact to the closest KBucket'] = function (test) {
    test.expect(2);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({noCache: true, transport: transport});
    discover.register({id: fooBase64});
    // "foo" is the closest (and only) KBucket
    discover.add({id: barBase64});
    discover.find(barBase64, function (error, contact) {
        test.ok(!error);
        test.deepEqual(contact, {id: barBase64});
    });
    test.done();
};

test['add() replaces local KBucket contact with remote contact if arbiter returns remote contact'] = function (test) {
    test.expect(3);
    var fooBase64 = new Buffer("foo").toString("base64");

    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };

    var arbiter = function arbiter(incumbent, candidate) {
        return candidate;
    };
    var arbiterDefaults = function arbiterDefaults(contact) {
        return contact;
    };
    var discover = new Discover({
        arbiter: arbiter,
        arbiterDefaults: arbiterDefaults,
        noCache: true,
        transport: transport
    });
    discover.register({id: fooBase64, data: "foo"});
    discover.add({id: fooBase64, data: "updated"});
    discover.find(fooBase64, function (error, contact) {
        test.ok(!error);
        test.equal(contact.id, fooBase64);
        test.equal(contact.data, "updated");
    });
    test.done();
};

test['add() returns the contact on successful add'] = function (test) {
    test.expect(1);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({transport: transport});
    discover.register({id: fooBase64});
    // "foo" is the closest (and only) KBucket
    var contact = discover.add({id: barBase64});
    test.deepEqual(contact, {id: barBase64});
    test.done();
};