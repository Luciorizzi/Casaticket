import type { Href } from 'expo-router';
import { router } from 'expo-router';

export function goBackToProfessionalJob(jobId: string): void {
  router.replace({
    pathname: '/(professional)/jobs/[jobId]',
    params: { jobId },
  } as Href);
}

export function goBackToProfessionalJobs(): void {
  router.replace('/(professional)/jobs');
}
