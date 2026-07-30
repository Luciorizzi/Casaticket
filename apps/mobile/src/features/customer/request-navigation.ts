import type { Href } from 'expo-router';
import { router } from 'expo-router';

export function goToCustomerRequests(): void {
  router.replace('/(customer)/requests');
}

export function goToCustomerRequest(requestId: string): void {
  router.replace({
    pathname: '/(customer)/requests/[id]',
    params: { id: requestId },
  } as Href);
}
