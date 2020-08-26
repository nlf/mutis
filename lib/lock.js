'use strict'

const Errors = require('./errors')

class Lock {
  constructor ({ start, expires, key, client }) {
    this.client = client
    this.start = start
    this.expires = expires
    this.key = key
    this.unlocked = false
  }

  async unlock () {
    if (Date.now() - this.expires > 0) {
      throw new Errors.ExpiredLockError({ key: this.key })
    }

    if (this.unlocked) {
      throw new Errors.AlreadyUnlockedError({ key: this.key })
    }

    this.unlocked = true
    return this.client.del(`${this.key}._lock`)
  }
}

module.exports = Lock
