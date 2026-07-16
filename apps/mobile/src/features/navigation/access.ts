import type { ProfessionalProfile, Profile, SelectableMobileRole } from '@casaticket/types';

export interface AccessSnapshot {
  isAuthenticated: boolean;
  profile: Profile | null;
  professionalProfile: ProfessionalProfile | null;
  professionalCategoryIds: string[];
}

export function isCustomerReady(profile: Profile | null): boolean {
  return Boolean(profile && profile.role === 'customer' && profile.onboardingCompleted);
}

export function isProfessionalReady(
  profile: Profile | null,
  professionalProfile: ProfessionalProfile | null,
  professionalCategoryIds: string[],
): boolean {
  return Boolean(
    profile &&
      profile.role === 'professional' &&
      profile.onboardingCompleted &&
      professionalProfile &&
      professionalCategoryIds.length > 0,
  );
}

export function getPendingOnboardingRoute(
  role: SelectableMobileRole | null,
  profile: Profile | null,
  professionalProfile: ProfessionalProfile | null,
  professionalCategoryIds: string[],
): '/(onboarding)/role-selection' | '/(onboarding)/customer-profile' | '/(onboarding)/professional-profile' {
  if (!profile || !role) {
    return '/(onboarding)/role-selection';
  }

  if (role === 'customer' && !profile.onboardingCompleted) {
    return '/(onboarding)/customer-profile';
  }

  if (
    role === 'professional' &&
    (!profile.onboardingCompleted || !professionalProfile || professionalCategoryIds.length === 0)
  ) {
    return '/(onboarding)/professional-profile';
  }

  return '/(onboarding)/role-selection';
}

export function resolveAppRoute({
  isAuthenticated,
  profile,
  professionalProfile,
  professionalCategoryIds,
}: AccessSnapshot): string {
  if (!isAuthenticated) {
    return '/(auth)/login';
  }

  if (isCustomerReady(profile)) {
    return '/(customer)/home';
  }

  if (isProfessionalReady(profile, professionalProfile, professionalCategoryIds)) {
    return '/(professional)/home';
  }

  return getPendingOnboardingRoute(
    profile?.role ?? null,
    profile,
    professionalProfile,
    professionalCategoryIds,
  );
}
