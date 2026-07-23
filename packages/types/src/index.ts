export type AppRole = 'customer' | 'professional' | 'admin' | 'operator';

export type SelectableMobileRole = Extract<AppRole, 'customer' | 'professional'>;

export type AvailabilityStatus =
  | 'available'
  | 'unavailable'
  | 'busy'
  | 'scheduled_only'
  | 'paused';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type ServiceRequestType = 'quote' | 'diagnostic_visit' | 'specific_task' | 'unsure';

export type ServiceRequestUrgency = 'flexible' | 'scheduled' | 'soon' | 'urgent';

export type ServiceRequestStatus =
  | 'draft'
  | 'published'
  | 'receiving_applications'
  | 'professional_selected'
  | 'cancelled';

export type ApplicationProposalType =
  | 'diagnostic_visit'
  | 'preliminary_quote'
  | 'ask_for_details'
  | 'direct_service';

export type ApplicationStatus = 'submitted' | 'viewed' | 'withdrawn' | 'selected' | 'rejected';

export type ConversationStatus = 'active' | 'read_only' | 'closed';

export type JobStatus =
  | 'coordination_pending'
  | 'visit_proposed'
  | 'visit_confirmed'
  | 'diagnosis_pending'
  | 'quote_pending'
  | 'quote_sent'
  | 'payment_pending'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'ready_to_start'
  | 'in_progress'
  | 'review_pending'
  | 'completion_pending'
  | 'completed'
  | 'disputed'
  | 'cancelled';

export type JobQuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'superseded';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'secured'
  | 'failed'
  | 'release_pending'
  | 'released'
  | 'disputed'
  | 'refund_pending'
  | 'refunded'
  | 'cancelled';

export type JobCompletionMode = 'customer_confirmed' | 'automatic';

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarPath: string | null;
  role: SelectableMobileRole | null;
  province: string;
  city: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalProfile {
  id: string;
  userId: string;
  bio: string | null;
  yearsExperience: number | null;
  baseCity: string;
  baseLatitude: number | null;
  baseLongitude: number | null;
  serviceRadiusKm: number;
  availabilityStatus: AvailabilityStatus;
  verificationStatus: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalCategory {
  professionalId: string;
  categoryId: string;
  createdAt: string;
}

export interface ServiceRequest {
  id: string;
  customerId: string;
  categoryId: string | null;
  title: string;
  description: string;
  requestType: ServiceRequestType;
  urgency: ServiceRequestUrgency;
  addressText: string;
  city: string;
  province: string;
  preferredDate: string | null;
  preferredTimeText: string | null;
  availabilityNotes: string | null;
  status: ServiceRequestStatus;
  selectedProfessionalId: string | null;
  selectedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ServiceRequestWithCategory extends ServiceRequest {
  category: Category | null;
}

export interface ProfessionalOpportunity {
  requestId: string;
  title: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  requestType: ServiceRequestType;
  urgency: ServiceRequestUrgency;
  city: string;
  province: string;
  preferredDate: string | null;
  preferredTimeText: string | null;
  availabilityNotes: string | null;
  publishedAt: string | null;
}

export interface ProfessionalApplication {
  id: string;
  requestId: string;
  professionalId: string;
  message: string;
  proposalType: ApplicationProposalType;
  visitPrice: number | null;
  estimatedPrice: number | null;
  estimatedDurationText: string | null;
  availabilityText: string;
  status: ApplicationStatus;
  conversationId: string | null;
  unreadCount: number;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  withdrawnAt: string | null;
}

export interface CustomerRequestApplication {
  id: string;
  requestId: string;
  professionalId: string;
  status: ApplicationStatus;
  message: string;
  proposalType: ApplicationProposalType;
  visitPrice: number | null;
  estimatedPrice: number | null;
  estimatedDurationText: string | null;
  availabilityText: string;
  createdAt: string;
  conversationId: string | null;
  unreadCount: number;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  professionalFirstName: string;
  professionalLastName: string;
  professionalBio: string | null;
  professionalYearsExperience: number | null;
  professionalBaseCity: string;
  professionalServiceRadiusKm: number;
  professionalVerificationStatus: VerificationStatus;
  professionalCategoryNames: string[];
  professionalCompletedJobsCount: number;
  professionalAverageRating: number | null;
  professionalReviewsCount: number;
}

export interface CustomerSelectionResult {
  requestId: string;
  requestStatus: ServiceRequestStatus;
  selectedProfessionalId: string;
  selectedApplicationId: string;
  selectedAt: string;
  jobId: string;
}

export interface ProfessionalSelectedJob {
  applicationId: string;
  requestId: string;
  title: string;
  categoryName: string | null;
  city: string;
  requestStatus: ServiceRequestStatus;
  selectedAt: string | null;
  conversationId: string | null;
  unreadCount: number;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  jobId: string | null;
  jobStatus: JobStatus | null;
}

export interface Job {
  id: string;
  requestId: string;
  selectedApplicationId: string;
  customerId: string;
  professionalId: string;
  status: JobStatus;
  scheduledDate: string | null;
  scheduledTimeText: string | null;
  schedulingNotes: string | null;
  diagnosisText: string | null;
  recommendedWorkText?: string | null;
  materialsNotes?: string | null;
  diagnosisNotes?: string | null;
  diagnosedAt: string | null;
  startedAt: string | null;
  completionSummary: string | null;
  finalNotes: string | null;
  finalMaterialsNotes: string | null;
  finalMaterialsAmount: number | null;
  professionalCompletedAt: string | null;
  customerConfirmedAt: string | null;
  disputeReason: string | null;
  disputeDetails: string | null;
  disputedAt: string | null;
  reviewDeadlineAt: string | null;
  completionMode: JobCompletionMode | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobPayment {
  id: string;
  jobId: string;
  quoteId: string;
  customerId: string;
  professionalId: string;
  status: PaymentStatus;
  provider: 'mock' | string;
  providerPaymentId: string | null;
  currency: string;
  laborAmount: number;
  visitAmount: number;
  materialsReferenceAmount: number;
  platformFeeAmount: number;
  customerTotalAmount: number;
  professionalAmount: number;
  releasedAmount: number | null;
  failureReason: string | null;
  paidAt: string | null;
  securedAt: string | null;
  releasePendingAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReviewRole = 'customer' | 'professional';

export interface JobReview {
  id: string;
  jobId: string;
  reviewerUserId: string;
  reviewedUserId: string;
  reviewerRole: ReviewRole;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ProfessionalPublicMetrics {
  professionalId: string;
  completedJobsCount: number;
  averageRating: number | null;
  reviewsCount: number;
}

export interface JobQuote {
  id: string;
  jobId: string;
  version: number;
  laborAmount: number;
  materialsAmount: number;
  visitAmount: number;
  platformFeeAmount: number;
  totalAmount: number;
  currency: string;
  description: string;
  estimatedDurationText: string | null;
  validUntil: string | null;
  status: JobQuoteStatus;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
}

export interface ApplicationConversation {
  id: string;
  applicationId: string;
  requestId: string;
  requestTitle: string | null;
  customerId: string;
  professionalId: string;
  status: ConversationStatus;
  applicationStatus: ApplicationStatus | null;
  requestStatus: ServiceRequestStatus | null;
  counterpartUserId: string | null;
  counterpartName: string | null;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  canSend: boolean;
}

export interface ApplicationMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface AuthUser {
  id: string;
  email: string | null;
}
