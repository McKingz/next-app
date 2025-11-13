// Polyfills for older JavaScript engines (like older Hermes versions)

// Promise.allSettled polyfill
if (!Promise.allSettled) {
  Promise.allSettled = function<T>(promises: Promise<T>[]): Promise<Array<{status: 'fulfilled' | 'rejected', value?: T, reason?: any}>> {
    return Promise.all(promises.map(promise => 
      promise
        .then(value => ({ status: 'fulfilled' as const, value }))
        .catch(reason => ({ status: 'rejected' as const, reason }))
    ));
  };
}

// Export for TypeScript module resolution
export {};