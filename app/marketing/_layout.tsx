import React from 'react';
import { Platform } from 'react-native';
import { Redirect, Stack } from 'expo-router';

export default function MarketingLayout() {
  // Redirect mobile users to main app experience
  if (Platform.OS !== 'web') {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="pricing" 
        options={{ 
          title: 'EduDash Pro Pricing',
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="features" 
        options={{ 
          title: 'EduDash Pro Features',
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="contact" 
        options={{ 
          title: 'Contact Sales',
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="demo" 
        options={{ 
          title: 'Request Demo',
          headerShown: false 
        }} 
      />
    </Stack>
  );
}