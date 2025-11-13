/**
 * App Splash Screen Component
 * 
 * Full-screen branded loading experience for app initialization
 */

import React, { useEffect, useState } from 'react';
import { EduDashProSplashLoader } from './EduDashProLoader';

export interface AppSplashScreenProps {
  isLoading: boolean;
  onLoadingComplete?: () => void;
  minimumDisplayTime?: number;
  message?: string;
}

export function AppSplashScreen({
  isLoading,
  onLoadingComplete,
  minimumDisplayTime = 2000, // Minimum 2 seconds for branding
  message = "Initializing EduDash Pro...",
}: AppSplashScreenProps) {
  const [showSplash, setShowSplash] = useState(true);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (!isLoading) {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minimumDisplayTime - elapsed);

      const timer = setTimeout(() => {
        setShowSplash(false);
        onLoadingComplete?.();
      }, remainingTime);

      return () => clearTimeout(timer);
    }
  }, [isLoading, startTime, minimumDisplayTime, onLoadingComplete]);

  if (!showSplash) {
    return null;
  }

  return (
    <EduDashProSplashLoader
      message={message}
      showIcon={true}
      showSpinner={isLoading}
      iconSize={160}
      testID="app-splash-screen"
    />
  );
}

export default AppSplashScreen;