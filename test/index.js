'use strict'

const Redis = require('ioredis')

const Mutis = require('../')
const Lock = require('../lib/lock')
const Errors = require('../lib/errors')

const settings = { connection: process.env.REDIS_URL || 'redis://127.0.0.1:6379', retryDelay: 50 }
const redis = new Redis(settings.connection)
const mutis = new Mutis(settings)
const mutisB = new Mutis(settings)

const { after, afterEach, describe, it } = exports.lab = require('@hapi/lab').script()
const { expect } = require('@hapi/code')

describe('mutis.lock()', () => {
  after(() => {
    return Promise.all([
      redis.quit(),
      mutis.quit(),
      mutisB.quit()
    ])
  })

  afterEach(() => {
    return redis.del('test._lock')
  })

  it('can lock a key', async () => {
    const lock = await mutis.lock('test')
    expect(lock).to.be.an.instanceof(Lock)
    const expiry = await redis.get('test._lock')
    expect(Number(expiry)).to.equal(lock.expires)
  })

  it('can unlock a key', async () => {
    const lock = await mutis.lock('test')
    expect(lock).to.be.an.instanceof(Lock)
    await lock.unlock()
    const expiry = await redis.get('test._lock')
    expect(expiry).to.equal(null)
  })

  it('waits for a lock', async () => {
    const lock = await mutis.lock('test')
    const start = Date.now()
    setTimeout(() => lock.unlock(), 75)
    await mutis.lock('test')
    const delay = Date.now() - start
    expect(delay).to.be.above(75)
  })

  it('will take over a lock that has expired', async () => {
    await mutis.lock('test', { ttl: 50 })
    const start = Date.now()
    const second = await mutisB.lock('test')
    const elapsed = Date.now() - start
    expect(elapsed).to.be.above(50)
    const value = await redis.get('test._lock')
    expect(second.expires).to.equal(Number(value))
  })

  it('respects timeout value when waiting for a lock', async () => {
    await mutis.lock('test')
    const start = Date.now()
    const err = await expect(mutis.lock('test', { timeout: 10 })).to.reject(Errors.LockTimeoutError)
    const elapsed = Date.now() - start
    expect(err.key).to.equal('test')
    expect(err.timeout).to.equal(10)
    expect(elapsed).to.be.above(10)
  })

  it('rejects when attempting to free twice', async () => {
    const lock = await mutis.lock('test')
    await lock.unlock()
    const err = await expect(lock.unlock()).to.reject(Errors.AlreadyUnlockedError)
    expect(err.key).to.equal('test')
  })

  it('rejects when attempting to free an expired lock', async () => {
    const lock = await mutis.lock('test', { ttl: 50 })
    await new Promise((resolve) => setTimeout(resolve, 75))
    const err = await expect(lock.unlock()).to.reject(Errors.ExpiredLockError)
    expect(err.key).to.equal('test')
  })

  it('will retry acquiring a lock if it is freed after SETNX fails', async (flags) => {
    flags.onCleanup = () => {
      if (mutis.client._get) {
        mutis.client.get = mutis.client._get
        delete mutis.client._get
      }
    }

    await mutis.lock('test')
    mutis.client._get = mutis.client.get
    mutis.client.get = async (...args) => {
      mutis.client.get = mutis.client._get
      delete mutis.client._get
      await redis.del('test._lock')
      return null
    }

    const lock = await mutis.lock('test')
    const value = await redis.get('test._lock')
    expect(lock.expires).to.equal(Number(value))
  })

  it('will retry acquiring a lock if it is overwritten between GET and GETSET', async (flags) => {
    flags.onCleanup = () => {
      if (mutis.client._getset) {
        mutis.client.getset = mutis.client._getset
        delete mutis.client._getset
      }
    }

    // using redis.set here instead of creating a lock so we can put a timestamp in the past
    await redis.set('test._lock', Date.now() - 1000)
    mutis.client._getset = mutis.client.getset
    mutis.client.getset = async (key, value) => {
      mutis.client.getset = mutis.client._getset
      delete mutis.client._getset
      // we delete the key here and return the old value so that on the next iteration the lock can be acquired
      await redis.del(key)
      return value - 1000
    }
    const lock = await mutis.lock('test')
    const value = await mutis.client.get('test._lock')
    expect(lock.expires).to.equal(Number(value))
  })
})
