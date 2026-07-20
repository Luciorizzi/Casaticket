export const queryKeys = {
  auth: ['auth'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  professionalProfile: (userId: string) => ['professional-profile', userId] as const,
  professionalCategories: (userId: string) => ['professional-categories', userId] as const,
  categories: ['categories'] as const,
  customerAddress: (userId: string) => ['customer-address', userId] as const,
  serviceRequests: (userId: string) => ['service-requests', userId] as const,
  serviceRequest: (userId: string, requestId: string) => ['service-request', userId, requestId] as const,
};
