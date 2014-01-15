## Discover

This is a more detailed documentation that includes private methods for reference.

Node ids in Discover are represented as base64 encoded Strings. This is because the default generated node ids (SHA-1 hashes) could be unsafe to print. `base64` encoding was picked over `hex` encoding because it takes up less space when printed or serialized in ASCII over the wire.

  * [new Discover(options)](#new-discoveroptions)
  * [discover.executeQuery(query, callback)](#discoverexecutequeryquery-callback)
  * [discover.find(nodeId, callback, \[announce\])](#discoverfindnodeid-callback-announce)
  * [discover.findViaSeeds(nodeId, callback, \[announce\])](#discoverfindviaseedsnodeid-callback-announce)
  * [discover.getClosestContacts(nodeId, closestKBuckets)](#discovergetclosestcontactsnodeid-closestkbuckets)
  * [discover.getClosestKBuckets(nodeId)](#discovergetclosestkbucketsnodeid)
  * [discover.queryCompletionCheck(query, callback)](#discoverquerycompletioncheckquery-callback)
  * [discover.register(contact)](#discoverregistercontact)
  * [discover.trace(message)](#discovertracemessage)
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

#### discover.executeQuery(query, callback)

_**CAUTION: reserved for internal use**_

  * `query`: _Object_ Object containing query state for this request.
    * `nodeId`: _String (base64)_ Base64 encoded node id to find.
    * `nodes`: _Array_ `contact`s to query for `nodeId` arranged from closest to furthest
      * `node`:
        * `id`: _String (base64)_ Base64 encoded contact id.
    * `nodesMap`: _Object_ A map to the same `contact`s already present in `nodes` for O(1) access.
  * `callback`: _Function_ The callback to call with result.

Used internally by `discover.find()` to maintain query state when looking for a specific node on the network. It will launch up to `CONCURRENCY_CONSTANT` `findNode` requests via the `transport` and keep going until the node is found or there are no longer any nodes closer to it (not found). Additionally, this function reports unreachable and reached nodes to the appropriate `KBucket` which maintains the local node's awareness of the state of the network.

#### discover.find(nodeId, callback, [announce])

  * `nodeId`: _String (base64)_ The node id to find, base64 encoded.
  * `callback`: _Function_ The callback to call with the result of searching for `nodeId`.
  * `announce`: _Object_ _(Default: undefined)_ _**CAUTION: reserved for internal use**_ Contact object, if specified, it indicates an announcement to the network so we ask the network instead of satisfying request locally and the sender is the `announce` contact object.

The `callback` is called with the result of searching for `nodeId`. The result will be a `contact` containing `contact.id`, `contact.data`, `contact.transport` of the node. If an error occurs, only `error` will be provided.

```javascript
discover.find('bm9kZS5pZC50aGF0LmltLmxvb2tpbmcuZm9y', function (error, contact) {
    if (error) return console.error(error);
    console.dir(contact); 
});
```

#### discover.findViaSeeds(nodeId, callback, [announce])

_**CAUTION: reserved for internal use**_

  * `nodeId`: _String (base64)_ Base64 encoded node id to find.
  * `callback`: _Function_ The callback to call with the result of searching for `nodeId`.
  * `announce`: _Object_ _(Default: undefined)_ Contact object, if specified, it indicates an announcement and the sender is the `announce` contact object.

Uses `seeds` instead of closest contacts (because those don't exist) to find the node with `nodeId`. The `callback` is called with the result of searching for `nodeId`. The result will be a `contact` containing `contact.id` and `contact.data` of the node. If an error occurs, only `error` will be provided.

#### discover.getClosestContacts(nodeId, closestKBuckets)

_**CAUTION: reserved for internal use**_

  * `nodeId`: _String (base64)_ Base64 encoded node id to find closest contacts to.
  * `closestKBuckets`: _Array_ Sorted array of `KBucket`s from closest to furthest from `nodeId`.
  * Return: _Array_ List of closest contacts.

Retrieves maximum of three closest contacts from the closest `KBucket`.

#### discover.getClosestKBuckets(nodeId)

_**CAUTION: reserved for internal use**_

  * `nodeId`: _String (base64)_ Base64 encoded node id to find closest contacts to.
  * Return: _Array_ List of closest `KBucket`s.

Retrieves a sorted list of all `KBucket`s from closest to furthest.

#### discover.queryCompletionCheck(query, callback)

_**CAUTION: reserved for internal use**_

  * `query`: _Object_ Object containing query state for this request.
    * `nodeId`: _String (base64)_ Base64 encoded node id to find.
    * `nodes`: _Array_ `contact`s to query for `nodeId` arranged from closest to furthest.
      * `node`:
        * `id`: _String (base64)_ Base64 encoded contact id.
    * `nodesMap`: _Object_ A map to the same `contact`s already present in `nodes` for O(1) access.
  * `callback`: _Function_ The callback to call with result.

Checks if query completion criteria are met. If there are any new nodes to add to the query, organizes them accordingly and sets the query state to incorporate new node information. Stops and returns failure or success otherwise.

#### discover.register(contact)

  * `contact`: _Object_ Contact object to register.
    * `id`: _String (base64)_ _(Default: `crypto.randomBytes(20).toString('base64'`)_ The contact id, base 64 encoded; will be created if not present.
    * `data`: _Any_ Data to be included with the contact, it is guaranteed to be returned for anyone querying for this `contact` by `id`
    * `transport`: _Any_ _(Required for seeds only)_ Any data that the transport mechanism requires for operation.     
    * `vectorClock`: _Integer_ _(Default: 0)_ Vector clock to pair with node id.
  * Return: _Object_ Contact that was registered with `id` and `vectorClock` generated if necessary.

Registers a new node on the network with `contact.id`. Returns a `contact`:

```javascript
discover.register({
    id: 'Zm9v', // base64 encoded String representing nodeId
    data: 'foo',
    transport: {
        host: "foo.bar.com", // or "localhost", "127.0.0.1", etc...
        port: 6742
    },
    vectorClock: 0  // vector clock paired with the nodeId
});
```

_NOTE: Current implementation creates a new k-bucket for every registered node id. It is important to remember that a k-bucket could store up to k*lg(n) contacts, where lg is log base 2, n is the number of registered node ids on the network, and k is the size of each k-bucket (by default 20). For 1 billion registered nodes on the network, each k-bucket could store around 20 * lg (1,000,000,000) = ~ 598 contacts. This isn't bad, until you have 1 million local entities for a total of 598,000,000 contacts plus k-bucket overhead, which starts to put real pressure on Node.js/V8 memory limit._

#### discover.trace(message)

  * `message`: _String_ Message to trace.

Logs or emits a `~trace` for debugging purposes.

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