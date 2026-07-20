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

export type ServiceRequestStatus = 'draft' | 'published' | 'cancelled';

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
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ServiceRequestWithCategory extends ServiceRequest {
  category: Category | null;
}

export interface AuthUser {
  id: string;
  email: string | null;
}
