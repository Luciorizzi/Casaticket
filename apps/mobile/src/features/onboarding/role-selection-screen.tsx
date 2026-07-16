import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { SelectableMobileRole } from '@casaticket/types';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { RoleCard } from '@/components/ui/role-card';
import { Screen } from '@/components/ui/screen';
import { useAuthSession } from '@/features/auth/auth-provider';
import { getUserFacingErrorMessage, logDevelopmentSupabaseError } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { updateOwnRole } from '@/features/profile/api';

export function RoleSelectionScreen() {
  const queryClient = useQueryClient();
  const { refreshProfile, sessionState, signOut } = useAuthSession();
  const [selectedRole, setSelectedRole] = useState<SelectableMobileRole | null>(
    sessionState.status === 'authenticated' ? sessionState.profile?.role ?? null : null,
  );
  const [error, setError] = useState<string | null>(null);

  const roleMutation = useMutation({
    mutationFn: updateOwnRole,
    onSuccess: async () => {
      if (sessionState.status === 'authenticated') {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.profile(sessionState.user.id),
        });
      }

      await refreshProfile();
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
        onPress={() => setSelectedRole('customer')}
        selected={selectedRole === 'customer'}
        title="Necesito resolver algo en mi casa"
      />
      <RoleCard
        description="Creá tu perfil y encontrá oportunidades cerca de tu zona."
        onPress={() => setSelectedRole('professional')}
        selected={selectedRole === 'professional'}
        title="Quiero ofrecer mis servicios"
      />
      {error ? <ErrorState message={error} title="No pudimos avanzar" /> : null}
      <Card>
        <Text style={{ color: '#675a49', fontSize: 14, lineHeight: 20 }}>
          Roles habilitados en esta fase: cliente o profesional. Los roles internos quedan
          reservados para la operación de CasaTicket.
        </Text>
        <Button loading={roleMutation.isPending} onPress={confirmSelection}>
          Guardar elección
        </Button>
      </Card>
    </Screen>
  );
}
