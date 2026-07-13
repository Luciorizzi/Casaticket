export type AppRole = 'customer' | 'professional' | 'admin' | 'operator';

export type SelectableMobileRole = Extract<AppRole, 'customer' | 'professional'>;

export type AvailabilityStatus = 'available' | 'busy' | 'paused';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarPath: string | null;
  role: AppRole;
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

