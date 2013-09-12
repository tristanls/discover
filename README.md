# discover

_Stability: 1 - [Experimental](https://github.com/tristanls/stability-index#stability-1---experimental)_

Discover is a distributed master-less node discovery mechanism that enables locating any entity (server, worker, drone, actor) based on node id. It enables point-to-point communications without pre-defined architecture.

## Installation

    npm install discover

## Tests

### Unit Tests

    npm test

### Localhost Visual Trace Test

    npm run-script localtest

## Overview

Discover is a distributed master-less node discovery mechanism that enables locating any entity (server, worker, drone, actor) based on node id. Discover is implemented using a stripped down version of the Kademlia DHT. It uses only the PING and FIND-NODE Kademlia protocol RPCs. (It leaves out STORE and FIND-VALUE). 

An enhancement _(maybe)_ on top of the Kademlia protocol implementation is the inclusion of optional _vector clocks_ in the discovery mechanism. The purpose of the vector clock is to account for rapid change in location of entities to be located. For example, if you rapidly migrate compute workers to different physical servers, vector clocks allow the distributed nodes to select between conflicting location reports by selecting the node with the corresponding id that also has the largest vector clock value. A better example (and initial use case) of rapidly shifting entities are actors within a distributed actor configuration.

Each Discover node is meant to store many entities that correspond to the same "physical" node. It functions as an external "gateway" of sorts to beyond the local environment. For example, if a process wants to send a message to another process that is on a remote system somewhere, Discover enables distributed master-less correlation of that process' id with it's physical location for message delivery (or delivery failure if it cannot be found).

It is worth highlighting that Discover is _only_ a discovery mechanism. You can find out where a node is (it's IP and port, for example), but to talk to it, you should have a way of doing that yourself.

### Why Discover?

There are two reasons.

First, Discover exists because every Kademlia DHT implementation I came across in Node.js community tightly coupled the procotocol implementation with the transport implementation. 

Second, I wanted to learn and commit to intuition the implementation of Kademlia DHT so that I can apply that knowledge in other projects. This way, in case the first reason becomes invalid, there's still this one.

## Documentation

### Discover

Node ids in Discover are represented as base64 encoded Strings. This is because the default generated node ids (SHA-1 hashes) could be unsafe to print. `base64` encoding was picked over `hex` encoding because it takes up less space when printed or serialized in ASCII over the wire.

_For more detailed documentation including private methods see [Discover doc](docs/Discover.md)_

**Public API**
  * [new Discover(options)](#new-discoveroptions)
  * [discover.find(nodeId, callback, \[announce\])](#discoverfindnodeid-callback-announce)
  * [discover.register(contact)](#discoverregistercontact)
  * [discover.unreachable(contact)](#discoverunreachablecontact)
  * [discover.unregister(contact)](#discoverunregistercontact)

#### new Discover(options)

  * `options`:
    * `CONCURRENCY_CONSTANT`: _Integer_ _(Default: 3)_ Number of concurrent FIND-NODE requests to the network per `find` request.
    * `eventTrace`: _Boolean_ _(Default: false)_ If set to `true`, Discover will emit `~trace` events for debugging purposes.
    * `inlineTrace`: _Boolean_ _(Default: false)_ If set to `true`, Discover will log to console `~trace` messages for debugging purposes.
    * `seeds`: _Array_ _(Default: [])_ An array of seed `contact` Objects that the `transport` understands.
    * `transport`: _Object_ _(Default: `discover-tcp-transport`)_ An optional initialized and ready to use transport module for sending communications that conforms to the Transport Protocol. If `transport` is not provided, a new instance of `discover-tcp-transport` will be created and used with default settings.

Creates a new Discover instance.

The `seeds` are necessary if joining an existing Discover cluster. Discover will use these `seeds` to announce itself to other nodes in the cluster. If `seeds` are not provided, then it is assumed that this is a seed node, and other nodes will include this node's address in their `seeds` option. It all has to start somewhere.

#### discover.find(nodeId, callback, [announce])

  * `nodeId`: _String (base64)_ The node id to find, base64 encoded.
  * `callback`: _Function_ The callback to call with the result of searching for `nodeId`.
  * `announce`: _Object_ _(Default: undefined)_ _**CAUTION: reserved for internal use**_ Contact object, if specified, it indicates an announcement to the network so we ask the network instead of satisfying request locally and the sender is the `announce` contact object.

The `callback` is called with the result of searching for `nodeId`. The result will be a `contact` containing `contact.id` and `contact.data` of the node. If an error occurs, only `error` will be provided.

```javascript
discover.find('bm9kZS5pZC50aGF0LmltLmxvb2tpbmcuZm9y', function (error, contact) {
    if (error) return console.error(error);
    console.dir(contact); 
});
```

#### discover.register(contact)

  * `contact`: _Object_ Contact object to register.
    * `id`: _String (base64)_ _(Default: `crypto.createHash('sha1').digest('base64'`)_ The contact id, base 64 encoded; will be created if not present.
    * `data`: _Any_ Data to be included with the contact, it is guaranteed to be returned for anyone querying for this `contact` by `id`
    * `vectorClock`: _Integer_ _(Default: 0)_ Vector clock to pair with node id.
  * Return: _Object_ Contact that was registered with `id` and `vectorClock` generated if necessary.

Registers a new node on the network with `contact.id`. Returns a `contact`:

```javascript
discover.register({
    id: 'Zm9v', // base64 encoded String representing nodeId
    data: 'foo',
    vectorClock: 0  // vector clock paired with the nodeId
});
```

_NOTE: Current implementation creates a new k-bucket for every registered node id. It is important to remember that a k-bucket could store up to k*lg(n) contacts, where lg is log base 2, n is the number of registered node ids on the network, and k is the size of each k-bucket (by default 20). For 1 billion registered nodes on the network, each k-bucket could store around 20 * lg (1,000,000,000) = ~ 598 contacts. This isn't bad, until you have 1 million local entities for a total of 598,000,000 contacts plus k-bucket overhead, which starts to put real pressure on Node.js/V8 memory limit._

#### discover.unreachable(contact)

  * `contact`: _Object_ Contact object to report unreachable
    * `id`: _String (base64)_ The previously registered contact id, base 64 encoded.
    * `vectorClock`: _Integer_ _(Default: 0)_ Vector clock of contact to report unreachable.

Reports the `contact` as unreachable in case Discover is storing outdated information. This can happen because Discover is a local cache of the global state of the network. If a change occurs, it may not immediately propagate to the local Discover instance.

If it is desired to get the latest `contact` that is unreachable, the following code shows an example:

```javascript
discover.find("Zm9v", function (error, contact) {
    // got contact
    // attempt to connect ... and fail :(
    discover.unreachable(contact);
    discover.find(contact.id, function (error, contact) {
        // new contact will be found in the network
        // or an error if it cannot be found
    });
});
```

#### discover.unregister(contact)

  * `contact`: _Object_ Contact object to register
    * `id`: _String (base64)_ The previously registered contact id, base 64 encoded.
    * `vectorClock`: _Integer_ _(Default: 0)_ Vector clock of contact to unregister.

Unregisters previously registered `contact` (identified by `contact.id` and `contact.vectorClock`) from the network.

### Transport Interface

Modules implementing the transport mechanism for Discover shall conform to the following interface. A `transport` is a JavaScript object.

Transport implementations shall ensure that `contact.id` and `contact.data` will be immutable and will pass through the transportation system without modification (`contact` objects are passed through the transportation system when responding to FIND-NODE requests).

Transport implementations shall allow registering and interacting with event listeners as provided by `events.EventEmitter` interface.

For reference implementation, see [discover-tcp-transport](https://github.com/tristanls/node-discover-tcp-transport).

_NOTE: Unreachability of nodes depends on the transport. For example, transports ,like TLS transport, could use invalid certificate criteria for reporting unreachable nodes._

_**WARNING**: Using TCP transport is meant primarily for development in a development environment. TCP transport exists because it is a low hanging fruit. It is most likely that it should be replaced with DTLS transport in production (maybe TLS if DTLS is not viable). There may also be a use-case for using UDP transport if communicating nodes are on a VPN/VPC. Only if UDP on a VPN/VPC seems not viable, should TCP transport be considered._

**Transport Interface Specification**
  * [transport.findNode(contact, nodeId, sender)](#transportfindnodecontact-nodeid-sender)
  * [transport.ping(contact, sender)](#transportpingcontact-sender)
  * [Event 'findNode'](#event-findnode)
  * [Event 'node'](#event-node)
  * [Event 'ping'](#event-ping)
  * [Event 'reached'](#event-reached)
  * [Event 'unreachable'](#event-unreachable)

#### transport.findNode(contact, nodeId, sender)

  * `contact`: _Object_ The node to contact with request to find `nodeId`.
    * `id`: _String (base64)_ Base64 encoded contact node id.
  * `nodeId`: _String (base64)_ Base64 encoded string representation of the node id to find.
  * `sender`: _Object_ The sender of this request.
    * `id`: _String (base64)_ Base64 encoded sender id.
    * `data`: _Any_ Sender data.

Issues a FIND-NODE request to the `contact`. Response, timeout, errors, or otherwise shall be communicated by emitting a `node` event.

#### transport.ping(contact, sender)

  * `contact`: _Object_ Contact to ping.
    * `id`: _String (base64)_ Base64 encoded contact node id.
  * `sender`: _Object_ The sender of this request.
    * `id`: _String (base64)_ Base64 encoded sender id.
    * `data`: _Any_ Sender data.

Issues a PING request to the `contact`. The transport will emit `unreachable` event if the `contact` is unreachable, or `reached` event otherwise.

#### Event: `findNode`

  * `nodeId`: _String (base64)_ Base64 encoded string representation of the node id to find.
  * `sender`: _Object_ The contact making the request.
    * `id`: _String (base64)_ Base64 encoded sender id.
    * `data`: _Any_ Sender data.
  * `callback`: _Function_ The callback to call with the result of processing the FIND-NODE request.
    * `error`: _Error_ An error, if any.
    * `response`: _Object_ or _Array_ The response to FIND-NODE request.

Emitted when another node issues a FIND-NODE request to this node.

```javascript
transport.on('findNode', function (nodeId, sender, callback) {
    // this node knows the node with nodeId or is itself node with nodeId
    var error = null;
    return callback(error, contactWithNodeId);
});
```

A single `contactWithNodeId` shall be returned with the information identifying the contact corresponding to requested `nodeId`.

```javascript
transport.on('findNode', function (nodeId, sender, callback) {
    // nodeId is unknown to this node, so it returns an array of nodes closer to it
    var error = null;
    return callback(error, closestContacts); 
});
```

An Array of `closestContacts` shall be returned if the `nodeId` is unknown to this node.

If an error occurs and a request cannot be fulfilled, an error should be passed to the callback.

```javascript
transport.on('findNode', function (nodeId, sender, callback) {
    // some error happened
    return callback(new Error("oh no!")); 
});
```

#### Event: `node`

  * `error`: _Error_ An error, if one occurred.
  * `contact`: _Object_ The node that FIND-NODE request was sent to.
  * `nodeId`: _String_ The original node id requested to be found.
  * `response`: _Object_ or _Array_ The response from the queried `contact`.

If `error` occurs, the transport encountered an error when issuing the `findNode` request to the `contact`. `contact` and `nodeId` will also be provided in case of an error. `response` is to be undefined if an `error` occurs.

`response` will be an Array if the `contact` does not contain the `nodeId` requested. In this case `response` will be a `contact` list of nodes closer to the `nodeId` that the queried node is aware of. The usual step is to next query the returned contacts with the FIND-NODE request.

`response` will be an Object if the `contact` knows of the `nodeId`. In other words, the node has been found, and `response` is a `contact` object.

#### Event: `ping`

  * `nodeId`: _String (base64)_ Base64 encoded string representation of the node id being pinged.
  * `sender`: _Object_ The contact making the request.
    * `id`: _String (base64)_ Base64 encoded sender node id.
    * `data`: _Any_ Sender node data.
  * `callback`: _Function_ The callback to call with the result of processing the PING request.
    * `error`: _Error_ An error, if any.
    * `response`: _Object_ or _Array_ The response to PING request, if any.

Emitted when another node issues a PING request to this node.

```javascript
var tcpTransport = require('discover-tcp-transport');
tcpTransport.on('ping', function (nodeId, sender, callback) {
    // ... verify that we have the exact node specified by nodeId
    return callback(null, contact); 
});
```

In the above example `contact` is an Object representing the answer to `ping` query.

If the exact node specified by nodeId does not exist, an error shall be returned as shown below:

```javascript
var tcpTransport = require('discover-tcp-transport');
tcpTransport.on('ping', function (nodeId, sender, callback) {
    // ...we don't have the nodeId specified
    return callback(true); 
});
```

#### Event: `reached`

  * `contact`: _Object_ The contact that was reached when pinged.
      * `id`: _String (base64)_ Base64 encoded contact node id.
      * `data`: _Any_ Data included with the contact.

Emitted when a previously pinged `contact` is deemed reachable by the transport.

#### Event: `unreachable`

  * `contact`: _Object_ The contact that was unreachable when pinged.
      * `id`: _String (base64)_ Base64 encoded contact node id.

Emitted when a previously pinged `contact` is deemed unreachable by the transport.

## Road Map

### Immediate concerns

This is roughly in order of current priority:

  * **Interface Specification**: The interface points between `discover`, `transport`, and `k-bucket` are still experimental but are quickly converging on what they need to be in order to support the functionality
    * **storage refactoring**: There emerged (obvious in retrospect) a "storage" abstraction during the implementation of `discover` that is higher level than a `k-bucket` but that still seems to be worth extracting. 
  * **Implementation Correctness**: Gain confidence that the protocol functions as expected. This should involve running a lot of nodes and measuring information distribution latency and accuracy.
  * **TLS Transport** _(separate module)_ or it might make sense to change the TCP Transport into Net Transport and include within both TCP and TLS.
  * **UDP Transport** _(separate module)_
  * **DTLS Transport** _(separate module)_
  * **Performance**: Make it fast and small.
    * **discover.kBuckets**: It should be a datastructure with _O(log n)_ operations.

### Other considerations

This is a non-exclusive list of some of the highlights to keep in mind and maybe implement if opportunity presents itself.

#### Settle the vocabulary

Throughout Discover, the transport, and the k-bucket implementations, the vocabulary is inconsistent (in particular the usage of "contact", "node", "network", and "DHT"). Once the implementation settles and it becomes obvious what belongs where, it will be helpful to have a common, unifying way to refer to everything.

#### Less destructive unregister()

Currently, `discover.unregister(contact)` deletes all "closest" contact information that was gathered within the k-bucket corresponding to the `contact`. This throws away DHT information stored there.

An elaboration would be to distribute known contacts to other k-buckets when a `contact` is unregistered.

#### Multiple Transports

There is really nothing that I immediately see that would be preventing use of multiple transports. It may be useful to implement a `contact.transport` field to specify which transport to use/prefer. For example:

```javascript
{
    id: 'Zm9v', // base64 encoded String representing nodeId
    data: 'foo',
    ip: '127.0.0.1',
    port: 8080,
    transport: 'tcp'
}
// or
{
    id: 'Zm9v', // base64 encoded String representing nodeId
    data: 'foo'
    hostname: 'localhost',
    port: 80,
    transport: 'http'    
}
// or maybe something like...
{
    id: 'Zm9v', // base64 encoded String representing nodeId
    data: 'foo',
    transport: {
        dtls: {
            ip: '127.0.0.1',
            port: '4321'
        },
        tls: {
            ip: '127.0.0.1',
            port: '1234'
        },
        tcp: {
            ip: '127.0.0.1',
            port: '5555'
        }
    }
}
```

## Sources

The implementation has been sourced from:

  - [A formal specification of the Kademlia distributed hash table](http://maude.sip.ucm.es/kademlia/files/pita_kademlia.pdf)