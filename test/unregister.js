/*

unregister.js - discover.unregister(nodeId) test

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

test['unregister() succeeds if kBucket does not exist'] = function (test) {
    test.expect(1);
    var discover = new Discover();
    discover.unregister({id: new Buffer("foo").toString("base64")});
    test.ok(true); // nothing breaks
    test.done();
};

test['unregister() removes existing kBucket'] = function (test) {
    test.expect(3);
    var transport = new events.EventEmitter();
    transport.setTransportInfo = function (contact) {
        return contact;
    };    
    transport.findNode = function (contact, nodeId) {};
    var discover = new Discover({transport: transport});
    test.equal(Object.keys(discover.kBuckets).length, 0);
    var contact = discover.register();
    test.equal(Object.keys(discover.kBuckets).length, 1);
    discover.unregister(contact);
    test.equal(Object.keys(discover.kBuckets).length, 0);
    test.done();
};