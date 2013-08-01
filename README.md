# discover

_Stability: 1 - [Experimental](https://github.com/tristanls/stability-index#stability-1---experimental)_

Discover is a distributed master-less node discovery mechanism that enables locating any entity (server, worker, drone, actor) based on node id. It enables point-to-point communications without pre-defined architecture.

## Installation

    npm install discover

## Tests

    npm test

## Overview

Discover is a distributed master-less node discovery mechanism that enables locating any entity (server, worker, drone, actor) based on node id. Discover is implemented using a stripped down version of the Kademlia DHT. It uses only the PING and FIND-NODE Kademlia protocol RPCs. (It leaves out STORE and FIND-VALUE). 

An enhancement on top of the Kademlia protocol implementation is the inclusion of optional _vector clocks_ in the discovery mechanism. The purpose of the vector clock is to account for rapid change in location of entities to be located. For example, if you rapidly migrate compute workers to different physical servers, vector clocks allow the distributed nodes to select between conflicting location reports by selecting the node with the corresponding id that also has the largest vector clock value. A better example (and initial use case) of rapidly shifting entities are actors within a distributed actor configuration.

Each Discover node is meant to store many entities that correspond to the same "physical" node. It functions as an external "gateway" of sorts to beyond the local environment. For example, if a process wants to send a message to another process that is on a remote system somewhere, Discover enables distributed master-less correlation of that process' id with it's physical location for message delivery (or delivery failure if it cannot be found).

It is worth highlighting that Discover is _only_ a discovery mechanism. You can find out where a node is (it's IP and port, for example), but to talk to it, you should have a way of doing that yourself.

## Documentation

### Discover

Node ids in Discover are represented as base64 encoded Strings. This is because the default generated node ids (SHA-1 hashes) could be unsafe to print. `base64` encoding was picked over `hex` encoding because it takes up less space when printed or serialized in ASCII over the wire.

#### new Discover(options)

  * `options`:
    * `seeds`: _Array_ _(Default: [])_ An array of seed `contact` Objects that the `transport` understands.
    * `transport`: _Object_ _(Default: `discover-tcp-transport`)_ An optional initialized and ready to use transport module for sending communications that conforms to the Transport Protocol. If `transport` is not provided, a new instance of `discover-tcp-transport` will be created and used with default settings.

Creates a new Discover instance.

The `seeds` are necessary if joining an existing Discover cluster. Discover will use these `seeds` to announce itself to other nodes in the cluster. If `seeds` are not provided, then it is assumed that this is a seed node, and other nodes will include this node's address in their `seeds` option. It all has to start somewhere.

#### discover.find(nodeId, callback)

  * `nodeId`: _String (base64)_ The node id to find, base64 encoded.
  * `callback`: _Function_ The callback to call with the result of searching for `nodeId`.

The `callback` is called with the result of searching for `nodeId`. The result will be a contact containing id, ip, and port of the node.

```javascript
discover.find('bm9kZS5pZC50aGF0LmltLmxvb2tpbmcuZm9y', function (error, contact) {
    if (error) return console.error(error);
    console.dir(contact); 
});
```

#### discover.register([nodeId], [vectorClock])

  * `nodeId`: _String (base64)_ _(Default: `crypto.createHash('sha1').digest()`)_ The node id to register, base64 encoded; will be converted to a Buffer
  * `vectorClock`: _Integer_ _(Default: 0)_ Vector clock to pair with node id.
  * Return: _Object_ Node id and vector clock that were registered (generated if `nodeId` or `vectorClock` not given).

Registers a new node on the network with the `nodeId`. Returns a `contact`:

```javascript
{
    nodeId: 'Zm9v', // base64 encoded String representing nodeId
    vectorClock: 0  // vector clock paired with the nodeId
}
```

_NOTE: Current implementation creates a new k-bucket for every registered node id. It is important to remember that a k-bucket could store up to k*lg(n) contacts, where lg is log base 2, n is the number of registered node ids on the network, and k is the size of each k-bucket (by default 20). For 1 billion registered nodes on the network, each k-bucket could store around 20 * lg (1,000,000,000) = ~ 598 contacts. This isn't bad, until you have 1 million local entities for a total of 598,000,000 contacts plus k-bucket overhead, which starts to put real pressure on Node.js/V8 memory limit._

#### discover.unregister(nodeId);

  * `nodeId`: _String (base64)_ The previously registered nodeId, base64 encoded.

Unregisters previously registered `nodeId` from the network.

### Transport Interface

Modules implementing the transport mechanism for Discover shall conform to the following interface. A `transport` is a JavaScript object.

Transport implementations shall ensure that `contact.id` and `contact.data` will be immutable and will pass through the transportation system without modification (`contact` objects are passed through the transportation system when responding to FIND-NODE requests).

For reference implementation, see [discover-tcp-transport](https://github.com/tristanls/node-discover-tcp-transport).

_NOTE: Unreachability of nodes depends on the transport. For example, transports ,like TLS transport, could use invalid certificate criteria for reporting unreachable nodes._

_**WARNING**: Using TCP transport is meant primarily for development in a development environment. TCP transport exists because it is a low hanging fruit. It is most likely that it should be replaced with DTLS transport in production (maybe TLS if DTLS is not viable). There may also be a use-case for using UDP transport if communicating nodes are on a VPN/VPC. Only if UDP on a VPN/VPC seems not viable, should TCP transport be considered._

#### transport.findNode(contact, nodeId)

  * `contact`: _Object_ The node to contact with request to find `nodeId`
    * `id`: _String (base64)_ Base64 encoded contact node id
  * `nodeId`: _String (base64)_ Base64 encoded string representation of the node id to find

Issues a FIND-NODE request to the `contact`. Response, timeout, errors, or otherwise shall be communicated by emitting a `node` event.

#### transport.ping(contact)

  * `contact`: _Object_ contact to ping
    * `id`: _String (base64)_ Base64 encoded contact node id

Issues a PING request to the `contact`. The transport will emit `unreachable` event if the `contact` is unreachable, or `reached` event otherwise.

#### Event: `findNode`

  * `nodeId`: _String (base64)_ Base64 encoded string representation of the node id to find
  * `callback`: _Function_ The callback to call with the result of processing the FIND-NODE request
    * `error`: _Error_ if any
    * `response`: _Object_ or _Array_ The response to FIND-NODE request

Emitted when another node issues a FIND-NODE request to this node.

```javascript
transport.on('findNode', function (nodeId, callback) {
    // this node knows the node with nodeId or is itself node with nodeId
    var error = null;
    return callback(error, contactWithNodeId);
});
```

A single `contactWithNodeId` shall be returned with the information identifying the contact corresponding to requested `nodeId`.

```javascript
transport.on('findNode', function (nodeId, callback) {
    // nodeId is unknown to this node, so it returns an array of nodes closer to it
    var error = null;
    return callback(error, closestContacts); 
});
```

An Array of `closestContacts` shall be returned if the `nodeId` is unknown to this node.

If an error occurs and a request cannot be fulfilled, an error should be passed to the callback.

```javascript
transport.on('findNode', function (nodeId, callback) {
    // some error happened
    return callback(new Error("oh no!")); 
});
```

#### Event: `node`

  * `error`: _Error_ An error, if one occurred
  * `contact`: _Object_ The node that FIND-NODE request was sent to
  * `nodeId`: _String_ The original node id requested to be found
  * `response`: _Object_ or _Array_ The response from the queried `contact`

If `error` occurs, the transport encountered an error when issuing the `findNode` request to the `contact`. 

`response` will be an Array if the `contact` does not contain the `nodeId` requested. In this case `response` will be a `contact` list of nodes closer to the `nodeId` that the queried node is aware of. The usual step is to next query the returned contacts with the FIND-NODE request.

`response` will be an Object if the `contact` knows of the `nodeId`. In other words, the node has been found, and `response` is a `contact` object.

#### Event: `reached`

  * `contact`: _Object_ The contact that was reached when pinged.
      * `id`: _String (base64)_ Base64 encoded contact node id

Emitted when a previously pinged `contact` is deemed reachable by the transport.

#### Event: `unreachable`

  * `contact`: _Object_ The contact that was unreachable when pinged.
      * `id`: _String (base64)_ Base64 encoded contact node id

Emitted when a previously pinged `contact` is deemed unreachable by the transport.

## Road Map

### Which K-Bucket to use for lookup?

When a transport emits a `findNode` event and none of the registered nodes correspond to the queried node, which k-bucket out of all the registered nodes should be queried? `k-bucket@0.2.0` now exposes `KBucket.distance()`, which ought to enable Discover to find the closest node that it has, and then query that k-bucket for closest nodes to be found.

### Multiple Transports

There is really nothing that I immediately see that would be preventing use of multiple transports. It may be useful to implement a `contact.transport` field to specify which transport to use/prefer. For example:

```javascript
{
    ip: '127.0.0.1',
    port: '1234',
    transport: 'tcp'
}
// or
{
    hostname: 'localhost',
    port: 80,
    transport: 'http'
}
// or maybe something like...
{
    ip: '127.0.0.1',
    port: '1234',
    transport: ['dtls', 'tls', 'tcp']
    dtls: {
        ip: '127.0.0.1',
        port: '4321'
    }
}
```

## Sources

The implementation has been sourced from:

  - [A formal specification of the Kademlia distributed hash table](http://maude.sip.ucm.es/kademlia/files/pita_kademlia.pdf)