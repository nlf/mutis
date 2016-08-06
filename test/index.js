'use strict';

const Promise = require('bluebird');
const Redis = require('redis-mock');
const redis = Redis.createClient();
redis.duplicate = function () {

  return this;
};

const Mutis = require('../');
const mutis = new Mutis(redis);

const lab = exports.lab = require('lab').script();
const describe = lab.suite;
const it = lab.test;
const beforeEach = lab.beforeEach;
const Code = require('code');
const expect = Code.expect;
const fail = Code.fail;

describe('mutis', () => {

  beforeEach(() => {

    return mutis._client.delAsync('test._lock');
  });

  it('can lock a key', () => {

    return mutis.lock('test').then(() => {

      return mutis._client.getAsync('test._lock');
    }).then((val) => {

      expect(val).to.equal('locked');
    });
  });

  it('can unlock a key implicitly', () => {

    return mutis.lock('test').then((unlock) => {

      return mutis._client.getAsync('test._lock').then((val) => {

        expect(val).to.equal('locked');
        return unlock();
      }).then(() => {

        return mutis._client.getAsync('test._lock');
      }).then((val) => {

        expect(val).to.equal(null);
      });
    });
  });

  it('can unlock a key explicitly', () => {

    return mutis.lock('test').then(() => {

      return mutis._client.getAsync('test._lock').then((val) => {

        expect(val).to.equal('locked');
        return mutis.unlock('test');
      }).then(() => {

        return mutis._client.getAsync('test._lock');
      }).then((val) => {

        expect(val).to.equal(null);
      });
    });
  });

  it('waits for a lock', () => {

    return mutis.lock('test').then((unlock) => {

      const start = Date.now();
      setTimeout(() => {

        unlock();
      }, 66);

      return mutis.lock('test').then(() => {

        const delay = Date.now() - start;
        expect(delay).to.be.about(66, 3);
      });
    });
  });

  it('respects timeout value when waiting for a lock', () => {

    return mutis.lock('test').then((unlock) => {

      setTimeout(() => {

        unlock();
      }, 66);

      return mutis.lock('test', 10).then(() => {

        fail('this should never be reached');
      }).catch((err) => {

        expect(err).to.exist();
        expect(err).to.be.an.instanceof(Promise.TimeoutError);
        return mutis._client.getAsync('test._lock').then((val) => {

          expect(val).to.equal('locked');
        });
      });
    });
  });
});
