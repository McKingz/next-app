// Polyfill for React.use() API - added in React 19
// This provides a safe fallback for React 18 environments
import * as React from 'react';

// Type augmentation to add 'use' to React
declare module 'react' {
  export function use<T>(context: React.Context<T>): T;
}

// Only polyfill if React.use is not available (React <19)
/* eslint-disable no-import-assign */
if (!('use' in React)) {
  // @ts-ignore - We're adding the method at runtime
  React.use = React.useContext as any;
}
/* eslint-enable no-import-assign */

// Export to ensure module side effects run
export {};