import type { Session } from '@supabase/supabase-js';
import type { AuthUser, ProfessionalProfile, Profile } from '@casaticket/types';

import { isInvalidSessionError } from '@/features/auth/session-validation';
import { getUserFacingErrorMessage } from '@/lib/errors';

export type SessionState =
  | {
      status: 'loading';
    }
  | {
      status: 'unauthenticated';
      error: string | null;
    }
  | {
      status: 'authenticated';
      user: AuthUser;
      profile: Profile | null;
      professionalProfile: ProfessionalProfile | null;
      professionalCategoryIds: string[];
      error: string | null;
    };

export interface SessionResolutionInput {
  professionalCategoryIds: string[];
  professionalCategoriesError: unknown;
  professionalCategoriesLoading: boolean;
  professionalProfile: ProfessionalProfile | null;
  professionalProfileError: unknown;
  professionalProfileLoading: boolean;
  profile: Profile | null;
  profileError: unknown;
  profileLoading: boolean;
  session: Session | null | undefined;
  sessionError: string | null;
}

function mapSessionUser(session: Session): AuthUser {
  return {
    id: session.user.id,
    email: session.user.email ?? null,
  };
}

export function buildSessionState({
  professionalCategoryIds,
  professionalCategoriesError,
  professionalCategoriesLoading,
  professionalProfile,
  professionalProfileError,
  professionalProfileLoading,
  profile,
  profileError,
  profileLoading,
  session,
  sessionError,
}: SessionResolutionInput): SessionState {
  if (session === undefined) {
    return { status: 'loading' };
  }

  if (!session) {
    return {
      status: 'unauthenticated',
      error: sessionError,
    };
  }

  if (profileLoading) {
    return { status: 'loading' };
  }

  if (
    profile?.role === 'professional' &&
    (professionalProfileLoading || professionalCategoriesLoading)
  ) {
    return { status: 'loading' };
  }

  const queryError = profileError ?? professionalProfileError ?? professionalCategoriesError ?? null;

  if (queryError && isInvalidSessionError(queryError)) {
    return { status: 'loading' };
  }

  return {
    status: 'authenticated',
    user: mapSessionUser(session),
    profile,
    professionalProfile,
    professionalCategoryIds,
    error: queryError
      ? getUserFacingErrorMessage(
          queryError,
          'No pudimos sincronizar tu perfil. Intenta de nuevo.',
        )
      : sessionError,
  };
}
