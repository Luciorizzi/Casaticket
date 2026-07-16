import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="role-selection" />
      <Stack.Screen name="customer-profile" />
      <Stack.Screen name="professional-profile" />
    </Stack>
  );
}
