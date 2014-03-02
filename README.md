# discover

_Stability: 2 - [Unstable](https://github.com/tristanls/stability-index#stability-2---unstable)_

[![NPM version](https://badge.fury.io/js/discover.png)](http://npmjs.org/package/discover)

Discover is a distributed master-less node discovery mechanism that enables locating any entity (server, worker, drone, actor) based on node id. It enables point-to-point communications without pre-defined architecture.

## Contributors

[@tristanls](https://github.com/tristanls), [@mikedeboer](https://github.com/mikedeboer), [@skeggse](https://github.com/skeggse)

## Contents

  * [Installation](#installation)
  * [Tests](#tests)
  * [Overview](#overview)
  * [Documentation](#documentation)
    * [Discover](#discover-1)
    * [Transport Interface](#transport-interface)
  * [Road Map](#road-map)
  * [Sources](#sources)

## Installation

    npm install discover

## Tests

### Unit Tests

    npm test

### Localhost Visual Trace Test

    npm run-script localtest

## Overview

Discover is a distributed master-less node discovery mechanism that enables locating any entity (server, worker, drone, actor) based on node id. It enables point-to-point communications without pre-defined architecture and without a centralized router or centralized messaging.

It is worth highlighting that Discover is _only_ a discovery mechanism. You can find out where a node is located (it's hostname and port, for example), but to communicate with it, you should have a way of doing that yourself.

Each Discover instance stores information on numerous nodes. Each instance also functions as an external "gateway" of sorts to beyond the local environment. For example, if a local process wants to send a message to a remote process somewhere, Discover enables distributed master-less correlation of that remote process' node id with it's physical location so that a point-to-point link can be made (or failure reported if the contact cannot be located).

### Contacts

Discover manages information about _nodes_ via maintaining node information in a structure called a _contact_. A contact stores the details of a particular node on the network.

A contact is a JavaScript object that consists of `contact.id`, `contact.data`, and `contact.transport`. The `id` and `data` are the only properties that are guaranteed not to be changed by Discover.

  * `id`: _String (base64)_ A globally unique Base64 encoded node id.
  * `data`: _Any_ Any data that should be included with this contact when it is retrieved by others on the network. This should be a "serializable" structure (no circular references) so that it can be `JSON.stringify()`ed.
  * `transport`: _Any_ Any data that the transport mechanism requires for operation. Similarly to `data`, it should be a "serializable" structure so that it can be `JSON.stringify()`ed.

Example contact with TCP Transport information:

```javascript
var contact = {
    id: "Zm9v", // Base64 encoded String representing node id
    data: "foo", // any data (could be {foo: "bar"}, or ["foo", "bar"], etc.)
    transport: {
        host: "foo.bar.com", // or "localhost", "127.0.0.1", etc...
        port: 6742
    }
};
```

### Use of `contact.transport`

The transport data is only required for contact's that are _seeds_. That is, their transport information is known ahead of time so that a Discover node can connect to them. For all non-seed contacts, the `contact.transport` will be provided by the particular transport implementation.

### Use of `contact.data`

As explained below in [Technical Origin Details](#technical-origin-details), Discover is intended to implement only PING and FIND-NODE RPCs. This reflects the intent of Discover to be a discovery mechanism and not a data storage/distribution mechanism. It is important to keep that in mind when using `contact.data`.

The existence of `contact.data` is to support the discovery mechanism. Given that `contact.transport` contains information for how a Discover transport can connect to another Discover transport, this is not very useful if one is trying to figure out the endpoint address of another node for application level purposes. It may not correspond at all to what's in `contact.transport`. The intended use of `contact.data` is to store a **minimal** amount of information required for connecting to the node endpoint for the application's purpose.

For example, if we want a DNS-like functionality, we could look for a contact with id of `my.secret.dns.com`. This could correspond to the following contact:

```javascript
var contact = {
    id: "bXkuc2VjcmV0LmRucy5jb20=", // Base64 encoding of "my.secret.dns.com"
    data: {
        host: "10.22.1.37",
        port: 8080
    },
    transport: {
        host: "10.22.1.37",
        port: 6742
    }
};
```

This would tell us that we can connect to `my.secret.dns.com` at IP address `10.22.1.37` and port `8080`.

As another example and to illustrate perhaps less familiar intents, if we want to find an actor "receptionist" in the global actor system, we could look for a contact that looks like this:

```javascript
var contact = {
    id: "tmqjRAfBILbEC6aaHoz3AurtluM=", // Base64 encoded receptionist address
    data: {
        webkey: "c9bf857b35ed4750ca35c0a4f41e56644df59547",
        host: "10.13.211.201",
        port: 9999,
        publicKey: "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"
    },
    transport: {
        host: "10.13.211.201",
        port: 6742
    }
};
```

This would tell us that we can access the actor using the published webkey at IP address `10.13.211.201` and port `9999` and to encrypt our communication using provided public key.

Uses of `contact.data` that are not "minimal" in this way can result in poor system behavior.

### Arbiter function and arbiter defaults

Discover implements a conflict resolution mechanism using an `arbiter` function. The purpose of the `arbiter` is to choose between two `contact` objects with the same `id` but perhaps different properties and determine which one should be stored.  As the `arbiter` function returns the actual object to be stored, it does not need to make an either/or choice, but instead could perform some sort of operation and return the result as a new object that would then be stored. `arbiterDefaults` function makes sure that `contact` has the appropriate defualt properties for the `arbiter` function to work correctly.

`arbiter` function is used in three places. First, it is used as the k-bucket `arbiter` function. Second, it is used to determine whether a new remote contact should be inserted into the LRU cache (if `arbiter` returns something `!==` to the cached contact the remote contact will be inserted). Third, it is used to determine if unregistering a contact will succeed (if `arbiter` returns contact `===` to the stored contact and stored contact `!==` contact we want to unregister, then unregister will fail).

For example, an `arbiter` function implementing a `vectorClock` mechanism (the default mechanism) would look something like:

```javascript
// contact example
var contact = {
    id: new Buffer('contactId'),
    vectorClock: 0
};

function arbiterDefaults(contact) {
    if (!contact.vectorClock) {
        contact.vectorClock = 0;
    }
    return contact;
};

function arbiter(incumbent, candidate) {
    if (!incumbent
        || (incumbent && !incumbent.vectorClock)
        || (incumbent && incumbent.vectorClock && candidate.vectorClock
            && (candidate.vectorClock >= incumbent.vectorClock))) {

        return candidate;
    }
    return incumbent;
};
```

_NOTE: `contact.vectorClock` is not guaranteed to be passed by the transport. This is a known bug. See [#9](https://github.com/tristanls/discover/issues/9) for updates._

Alternatively, consider an arbiter that implements a Grow-Only-Set CRDT mechanism:

```javascript
// contact example
var contact = {
    id: new Buffer('workerService'),
    data: {
        workerNodes: {
            '17asdaf7effa2': { host: '127.0.0.1', port: 1337 },
            '17djsyqeryasu': { host: '127.0.0.1', port: 1338 }
        }
    }
};

function arbiterDefaults(contact) {
    if (!contact.data) {
        contact.data = {};
    }
    if (!contact.data.workerNodes) {
        contact.data.workerNodes = {};
    }
    return contact;
};

function arbiter(incumbent, candidate) {
    if (!incumbent || !incumbent.data || !incumbent.data.workerNodes) {
        return candidate;
    }

    if (!candidate || !candidate.data || !candidate.data.workerNodes) {
        return incumbent;
    }

    // we create a new object so that our selection is guaranteed to replace
    // the incumbent
    var merged = {
        id: incumbent.id, // incumbent.id === candidate.id within an arbiter
        data: {
            workerNodes: incumbent.data.workerNodes
        }
    };

    Object.keys(candidate.data.workerNodes).forEach(function (workerNodeId) {
        merged.data.workerNodes[workerNodeId] =
            candidate.data.workerNodes[workerNodeId];
    });

    return merged;
}
```

Notice that in the above case, the Grow-Only-Set assumes that each worker node has a globally unique id and that each value for a worker node id will be written only once.

### Technical Origin Details

Discover is implemented using a stripped down version of the Kademlia Distributed Hash Table (DHT). It uses only the PING and FIND-NODE Kademlia protocol RPCs. (It leaves out STORE and FIND-VALUE).

An enhancement on top of the Kademlia protocol implementation is the inclusion of an arbiter function in the discovery mechanism. See [Arbiter function and arbiter details](#arbiter-function-and-arbiter-defaults) for more detailed explanation.

### Why Discover?

There are three reasons.

Discover grew out of my experience with building messaging for a Node.js Platform as a Service based on an Actor Model of Computation. I did not like having a centralized messaging service that could bring down the entire platform. Messaging should be decentralized, which led to a Kademlia DHT-based implementation. _see: [Technical Origin Details](#technical-origin-details)_

Every Kademlia DHT implementation I came across in Node.js community tightly coupled the procotocol implementation with the transport implementation.

Lastly, I wanted to learn and commit to intuition the implementation of Kademlia DHT so that I can apply that knowledge in other projects.

## Documentation

### Discover

Node ids in Discover are represented as base64 encoded Strings. This is because the default generated node ids (20 random bytes) could be unsafe to print. `base64` encoding was picked over `hex` encoding because it takes up less space when printed or serialized in ASCII over the wire.

_For more detailed documentation including private methods see [Discover doc](docs/Discover.md)_

**Public API**

  * [new Discover(options)](#new-discoveroptions)
  * [discover.add(remoteContact)](#discoveraddremotecontact)
  * [discover.find(nodeId, callback, \[announce\])](#discoverfindnodeid-callback-announce)
  * [discover.register(contact)](#discoverregistercontact)
  * [discover.unreachable(contact)](#discoverunreachablecontact)
  * [discover.unregister(contact)](#discoverunregistercontact)
  * [Event 'stats.timers.find.ms'](#event-statstimersfindms)
  * [Event 'stats.timers.find.request.ms'](#event-statstimersfindrequestms)
  * [Event 'stats.timers.find.round.ms'](#event-statstimersfindroundms)

### new Discover(options)

  * `options`:
    * `CONCURRENCY_CONSTANT`: _Integer_ _(Default: 3)_ Number of concurrent FIND-NODE requests to the network per `find` request.
    * `arbiter`: _Function_ _(Default: vector clock arbiter)_ `function (incumbent, candidate) {}` An optional arbiter function. `arbiter` function is used in three places. First, it is used as the k-bucket `arbiter` function. Second, it is used to determine whether a new remote contact should be inserted into the LRU cache (if `arbiter` returns something `!==` to the cached contact the remote contact will be inserted). Third, it is used to determine if unregistering a contact will succeed (if `arbiter` returns contact `===` to the stored contact, unregister will fail).
    * `arbiterDefaults`: _Function_ _(Default: vector clock arbiter defaults)_ `function (contact) {}` An optional arbiter defaults function that sets `contact` arbiter defaults when a `contact` is first registered. Remote contacts that are added via `add` are assumed to have appropriate arbiter properties already set.
    * `eventTrace`: _Boolean_ _(Default: false)_ If set to `true`, Discover will emit `~trace` events for debugging purposes.
    * `inlineTrace`: _Boolean_ _(Default: false)_ If set to `true`, Discover will log to console `~trace` messages for debugging purposes.
    * `maxCacheSize`: _Number_ _(Default: 1000)_ Maximum number of `contacts` to keep in non-kBucket cache (see #6)
    * `noCache`: _Boolean_ _(Default: false)_ If `true`, non-kBucket cache is not used.
    * `seeds`: _Array_ _(Default: [])_ An array of seed `contact` Objects that the `transport` understands.
    * `transport`: _Object_ _(Default: `discover-tcp-transport`)_ An optional initialized and ready to use transport module for sending communications that conforms to the Transport Protocol. If `transport` is not provided, a new instance of `discover-tcp-transport` will be created and used with default settings.

Creates a new Discover instance.

The `seeds` are necessary if joining an existing Discover cluster. Discover will use these `seeds` to announce itself to other nodes in the cluster. If `seeds` are not provided, then it is assumed that this is a seed node, and other nodes will include this node's address in their `seeds` option. It all has to start somewhere.

### discover.add(remoteContact)

  * `remoteContact`: _Object_ Contact object to add that is not managed by this Discover node.
    * `id`: _String (base64)_ The contact id, base64 encoded.
    * `data`: _Any_ Data to be included with the contact, it is guaranteed to be returned for anyone querying for this `contact` by `id`.
  * Return: _Object_ Contact that was added.

Adds the `remoteContact`. This is different from `discover.register(contact)` in that adding a `remoteContact` means that the `remoteContact` _is not_ managed by this Discover node.

The use-case motivating existence of this method is being able to hint where to send a response in a request-response type of asynchronous messaging between nodes that are part of the same Discover DHT. More precisely:

  1. Server A creates a contact Alpha and registers it with Discover.
  2. Server A queries Discover to find contact Beta (already existing).
  3. Discover responds that contact Beta is on Server B.
  4. Server A sends a message to contact Beta (on Server B) expecting a response to contact Alpha.
  5. Server B wants to respond to Alpha "quickly". At this point, the contact Alpha information has not propagated through the DHT, so Server B will have to wait for it's Discover instance to query the DHT and make multiple trips looking for contact Alpha.

In order to "speed up" step 5 above, we'd like to be able to hint information that is known, but maybe has not propagated yet. This means, that as part of step 4 above, we could also send a "hint" containing information on contact Alpha. This way, when Server B receives the message with a "hint", it can use `discover.add(remoteContact)` to populate it's local Discover cache without additional network traffic.

### discover.find(nodeId, callback, [announce])

  * `nodeId`: _String (base64)_ The node id to find, base64 encoded.
  * `callback`: _Function_ The callback to call with the result of searching for `nodeId`.
  * `announce`: _Object_ _(Default: undefined)_ _**CAUTION: reserved for internal use**_ Contact object, if specified, it indicates an announcement to the network so we ask the network instead of satisfying request locally and the sender is the `announce` contact object.

The `callback` is called with the result of searching for `nodeId`. The result will be a `contact` containing `contact.id`, `contact.data`, and `contact.transport` of the node. If an error occurs, only `error` will be provided.

```javascript
discover.find('bm9kZS5pZC50aGF0LmltLmxvb2tpbmcuZm9y', function (error, contact) {
    if (error) return console.error(error);
    console.dir(contact);
});
```

### discover.register(contact)

  * `contact`: _Object_ Contact object to register.
    * `id`: _String (base64)_ _(Default: `crypto.randomBytes(20).toString('base64'`)_ The contact id, base 64 encoded; will be created if not present.
    * `data`: _Any_ Data to be included with the contact, it is guaranteed to be returned for anyone querying for this `contact` by `id`.
  * Return: _Object_ Contact that was registered with `id` and generated arbiter defaults if necessary.

Registers a new node on the network with `contact.id`. Returns a `contact`:

```javascript
discover.register({
    id: 'Zm9v', // base64 encoded String representing nodeId
    data: 'foo'
});
```

_NOTE: Current implementation creates a new k-bucket for every registered node id. It is important to remember that a k-bucket could store up to k*lg(n) contacts, where lg is log base 2, n is the number of registered node ids on the network, and k is the size of each k-bucket (by default 20). For 1 billion registered nodes on the network, each k-bucket could store around 20 * lg (1,000,000,000) = ~ 598 contacts. This isn't bad, until you have 1 million local entities for a total of 598,000,000 contacts plus k-bucket overhead, which starts to put real pressure on Node.js/V8 memory limit._

### discover.unreachable(contact)

  * `contact`: _Object_ Contact object to report unreachable
    * `id`: _String (base64)_ The previously registered contact id, base 64 encoded.

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

### discover.unregister(contact)

  * `contact`: _Object_ Contact object to register
    * `id`: _String (base64)_ The previously registered contact id, base 64 encoded.

Unregisters previously registered `contact` (if `arbiter` returns `contact` and not other stored value) from the network.

#### Event: `stats.timers.find.ms`

  * `function (latency) {}`
    * `latency`: _Number_ Latency of `discover.find()` in milliseconds.

#### Event: `stats.timers.find.request.ms`

  * `function (latency) {}`
    * `latency`: _Number_ Latency of a single request to another Discover noder as part of a round of `discover.find()` DHT lookups.

#### Event: `stats.timers.find.round.ms`

  * `function (latency) {}`
    * `latency`: _Number_ Latency of a single round of `discover.find()` DHT lookups in milliseconds.

### Transport Interface

Modules implementing the transport mechanism for Discover shall conform to the following interface. A `transport` is a JavaScript object.

Transport implementations shall ensure that `contact.id` and `contact.data` will be immutable and will pass through the transportation system without modification (`contact` objects are passed through the transportation system during FIND-NODE and PING requests).

Transport has full dominion over `contact.transport` property.

Transport implementations shall allow registering and interacting with event listeners as provided by `events.EventEmitter` interface.

For reference implementation, see [discover-tcp-transport](https://github.com/tristanls/node-discover-tcp-transport).

_NOTE: Unreachability of nodes depends on the transport. For example, transports ,like TLS transport, could use invalid certificate criteria for reporting unreachable nodes._

_**WARNING**: Using TCP transport is meant primarily for development in a development environment. TCP transport exists because it is a low hanging fruit. It is most likely that it should be replaced with DTLS transport in production (maybe TLS if DTLS is not viable). There may also be a use-case for using UDP transport if communicating nodes are on a VPN/VPC. Only if UDP on a VPN/VPC seems not viable, should TCP transport be considered._

**Transport Interface Specification**

  * [transport.findNode(contact, nodeId, sender)](#transportfindnodecontact-nodeid-sender)
  * [transport.ping(contact, sender)](#transportpingcontact-sender)
  * [transport.setTransportInfo(contact)](#transportsettransportinfocontact)
  * [Event 'findNode'](#event-findnode)
  * [Event 'node'](#event-node)
  * [Event 'ping'](#event-ping)
  * [Event 'reached'](#event-reached)
  * [Event 'unreachable'](#event-unreachable)

### transport.findNode(contact, nodeId, sender)

  * `contact`: _Object_ The node to contact with request to find `nodeId`.
    * `id`: _String (base64)_ Base64 encoded contact node id.
    * `transport`: _Any_ Any data that the transport mechanism requires for operation.
  * `nodeId`: _String (base64)_ Base64 encoded string representation of the node id to find.
  * `sender`: _Object_ The sender of this request.
    * `id`: _String (base64)_ Base64 encoded sender id.
    * `data`: _Any_ Sender data.
    * `transport`: _Any_ Any data that the transport mechanism requires for operation.

Issues a FIND-NODE request to the `contact`. Response, timeout, errors, or otherwise shall be communicated by emitting a `node` event.

### transport.ping(contact, sender)

  * `contact`: _Object_ Contact to ping.
    * `id`: _String (base64)_ Base64 encoded contact node id.
    * `transport`: _Any_ Any data that the transport mechanism requires for operation.
  * `sender`: _Object_ The sender of this request.
    * `id`: _String (base64)_ Base64 encoded sender id.
    * `data`: _Any_ Sender data.
    * `transport`: _Any_ Any data that the transport mechanism requires for operation.

Issues a PING request to the `contact`. The transport will emit `unreachable` event if the `contact` is unreachable, or `reached` event otherwise.

#### transport.setTransportInfo(contact)

  * `contact`: _Object_ A contact.
  * Return: _Object_ `contact` with `contact.transport` populated.

Sets `contact.transport` to transport configured values.

#### Event: `findNode`

  * `nodeId`: _String (base64)_ Base64 encoded string representation of the node id to find.
  * `sender`: _Object_ The contact making the request.
    * `id`: _String (base64)_ Base64 encoded sender id.
    * `data`: _Any_ Sender data.
    * `transport`: _Any_ Any data that the transport mechanism requires for operation.
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

### Event: `node`

  * `error`: _Error_ An error, if one occurred.
  * `contact`: _Object_ The node that FIND-NODE request was sent to.
  * `nodeId`: _String_ The original node id requested to be found.
  * `response`: _Object_ or _Array_ The response from the queried `contact`.

If `error` occurs, the transport encountered an error when issuing the `findNode` request to the `contact`. `contact` and `nodeId` will also be provided in case of an error. `response` is to be undefined if an `error` occurs.

`response` will be an Array if the `contact` does not contain the `nodeId` requested. In this case `response` will be a `contact` list of nodes closer to the `nodeId` that the queried node is aware of. The usual step is to next query the returned contacts with the FIND-NODE request.

`response` will be an Object if the `contact` knows of the `nodeId`. In other words, the node has been found, and `response` is a `contact` object.

### Event: `ping`

  * `nodeId`: _String (base64)_ Base64 encoded string representation of the node id being pinged.
  * `sender`: _Object_ The contact making the request.
    * `id`: _String (base64)_ Base64 encoded sender node id.
    * `data`: _Any_ Sender node data.
    * `transport`: _Any_ Any data that the transport mechanism requires for operation.
  * `callback`: _Function_ The callback to call with the result of processing the PING request.
    * `error`: _Error_ An error, if any.
    * `response`: _Object_ or _Array_ The response to PING request, if any.

Emitted when another node issues a PING request to this node.

```javascript
transport.on('ping', function (nodeId, sender, callback) {
    // ... verify that we have the exact node specified by nodeId
    return callback(null, contact);
});
```

In the above example `contact` is an Object representing the answer to `ping` query.

If the exact node specified by nodeId does not exist, an error shall be returned as shown below:

```javascript
transport.on('ping', function (nodeId, sender, callback) {
    // ...we don't have the nodeId specified
    return callback(true);
});
```

### Event: `reached`

  * `contact`: _Object_ The contact that was reached when pinged.
    * `id`: _String (base64)_ Base64 encoded contact node id.
    * `data`: _Any_ Data included with the contact.
    * `transport`: _Any_ Any data that the transport mechanism requires for operation.

Emitted when a previously pinged `contact` is deemed reachable by the transport.

### Event: `unreachable`

  * `contact`: _Object_ The contact that was unreachable when pinged.
    * `id`: _String (base64)_ Base64 encoded contact node id.
    * `transport`: _Any_ Any data that the transport mechanism requires for operation.

Emitted when a previously pinged `contact` is deemed unreachable by the transport.

## Road Map

### Immediate concerns

This is roughly in order of current priority:

  * **Update Transport Interface**: The transport interface should probably guarantee immutability and pass through of `contact.arbiter` property (much like it does right now for `contact.id` and `contact.data`). See [#9](https://github.com/tristanls/discover/issues/9) for more details.
  * **Implementation Correctness**: Gain confidence that the protocol functions as expected. This should involve running a lot of nodes and measuring information distribution latency and accuracy.
  * **TLS Transport** _(separate module)_ or it might make sense to change the TCP Transport into Net Transport and include within both TCP and TLS.
  * **UDP Transport** _(separate module)_
  * **DTLS Transport** _(separate module)_
  * **Less destructive unregister**: Currently, `discover.unregister(contact)` deletes all "closest" contact information that was gathered within the k-bucket corresponding to the `contact`. This throws away DHT information stored there. An elaboration would be to distribute known contacts to other k-buckets when a `contact` is unregistered.
  * **Performance**: Make it fast and small.
    * **discover.kBuckets**: It should be a datastructure with _O(log n)_ operations.
  * **Storage Refactoring**: There emerged (obvious in retrospect) a "storage" abstraction during the implementation of `discover` that is higher level than a `k-bucket` but that still seems to be worth extracting.
      * _24 Sep 2013:_ Despite a storage abstraction, it is not straightforward to separate out due to the 'ping' interaction between `k-bucket` and transport. KBucket storage implementation would have to pass some sort of token to Discover in order to remove an old contact form the correct KBucket (a closer KBucket could be registered while pinging is happening), but this exposes internal implementation, the hiding of which, was the point of abstracting a storage mechanism. It is also a very KBucket specific mechanism that I have difficulty generalizing to a common "storage" interface. Additionally, I am hard pressed to see Discover working well with non-k-bucket storage. Thusly, storage refactoring is no longer a priority.

### Other considerations

This is a non-exclusive list of some of the highlights to keep in mind and maybe implement if opportunity presents itself.

#### Settle the vocabulary

Throughout Discover, the transport, and the k-bucket implementations, the vocabulary is inconsistent (in particular the usage of "contact", "node", "network", and "DHT"). Once the implementation settles and it becomes obvious what belongs where, it will be helpful to have a common, unifying way to refer to everything.

## Sources

The implementation has been sourced from:

  - [A formal specification of the Kademlia distributed hash table](http://maude.sip.ucm.es/kademlia/files/pita_kademlia.pdf)

### Background Reading

  - [Eventually Consistent: Not What You Were Expecting?](http://queue.acm.org/detail.cfm?id=2582994)
