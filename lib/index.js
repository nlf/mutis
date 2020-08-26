'use strict'

const Redis = require('ioredis')

const Lock = require('./lock')
const Errors = require('./errors')

const defaultOptions = {
  ttl: 5 * 60 * 1000, // 5 minutes
  ttlDrift: 100, // 100ms
  timeout: 30 * 1000, // 30 seconds
  retryDelay: 1000 // 1 second
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class Mutis {
  constructor (options = {}) {
    this.client = new Redis(options.connection)
    this.options = Object.assign({}, defaultOptions, options)
  }

  async lock (key, options = {}, start = Date.now()) {
    const lockKey = `${key}._lock`
    const now = Date.now()
    const timeout = options.timeout || this.options.timeout
    if (now - start > timeout) {
      throw new Errors.LockTimeoutError({ key, timeout })
    }

    const expires = now + (options.ttl || this.options.ttl)
    const lockAcquired = await this.client.setnx(lockKey, expires)
    // the lock was already free, so it's ours now
    if (lockAcquired) {
      return new Lock({ start, expires, key, client: this.client })
    }

    // get the current value of the lock and save it
    const currentLock = await this.client.get(lockKey)

    // the lock is held, but is beyond the configured timeout
    if (currentLock && now - currentLock > this.options.ttlDrift) {
      const newLock = await this.client.getset(lockKey, expires)
      // the lock is now ours
      if (newLock === currentLock) {
        return new Lock({ start, expires, key, client: this.client })
      }
    }

    // we were unable to retrieve the lock, so delay and try again from the top
    await delay(this.options.retryDelay + Math.floor(Math.random() * this.options.retryDelay))
    return this.lock(key, options, start)
  }

  quit () {
    return this.client.quit()
  }
}

module.exports = Mutis
