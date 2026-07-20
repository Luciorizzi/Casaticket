import { useLocalSearchParams } from 'expo-router';

import { CustomerRequestDetailScreen } from '@/features/customer/screens';

export default function CustomerRequestDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <CustomerRequestDetailScreen requestId={id ?? ''} />;
}
