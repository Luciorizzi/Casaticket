import { Stack } from 'expo-router';

import { useAuthSession } from '@/features/auth/auth-provider';
import { isCustomerReady, isProfessionalReady } from '@/features/navigation/access';

export default function OnboardingLayout() {
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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={needsRoleSelection}>
        <Stack.Screen name="role-selection" />
      </Stack.Protected>
      <Stack.Protected guard={needsCustomerOnboarding}>
        <Stack.Screen name="customer-profile" />
      </Stack.Protected>
      <Stack.Protected guard={needsProfessionalOnboarding}>
        <Stack.Screen name="professional-profile" />
      </Stack.Protected>
    </Stack>
  );
}
