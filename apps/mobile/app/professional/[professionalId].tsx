import { router, useLocalSearchParams } from 'expo-router';

import { useAuthSession } from '@/features/auth/auth-provider';
import { PublicProfessionalProfileScreen } from '@/features/professional/public-profile-screen';

export default function PublicProfessionalProfileRoute() {
  const { jobId, professionalId } = useLocalSearchParams<{ jobId?: string; professionalId?: string }>();
  const { sessionState } = useAuthSession();
  const onBack = () => {
    if (jobId && sessionState.status === 'authenticated' && sessionState.profile?.role === 'customer') {
      router.replace({ pathname: '/(customer)/jobs/[jobId]', params: { jobId } });
      return;
    }
    if (router.canGoBack()) router.back();
    else if (sessionState.status === 'authenticated' && sessionState.profile?.role === 'professional') router.replace('/(professional)/profile');
    else router.replace('/(customer)/requests');
  };
  return <PublicProfessionalProfileScreen onBack={onBack} professionalId={professionalId ?? ''} />;
}
