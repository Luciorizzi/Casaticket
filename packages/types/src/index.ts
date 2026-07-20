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
  professionalFirstName: string;
  professionalLastName: string;
  professionalBio: string | null;
  professionalYearsExperience: number | null;
  professionalBaseCity: string;
  professionalServiceRadiusKm: number;
  professionalVerificationStatus: VerificationStatus;
  professionalCategoryNames: string[];
}

export interface CustomerSelectionResult {
  requestId: string;
  requestStatus: ServiceRequestStatus;
  selectedProfessionalId: string;
  selectedApplicationId: string;
  selectedAt: string;
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
}

export interface ApplicationConversation {
  id: string;
  applicationId: string;
  requestId: string;
  customerId: string;
  professionalId: string;
  status: ConversationStatus;
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
