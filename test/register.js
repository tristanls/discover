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

test['register() creates a new kBucket from randomly generated nodeId'] = function (test) {
    test.expect(3);
    var transport = new events.EventEmitter();
    transport.findNode = function (contact, nodeId) {};
    var discover = new Discover({transport: transport});
    var nodeInfo = discover.register();
    test.ok(nodeInfo.nodeId);
    test.equal(nodeInfo.vectorClock, 0);
    // TODO: doing this check is a design smell.. why am I reaching in here?
    test.equal(Object.keys(discover.kBuckets).length, 1);
    test.done();
};

test['register() does not re-create an existing kBucket'] = function (test) {
    test.expect(1);
    var transport = new events.EventEmitter();
    transport.findNode = function (contact, nodeId) {};
    var discover = new Discover({transport: transport});
    var nodeInfo = discover.register();
    // TODO: doing this check is a design smell.. why am I reaching in here?
    var originalKBucketReference = discover.kBuckets[nodeInfo.nodeId];
    discover.register(nodeInfo.nodeId);
    test.ok(originalKBucketReference === discover.kBuckets[nodeInfo.nodeId]);
    test.done();
};