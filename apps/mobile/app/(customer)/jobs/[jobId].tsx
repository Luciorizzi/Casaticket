import { useLocalSearchParams } from 'expo-router';

import { CustomerJobDetailScreen } from '@/features/jobs/customer-job-panel';

export default function CustomerJobDetailRoute() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();

  return <CustomerJobDetailScreen jobId={jobId ?? ''} />;
}
