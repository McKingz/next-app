'use strict';

// Minimal polyfill for Promise.allSettled for environments where it's missing
// See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
if (typeof Promise !== 'undefined' && typeof Promise.allSettled !== 'function') {
  // eslint-disable-next-line no-extend-native
  Promise.allSettled = function (iterable) {
    return Promise.all(
      Array.from(iterable).map(function (p) {
        return Promise.resolve(p).then(
          function (value) { return { status: 'fulfilled', value: value }; },
          function (reason) { return { status: 'rejected', reason: reason }; }
        );
      })
    );
  };
}