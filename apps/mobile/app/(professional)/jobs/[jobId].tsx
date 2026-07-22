import { useLocalSearchParams } from 'expo-router';

import { ProfessionalJobDetailScreen } from '@/features/jobs/professional-job-detail-screen';

export default function ProfessionalJobDetailRoute() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();

  return <ProfessionalJobDetailScreen jobId={jobId ?? ''} />;
}
