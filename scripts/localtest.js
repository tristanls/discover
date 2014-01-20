#!/usr/bin/env node
// run 5 nodes in the local environment and display trace info

var assert = require('assert'),
    crypto = require('crypto'),
    Discover = require('../index.js'),
    TcpTransport = require('discover-tcp-transport'),
    util = require('util');

// TODO: maybe fix flow control, being really really lazy here with code layout :)
var transport1, transport2, transport3, transport4, transport5;
var discover1, discover2, discover3, discover4, discover5;
var id1, id2, id3, id4, id5;

transport1 = TcpTransport.listen({port: 6741}, function () {
    transport2 = TcpTransport.listen({port: 6742}, function () {
        transport3 = TcpTransport.listen({port: 6743}, function () {
            transport4 = TcpTransport.listen({port: 6744}, function () {
                transport5 = TcpTransport.listen({port: 6745}, function () {
                    startLocalTest();
                });
            });
        });
    });
});

function startLocalTest() {

    id1 = crypto.randomBytes(20).toString('base64');
    id2 = crypto.randomBytes(20).toString('base64');
    id3 = crypto.randomBytes(20).toString('base64');
    id4 = crypto.randomBytes(20).toString('base64');
    id5 = crypto.randomBytes(20).toString('base64');

    discover1 = new Discover({
        inlineTrace: true, 
        seeds: [
            {
                id: id1,
                data: 'discover1',
                transport: {
                    host: 'localhost',
                    port: 6741
                }
            },
            {
                id: id2,
                data: 'discover2',
                transport: {
                    host: 'localhost',
                    port: 6742
                }
            },
            {
                id: id3,
                data: 'discover3',
                transport: {
                    host: 'localhost',
                    port: 6743
                }
            }
        ],
        transport: transport1});
    discover2 = new Discover({
        inlineTrace: true, 
        seeds: [
            {
                id: id1,
                data: 'discover1',
                transport: {
                    host: 'localhost',
                    port: 6741
                }
            },
            {
                id: id2,
                data: 'discover2',
                transport: {
                    host: 'localhost',
                    port: 6742
                }
            },
            {
                id: id3,
                data: 'discover3',
                transport: {
                    host: 'localhost',
                    port: 6743
                }
            }
        ],
        transport: transport2
    });
    discover3 = new Discover({
        inlineTrace: true, 
        seeds: [
            {
                id: id1,
                data: 'discover1',
                transport: {
                    host: 'localhost',
                    port: 6741
                }
            },
            {
                id: id2,
                data: 'discover2',
                transport: {
                    host: 'localhost',
                    port: 6742
                }
            },
            {
                id: id3,
                data: 'discover3',
                transport: {
                    host: 'localhost',
                    port: 6743
                }
            }
        ],
        transport: transport3
    });
    discover4 = new Discover({
        inlineTrace: true, 
        seeds: [
            {
                id: id1,
                data: 'discover1',
                transport: {
                    host: 'localhost',
                    port: 6741
                }
            },
            {
                id: id2,
                data: 'discover2',
                transport: {
                    host: 'localhost',
                    port: 6742
                }
            },
            {
                id: id3,
                data: 'discover3',
                transport: {
                    host: 'localhost',
                    port: 6743
                }
            }
        ],
        transport: transport4
    });
    discover5 = new Discover({
        inlineTrace: true, 
        seeds: [
            {
                id: id1,
                data: 'discover1',
                transport: {
                    host: 'localhost',
                    port: 6741
                }
            },
            {
                id: id2,
                data: 'discover2',
                transport: {
                    host: 'localhost',
                    port: 6742
                }
            },
            {
                id: id3,
                data: 'discover3',
                transport: {
                    host: 'localhost',
                    port: 6743
                }
            }
        ],
        transport: transport5
    });

    console.log('~script five discover instances running');
    console.log('~script starting self-registrations');

    var node1 = {id: id1, data: 'discover1', transport: {host: 'localhost', port: 6741}};
    var node2 = {id: id2, data: 'discover2', transport: {host: 'localhost', port: 6742}};
    var node3 = {id: id3, data: 'discover3', transport: {host: 'localhost', port: 6743}};
    var node4 = {id: id4, data: 'discover4', transport: {host: 'localhost', port: 6744}};
    var node5 = {id: id5, data: 'discover5', transport: {host: 'localhost', port: 6745}};

    discover1.register(node1);
    discover2.register(node2);
    discover3.register(node3);
    discover4.register(node4);
    discover5.register(node5);

    var discoverNodes = [discover1, discover2, discover3, discover4, discover5];

    discoverNodes.forEach(function (discoverNode) {
        discoverNode.on('stats.timers.find.ms', function (latency) {
            console.log('~stats: stats.timers.find.ms ' + latency);
        });
        discoverNode.on('stats.timers.find.round.ms', function (latency) {
            console.log('~stats: stats.timers.find.round.ms ' + latency);
        });
        discoverNode.on('stats.timers.find.request.ms', function (latency) {
            console.log('~stats: stats.timers.find.request.ms ' + latency);
        });
    });

    console.log('~script self-registrations complete');
    console.log('~script allowing nodes to communicate and settle');

    setTimeout(continueLocalTest, 1000);
};

function continueLocalTest() {
    console.log('~script listing node contents');

    console.log('~script discover1:', util.inspect(discover1, false, null));
    console.log('~script discover2:', util.inspect(discover2, false, null));
    console.log('~script discover3:', util.inspect(discover3, false, null));
    console.log('~script discover4:', util.inspect(discover4, false, null));
    console.log('~script discover5:', util.inspect(discover5, false, null));

    console.log('~script listing of node contents complete');

    console.log('~script discover5 is asked to find discover4');

    discover5.find(id4, function (error, contact) {

        console.log('~script find id4 response');
        console.log('~script', error, util.inspect(contact, false, null));

        console.log('~script listing node contents');

        console.log('~script discover1:', util.inspect(discover1, false, null));
        console.log('~script discover2:', util.inspect(discover2, false, null));
        console.log('~script discover3:', util.inspect(discover3, false, null));
        console.log('~script discover4:', util.inspect(discover4, false, null));
        console.log('~script discover5:', util.inspect(discover5, false, null));

        console.log('~script listing of node contents complete');

        setTimeout(continueLocalTest2, 1000);
    });
};

var id6;

function continueLocalTest2() {
    id6 = crypto.randomBytes(20).toString('base64');
    var node6 = {id: id6, data: 'discover6', transport: {host: 'localhost', port: 6741}};

    console.log('~script multiple nodes per discover instance');

    discover1.register(node6);

    console.log('~script allowing nodes to communicate and settle');

    setTimeout(continueLocalTest3, 1000);
};

function continueLocalTest3() {
    console.log('~script retrieving node6 from discover5');
    discover5.find(id6, function (error, contact) {
        assert.ok(!error);

        console.log('~script recevied contact: ' + util.inspect(contact, false, null));

        console.log('~script second attempt should always be local (using cached value)');
        discover5.find(id6, function (error, contact) {
            assert.ok(!error);
            console.log('~script received contact: ' + util.inspect(contact, false, null));

            setTimeout(complete, 1000);
        });
    });
};

function complete() {
    console.log('~script complete');
    setTimeout(function () { process.exit(); }, 1000);
};