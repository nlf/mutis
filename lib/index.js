'use strict';

const Promise = require('bluebird');

class Mutis {
  constructor(client) {

    // duplicate the client so we don't mess with what the user passes us
    this._client = client.duplicate();
    Promise.promisifyAll(this._client);
  }

  _setImmediate() {

    return new Promise((resolve) => {

      setImmediate(() => {

        return resolve();
      });
    });
  }

  _wait(key, timeout) {

    const lock = `${key}._lock`;
    const delay = this._setImmediate().then(() => {

      return this._client.existsAsync(lock);
    }).then((exists) => {

      if (!exists) {
        return;
      }

      return this._wait(key);
    });

    return timeout ? delay.timeout(timeout) : delay;
  }

  lock(key, timeout) {

    const lock = `${key}._lock`;
    return this._wait(key, timeout).then(() => {

      return this._client.setAsync(lock, 'locked');
    }).then(() => {

      return () => {

        return this.unlock(key);
      };
    });
  }

  unlock(key) {

    const lock = `${key}._lock`;
    return this._client.delAsync(lock);
  }
}

Mutis.TimeoutError = Promise.TimeoutError;

module.exports = Mutis;
