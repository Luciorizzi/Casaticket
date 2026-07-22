import { useLocalSearchParams } from 'expo-router';

import { CustomerApplicationDetailScreen } from '@/features/customer/screens';

export default function CustomerApplicationDetailRoute() {
  const { applicationId, id } = useLocalSearchParams<{ applicationId: string; id: string }>();

  return <CustomerApplicationDetailScreen applicationId={applicationId ?? ''} requestId={id ?? ''} />;
}
