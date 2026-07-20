import { useLocalSearchParams } from 'expo-router';

import { ProfessionalOpportunityDetailScreen } from '@/features/professional/screens';

export default function ProfessionalOpportunityDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ProfessionalOpportunityDetailScreen requestId={id ?? ''} />;
}
