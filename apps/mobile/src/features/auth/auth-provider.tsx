import type { PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@casaticket/types';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ForgotPasswordInput, SignInInput, SignUpInput } from '@casaticket/validation';

import type { SessionState } from '@/features/auth/session-state';

import { buildSessionState } from '@/features/auth/session-state';
import {
  hasExpiredSession,
  hasMissingAuthenticatedUser,
  INVALID_SESSION_MESSAGE,
  isInvalidSessionError,
} from '@/features/auth/session-validation';
import {
  ensureOwnProfile,
  fetchOwnProfessionalCategoryIds,
  fetchOwnProfessionalProfile,
} from '@/features/profile/api';
import { getUserFacingErrorMessage, logDevelopmentSupabaseError } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  sessionState: SessionState;
  signIn: (values: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (values: SignUpInput) => Promise<void>;
  sendPasswordReset: (values: ForgotPasswordInput) => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfileFromMutation: (profile: Profile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const invalidSessionCleanupRef = useRef(false);

  const clearCachedState = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  const moveToUnauthenticatedState = useCallback((message: string | null) => {
    if (!isMountedRef.current) {
      return;
    }

    setSession(null);
    setSessionError(message);
  }, []);

  const clearInvalidSession = useCallback(
    async (context: string, error?: unknown, message: string | null = INVALID_SESSION_MESSAGE) => {
      if (invalidSessionCleanupRef.current) {
        return;
      }

      invalidSessionCleanupRef.current = true;

      if (error) {
        logDevelopmentSupabaseError(context, error);
      }

      if (isMountedRef.current) {
        setSession(undefined);
      }

      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });

        if (signOutError) {
          logDevelopmentSupabaseError(`${context}:local-sign-out`, signOutError);
        }
      } catch (signOutError) {
        logDevelopmentSupabaseError(`${context}:local-sign-out`, signOutError);
      } finally {
        clearCachedState();
        moveToUnauthenticatedState(message);
        invalidSessionCleanupRef.current = false;
      }
    },
    [clearCachedState, moveToUnauthenticatedState],
  );

  const validateSession = useCallback(
    async (candidateSession: Session) => {
      if (hasExpiredSession(candidateSession)) {
        await clearInvalidSession('auth:expired-session', {
          code: 'session_expired',
          message: 'Stored session is already expired.',
        });
        return false;
      }

      const {
        data: { user: authenticatedUser },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        if (isInvalidSessionError(error)) {
          await clearInvalidSession('auth:get-user', error);
          return false;
        }

        throw error;
      }

      if (hasMissingAuthenticatedUser(candidateSession, authenticatedUser?.id)) {
        await clearInvalidSession('auth:missing-user', {
          code: 'user_not_found',
          message: 'Authenticated user for restored session does not exist anymore.',
        });
        return false;
      }

      invalidSessionCleanupRef.current = false;

      if (isMountedRef.current) {
        setSession(candidateSession);
        setSessionError(null);
      }

      return true;
    },
    [clearInvalidSession],
  );

  useEffect(() => {
    isMountedRef.current = true;

    const restoreSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMountedRef.current) {
          return;
        }

        if (error) {
          if (isInvalidSessionError(error)) {
            await clearInvalidSession('auth:get-session', error);
            return;
          }

          moveToUnauthenticatedState(
            getUserFacingErrorMessage(
              error,
              'No pudimos restaurar tu sesión. Intentá ingresar de nuevo.',
            ),
          );
          return;
        }

        if (!data.session) {
          moveToUnauthenticatedState(null);
          return;
        }

        await validateSession(data.session);
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        if (isInvalidSessionError(error)) {
          await clearInvalidSession('auth:restore-session', error);
          return;
        }

        moveToUnauthenticatedState(
          getUserFacingErrorMessage(
            error,
            'No pudimos restaurar tu sesión. Intentá ingresar de nuevo.',
          ),
        );
      }
    };

    void restoreSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        clearCachedState();
        moveToUnauthenticatedState(
          invalidSessionCleanupRef.current ? INVALID_SESSION_MESSAGE : null,
        );
        return;
      }

      void validateSession(nextSession).catch(async (error) => {
        if (isInvalidSessionError(error)) {
          await clearInvalidSession('auth:state-change', error);
          return;
        }

        logDevelopmentSupabaseError('auth:state-change', error);
        moveToUnauthenticatedState(
          getUserFacingErrorMessage(
            error,
            'No pudimos validar tu sesión. Intentá ingresar de nuevo.',
          ),
        );
      });
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [clearCachedState, clearInvalidSession, moveToUnauthenticatedState, validateSession]);

  const user = session?.user ?? null;

  const profileQuery = useQuery({
    queryKey: user ? queryKeys.profile(user.id) : queryKeys.auth,
    enabled: Boolean(user),
    queryFn: async () => ensureOwnProfile(user!.id),
  });

  const professionalProfileQuery = useQuery({
    queryKey: user ? queryKeys.professionalProfile(user.id) : queryKeys.auth,
    enabled: Boolean(user) && profileQuery.data?.role === 'professional',
    queryFn: fetchOwnProfessionalProfile,
  });

  const professionalCategoriesQuery = useQuery({
    queryKey: user ? queryKeys.professionalCategories(user.id) : queryKeys.auth,
    enabled: Boolean(user) && profileQuery.data?.role === 'professional',
    queryFn: fetchOwnProfessionalCategoryIds,
  });

  useEffect(() => {
    const authenticatedQueryError =
      profileQuery.error ?? professionalProfileQuery.error ?? professionalCategoriesQuery.error;

    if (!user || !authenticatedQueryError || !isInvalidSessionError(authenticatedQueryError)) {
      return;
    }

    void clearInvalidSession('auth:authenticated-query', authenticatedQueryError);
  }, [
    clearInvalidSession,
    professionalCategoriesQuery.error,
    professionalProfileQuery.error,
    profileQuery.error,
    user,
  ]);

  const signInMutation = useMutation({
    mutationFn: async (values: SignInInput) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        throw error;
      }
    },
  });

  const signUpMutation = useMutation({
    mutationFn: async (values: SignUpInput) => {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (error) {
        throw error;
      }
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();

      if (!error) {
        return;
      }

      if (isInvalidSessionError(error)) {
        await clearInvalidSession('auth:sign-out', error, null);
        return;
      }

      throw error;
    },
  });

  const passwordResetMutation = useMutation({
    mutationFn: async (values: ForgotPasswordInput) => {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: 'casaticket://reset-password',
      });

      if (error) {
        throw error;
      }
    },
  });

  const refreshProfile = useCallback(async () => {
    if (!user) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });

    if (profileQuery.data?.role === 'professional') {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.professionalProfile(user.id),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.professionalCategories(user.id),
      });
    }
  }, [profileQuery.data?.role, queryClient, user]);

  const setProfileFromMutation = useCallback(
    (updatedProfile: Profile) => {
      if (!user || updatedProfile.id !== user.id) {
        return;
      }

      queryClient.setQueryData(queryKeys.profile(user.id), updatedProfile);

      if (updatedProfile.role !== 'professional') {
        queryClient.setQueryData(queryKeys.professionalProfile(user.id), null);
        queryClient.setQueryData(queryKeys.professionalCategories(user.id), []);
      }
    },
    [queryClient, user],
  );

  const sessionState = useMemo(
    () =>
      buildSessionState({
        professionalCategoryIds: professionalCategoriesQuery.data ?? [],
        professionalCategoriesError: professionalCategoriesQuery.error,
        professionalCategoriesLoading: professionalCategoriesQuery.isPending,
        professionalProfile: professionalProfileQuery.data ?? null,
        professionalProfileError: professionalProfileQuery.error,
        professionalProfileLoading: professionalProfileQuery.isPending,
        profile: profileQuery.data ?? null,
        profileError: profileQuery.error,
        profileLoading: profileQuery.isPending,
        session,
        sessionError,
      }),
    [
      professionalCategoriesQuery.data,
      professionalCategoriesQuery.error,
      professionalCategoriesQuery.isPending,
      professionalProfileQuery.data,
      professionalProfileQuery.error,
      professionalProfileQuery.isPending,
      profileQuery.data,
      profileQuery.error,
      profileQuery.isPending,
      session,
      sessionError,
    ],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      sessionState,
      signIn: async (values) => {
        try {
          await signInMutation.mutateAsync(values);
        } catch (error) {
          throw new Error(
            getUserFacingErrorMessage(
              error,
              'No pudimos iniciar sesion. Intenta de nuevo en unos minutos.',
            ),
          );
        }
      },
      signUp: async (values) => {
        try {
          await signUpMutation.mutateAsync(values);
        } catch (error) {
          throw new Error(
            getUserFacingErrorMessage(
              error,
              'No pudimos crear tu cuenta. Intenta de nuevo en unos minutos.',
            ),
          );
        }
      },
      signOut: async () => {
        try {
          setSessionError(null);
          await signOutMutation.mutateAsync();
        } catch (error) {
          throw new Error(
            getUserFacingErrorMessage(
              error,
              'No pudimos cerrar tu sesión. Intentá nuevamente.',
            ),
          );
        }
      },
      sendPasswordReset: async (values) => {
        try {
          await passwordResetMutation.mutateAsync(values);
        } catch (error) {
          throw new Error(
            getUserFacingErrorMessage(
              error,
              'No pudimos enviar el correo de recuperacion. Intenta otra vez.',
            ),
          );
        }
      },
      refreshProfile,
      setProfileFromMutation,
    }),
    [
      passwordResetMutation,
      refreshProfile,
      sessionState,
      setProfileFromMutation,
      signInMutation,
      signOutMutation,
      signUpMutation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuthSession debe usarse dentro de AuthProvider.');
  }

  return value;
}
