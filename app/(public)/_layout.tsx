import React from 'react';
import { Stack } from 'expo-router';

/**
 * Public route group layout for legal and marketing pages
 * Routes: /privacy-policy, /terms-of-service
 * Note: Route group name "(public)" is invisible in URLs
 */
export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Custom headers rendered in each page
        presentation: 'card',
        animation: 'default',
      }}
    />
  );
}
