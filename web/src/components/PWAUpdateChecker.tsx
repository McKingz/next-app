'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function PWAUpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Check for updates every 30 seconds (was 5 minutes - changed for faster update detection)
    const CHECK_INTERVAL = 30 * 1000;

    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          console.log('🔄 [PWA] Checking for updates...');
          await reg.update();
        }
      } catch (error) {
        console.error('❌ [PWA] Update check failed:', error);
      }
    };

    // Listen for new service worker waiting
    const onUpdateFound = () => {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.waiting) {
          console.log('✨ [PWA] Update found!');
          setRegistration(reg);
          setUpdateAvailable(true);

          // Auto-reload after 10 seconds if user doesn't act
          setTimeout(() => {
            if (reg.waiting) {
              console.log('⏰ [PWA] Auto-applying update...');
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }, 10000);
        }
      });
    };

    // Listen for controller change (new service worker activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 [PWA] New service worker activated, reloading...');
      window.location.reload();
    });

    // Register update listener
    let intervalId: NodeJS.Timeout;
    
    navigator.serviceWorker.ready.then((reg) => {
      // Check for waiting service worker immediately
      if (reg.waiting) {
        onUpdateFound();
      }
      
      // Listen for updatefound event
      reg.addEventListener('updatefound', onUpdateFound);

      // Initial check
      checkForUpdates();

      // Periodic checks
      intervalId = setInterval(checkForUpdates, CHECK_INTERVAL);
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleUpdate = () => {
    if (!registration?.waiting) return;

    console.log('📥 [PWA] Applying update...');
    // Tell the waiting service worker to skip waiting and become active
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    
    setUpdateAvailable(false);
  };

  const handleDismiss = () => {
    console.log('❌ [PWA] Update dismissed');
    setUpdateAvailable(false);
  };

  if (!updateAvailable) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        left: 16,
        maxWidth: 400,
        marginLeft: 'auto',
        zIndex: 9999,
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        borderRadius: 12,
        padding: '16px 20px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <RefreshCw size={24} style={{ color: 'white', flexShrink: 0 }} />
      <div style={{ flex: 1, color: 'white' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Update Available
        </div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          A new version is ready. Refresh to update.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleDismiss}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            color: 'white',
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Later
        </button>
        <button
          onClick={handleUpdate}
          style={{
            background: 'white',
            border: 'none',
            color: '#2563eb',
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Update
        </button>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
