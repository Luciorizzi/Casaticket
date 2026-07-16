import { Redirect } from 'expo-router';

import { useAuthSession } from '@/features/auth/auth-provider';
import { resolveAppRoute } from '@/features/navigation/access';

export default function IndexScreen() {
  const { sessionState } = useAuthSession();

  if (sessionState.status === 'loading') {
    return <Redirect href="/loading" />;
  }

  if (sessionState.status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Redirect
      href={resolveAppRoute({
        isAuthenticated: true,
        profile: sessionState.profile,
        professionalProfile: sessionState.professionalProfile,
        professionalCategoryIds: sessionState.professionalCategoryIds,
      })}
    />
  );
}
