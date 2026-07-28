import { useLocalSearchParams } from 'expo-router';

import { ProfessionalJobStageScreen } from '@/features/jobs/professional-job-stage-screen';

export default function CompletionStageRoute() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  return <ProfessionalJobStageScreen jobId={jobId ?? ''} stage="completion" />;
}
