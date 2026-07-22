import { useLocalSearchParams } from 'expo-router';

import { CustomerRequestDetailsScreen } from '@/features/customer/screens';

export default function CustomerRequestDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <CustomerRequestDetailsScreen requestId={id ?? ''} />;
}
