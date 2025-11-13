/**
 * Tester Feedback Route
 * 
 * Expo Router v5 route wrapper for /tester-feedback
 * 
 * Documentation Sources:
 * - Expo Router v5: https://docs.expo.dev/router/introduction/
 */

import { Stack } from 'expo-router';
import TesterFeedbackScreen from './screens/tester-feedback';

export default function TesterFeedbackRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Report Feedback',
          headerShown: true,
          presentation: 'modal',
        }}
      />
      <TesterFeedbackScreen />
    </>
  );
}
