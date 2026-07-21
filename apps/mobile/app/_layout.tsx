import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { isCustomerReady, isProfessionalReady } from '@/features/navigation/access';
import { useAuthSession } from '@/features/auth/auth-provider';
import { AppProviders } from '@/providers/app-providers';

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const { sessionState } = useAuthSession();

  const isAuthenticated = sessionState.status === 'authenticated';
  const profile = sessionState.status === 'authenticated' ? sessionState.profile : null;
  const professionalProfile =
    sessionState.status === 'authenticated' ? sessionState.professionalProfile : null;
  const professionalCategoryIds =
    sessionState.status === 'authenticated' ? sessionState.professionalCategoryIds : [];

  const customerComplete = isCustomerReady(profile);
  const professionalComplete = isProfessionalReady(
    profile,
    professionalProfile,
    professionalCategoryIds,
  );
  const needsRoleSelection = isAuthenticated && (!profile || !profile.role);
  const needsCustomerOnboarding =
    isAuthenticated && profile?.role === 'customer' && !customerComplete;
  const needsProfessionalOnboarding =
    isAuthenticated && profile?.role === 'professional' && !professionalComplete;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: '#f6f1e7',
        },
      }}
    >
      <Stack.Protected guard={sessionState.status === 'loading'}>
        <Stack.Screen name="loading" />
      </Stack.Protected>
      <Stack.Protected guard={sessionState.status === 'unauthenticated'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected
        guard={needsRoleSelection || needsCustomerOnboarding || needsProfessionalOnboarding}
      >
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={customerComplete}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
      <Stack.Protected guard={professionalComplete}>
        <Stack.Screen name="(professional)" />
      </Stack.Protected>
      <Stack.Protected guard={customerComplete || professionalComplete}>
        <Stack.Screen name="profile" />
        <Stack.Screen name="chat/[conversationId]" />
      </Stack.Protected>
    </Stack>
  );
}
