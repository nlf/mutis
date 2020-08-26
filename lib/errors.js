'use strict'

class AlreadyUnlockedError extends Error {
  constructor ({ key }) {
    super('Attempted to unlock an already unlocked key')
    this.key = key
  }
}

class ExpiredLockError extends Error {
  constructor ({ key }) {
    super('Attempted to unlock an expired key')
    this.key = key
  }
}

class LockTimeoutError extends Error {
  constructor ({ key, timeout }) {
    super('Timed out waiting for lock')
    this.key = key
    this.timeout = timeout
  }
}

module.exports = {
  AlreadyUnlockedError,
  ExpiredLockError,
  LockTimeoutError
}
