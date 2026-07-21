export const queryKeys = {
  auth: ['auth'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  professionalProfile: (userId: string) => ['professional-profile', userId] as const,
  professionalCategories: (userId: string) => ['professional-categories', userId] as const,
  categories: ['categories'] as const,
  customerAddress: (userId: string) => ['customer-address', userId] as const,
  serviceRequests: (userId: string) => ['service-requests', userId] as const,
  serviceRequest: (userId: string, requestId: string) => ['service-request', userId, requestId] as const,
  customerRequestApplications: (userId: string, requestId: string) =>
    ['customer-request-applications', userId, requestId] as const,
  professionalOpportunities: (professionalId: string) => ['professional-opportunities', professionalId] as const,
  professionalOpportunity: (professionalId: string, requestId: string) =>
    ['professional-opportunity', professionalId, requestId] as const,
  professionalApplications: (professionalId: string) => ['professional-applications', professionalId] as const,
  professionalApplication: (professionalId: string, requestId: string) =>
    ['professional-application', professionalId, requestId] as const,
  professionalSelectedJobs: (professionalId: string) => ['professional-selected-jobs', professionalId] as const,
  applicationConversation: (applicationId: string) => ['application-conversation', applicationId] as const,
  conversation: (conversationId: string) => ['conversation', conversationId] as const,
  conversationMessages: (conversationId: string) => ['conversation-messages', conversationId] as const,
  conversationUnreadCount: (conversationId: string) =>
    ['conversation-unread-count', conversationId] as const,
};
