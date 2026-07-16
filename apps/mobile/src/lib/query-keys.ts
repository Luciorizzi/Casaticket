export const queryKeys = {
  auth: ['auth'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  professionalProfile: (userId: string) => ['professional-profile', userId] as const,
  professionalCategories: (userId: string) => ['professional-categories', userId] as const,
  categories: ['categories'] as const,
  customerAddress: (userId: string) => ['customer-address', userId] as const,
};
