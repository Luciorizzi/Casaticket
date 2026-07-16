import type { Href } from 'expo-router';
import type { Profile, SelectableMobileRole } from '@casaticket/types';

import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { RoleCard } from '@/components/ui/role-card';
import { Screen } from '@/components/ui/screen';
import { useAuthSession } from '@/features/auth/auth-provider';
import { resolveAppRoute } from '@/features/navigation/access';
import { updateOwnRole } from '@/features/profile/api';
import { getUserFacingErrorMessage, logDevelopmentSupabaseError } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';

function logRoleSelectionDevelopment(
  context: string,
  payload: {
    role: SelectableMobileRole | null;
    onboardingCompleted: boolean;
    profileCacheUpdated: boolean;
    resolvedRoute: string;
  },
): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.info(`[${context}] role selection`, payload);
}

export function RoleSelectionScreen() {
  const queryClient = useQueryClient();
  const { sessionState, setProfileFromMutation, signOut } = useAuthSession();
  const [selectedRole, setSelectedRole] = useState<SelectableMobileRole | null>(
    sessionState.status === 'authenticated' ? sessionState.profile?.role ?? null : null,
  );
  const [error, setError] = useState<string | null>(null);

  const roleMutation = useMutation({
    mutationFn: updateOwnRole,
    onSuccess: async (updatedProfile: Profile) => {
      if (sessionState.status !== 'authenticated') {
        return;
      }

      setProfileFromMutation(updatedProfile);

      const cachedProfile = queryClient.getQueryData<Profile>(
        queryKeys.profile(sessionState.user.id),
      );
      const resolvedRoute = resolveAppRoute({
        isAuthenticated: true,
        profile: updatedProfile,
        professionalProfile:
          updatedProfile.role === 'professional' ? sessionState.professionalProfile : null,
        professionalCategoryIds:
          updatedProfile.role === 'professional' ? sessionState.professionalCategoryIds : [],
      });

      logRoleSelectionDevelopment('role-selection', {
        role: updatedProfile.role,
        onboardingCompleted: updatedProfile.onboardingCompleted,
        profileCacheUpdated: cachedProfile?.role === updatedProfile.role,
        resolvedRoute,
      });

      router.replace(resolvedRoute as Href);
    },
  });

  const confirmSelection = () => {
    if (!selectedRole) {
      setError('Elegí cómo querés usar CasaTicket para continuar.');
      return;
    }

    setError(null);

    Alert.alert(
      'Confirmar tipo de cuenta',
      selectedRole === 'customer'
        ? 'Vas a continuar como usuario del hogar.'
        : 'Vas a continuar como profesional independiente.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          onPress: async () => {
            setError(null);

            try {
              await roleMutation.mutateAsync(selectedRole);
            } catch (submissionError) {
              logDevelopmentSupabaseError('role-selection', submissionError);
              setError(
                getUserFacingErrorMessage(
                  submissionError,
                  'No pudimos guardar el tipo de cuenta.',
                ),
              );
            }
          },
        },
      ],
    );
  };

  return (
    <Screen
      footer={
        <Button onPress={() => void signOut()} variant="secondary">
          Cerrar sesión
        </Button>
      }
      subtitle="Esta elección define tu navegación y no se puede cambiar libremente después del onboarding."
      title="Elegí cómo querés usar CasaTicket"
    >
      <RoleCard
        description="Publicá lo que necesitás y recibí propuestas de profesionales."
        onPress={() => {
          setError(null);
          setSelectedRole('customer');
        }}
        selected={selectedRole === 'customer'}
        title="Necesito resolver algo en mi casa"
      />
      <RoleCard
        description="Creá tu perfil y encontrá oportunidades cerca de tu zona."
        onPress={() => {
          setError(null);
          setSelectedRole('professional');
        }}
        selected={selectedRole === 'professional'}
        title="Quiero ofrecer mis servicios"
      />
      {error ? <ErrorState message={error} title="No pudimos avanzar" /> : null}
      <Card>
        <Text style={{ color: '#675a49', fontSize: 14, lineHeight: 20 }}>
          Roles habilitados en esta fase: cliente o profesional. Los roles internos quedan
          reservados para la operación de CasaTicket.
        </Text>
        <Button disabled={roleMutation.isPending} onPress={confirmSelection}>
          {roleMutation.isPending ? 'Guardando...' : 'Guardar elección'}
        </Button>
      </Card>
    </Screen>
  );
}
