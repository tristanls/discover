/*

cache.js - discover LRU cache test

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

test["'noCache' option set turns off caching"] = function (test) {
    test.expect(3);
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({noCache: true, transport: transport});
    var contact = discover.add({id: barBase64});
    test.strictEqual(contact, null);
    discover.find(barBase64, function (error, contact) {
        test.ok(error);
        test.ok(!contact);
        test.done();
    });
};

test["caching is on by default"] = function (test) {
    test.expect(3);
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({transport: transport});
    var contact = discover.add({id: barBase64});
    test.strictEqual(contact, null); // no k-buckets to insert into
    discover.find(barBase64, function (error, contact) {
        test.ok(!error);
        test.deepEqual(contact, {id: barBase64}); // cached contact
        test.done();
    });
};

test["'maxCacheSize' option sets maximum cache size"] = function (test) {
    test.expect(6);
    var fooBase64 = new Buffer("foo").toString("base64");
    var barBase64 = new Buffer("bar").toString("base64");
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };
    var discover = new Discover({maxCacheSize: 1, transport: transport});
    var contact = discover.add({id: barBase64}); // bar takes the 1 spot in cache
    test.strictEqual(contact, null);
    contact = discover.add({id: fooBase64}); // foo takes over only spot in cache
    test.strictEqual(contact, null);
    discover.find(barBase64, function (error, contact) {
        // bar was ejected out of the cache by foo
        test.ok(error);
        test.ok(!contact);
        discover.find(fooBase64, function (error, contact) {
            // foo was in cache
            test.ok(!error);
            test.deepEqual(contact, {id: fooBase64});
            test.done();
        });
    });
};