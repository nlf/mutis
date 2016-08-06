## mutis

mutexes for node.js, powered by redis


## usage

pass an already instantiated [redis](https://github.com/NodeRedis/node_redis) client to the constructor, you can then use the `.lock()` and `.unlock()` methods:

```js
'use strict';

const Redis = require('redis');
const Mutis = require('mutis');

const client = Redis.createClient();
const mutex = new Mutis(client);

mutex.lock('the_key_you_want_to_lock').then((unlock) => {
  // 'unlock' here is a convenience method to unlock the mutex you just used
  
  doSomething().then(() => {
    // alternatively you can use mutex.unlock('the_key_you_want_to_lock')
    return unlock();
  });
});
```

mutis will wait for the lock to be available before returning, by the time your `.then()` is called your lock is acquired.

you can pass a second argument to `.lock()` to be used as a timeout, for example:

```js
mutex.lock('my_key').then((unlock) => {
  // wait 1 second before unlocking
  setTimeout(() => {
    return unlock();
  }, 1000);

  mutex.lock('my_key', 500).then(() => {
    // this will never be reached since a timeout will occur
  }).catch((err) => {
    console.log(err instanceof Mutis.TimeoutError); // this will be true
  });
});
```

for additional usage examples, see the tests
