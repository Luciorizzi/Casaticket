import { useLocalSearchParams } from 'expo-router';

import { CustomerJobDetailScreen } from '@/features/jobs/customer-job-panel';

export default function CustomerJobDetailRoute() {
  const { jobId, requestId } = useLocalSearchParams<{ jobId: string; requestId?: string }>();

  return <CustomerJobDetailScreen jobId={jobId ?? ''} requestId={requestId ?? null} />;
}
