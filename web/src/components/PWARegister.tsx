'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    // Disable SW in development to avoid breaking HMR/caching
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Service workers require secure context: HTTPS or localhost
    const isSecure = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if (!isSecure) {
      console.warn('[PWA] Service worker not registered: insecure context (use https or localhost)');
      return;
    }

    const registerSW = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        // console.info('[PWA] Service worker registered');
      } catch (e) {
        console.warn('[PWA] Failed to register service worker', e);
      }
    };

    registerSW();
  }, []);

  return null;
}
