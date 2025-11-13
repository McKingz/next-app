import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'card',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="org-type" />
      <Stack.Screen name="role" />
      <Stack.Screen name="dob" />
      <Stack.Screen name="guardian" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
