import { useLocalSearchParams } from 'expo-router';

import { CustomerJobVisitScreen } from '@/features/jobs/customer-job-panel';

export default function CustomerJobVisitRoute() {
  const { jobId, requestId } = useLocalSearchParams<{ jobId?: string; requestId?: string }>();
  return <CustomerJobVisitScreen jobId={jobId ?? ''} requestId={requestId ?? ''} />;
}
