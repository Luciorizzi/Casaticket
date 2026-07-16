import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { getProfileDisplayName } from '@casaticket/domain';
import type { CustomerOnboardingInput } from '@casaticket/validation';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import { useAuthSession } from '@/features/auth/auth-provider';
import { CustomerProfileForm } from '@/features/customer/customer-profile-form';
import { fetchOwnDefaultAddress, saveCustomerOnboarding } from '@/features/profile/api';
import { queryKeys } from '@/lib/query-keys';

export function CustomerOnboardingScreen() {
  return (
    <CustomerProfileEditorScreen
      mode="onboarding"
      subtitle="Completá tus datos básicos para empezar a publicar necesidades del hogar."
      title="Tu perfil de cliente"
    />
  );
}

export function CustomerHomeScreen() {
  const { sessionState } = useAuthSession();
  const profile = sessionState.status === 'authenticated' ? sessionState.profile : null;

  if (!profile) {
    return (
      <Screen subtitle="No encontramos tu perfil todavía." title="Inicio">
        <ErrorState message="Probá cerrar sesión y volver a ingresar." />
      </Screen>
    );
  }

  return (
    <Screen subtitle="Desde acá vas a publicar tus solicitudes y seguir su estado." title="Inicio">
      <Card>
        <View style={styles.row}>
          <Avatar name={getProfileDisplayName(profile)} />
          <View style={styles.copy}>
            <Text style={styles.welcomeTitle}>Hola, {profile.firstName}</Text>
            <Text style={styles.welcomeText}>
              Cuando quieras, podés publicar tu próxima solicitud para el hogar.
            </Text>
          </View>
        </View>
        <Button onPress={() => router.push('/(customer)/create-request')}>Publicar una solicitud</Button>
      </Card>

      <EmptyState
        actionLabel="Ver mi perfil"
        description="Todavía no hay solicitudes reales en esta fase. Dejamos la navegación lista para la próxima iteración."
        onAction={() => router.push('/(customer)/profile')}
        title="Todavía no tenés solicitudes"
      />
    </Screen>
  );
}

export function CustomerCreateRequestScreen() {
  return (
    <Screen
      subtitle="La navegación ya está separada por rol. El formulario real de solicitudes entra en la fase siguiente."
      title="Crear solicitud"
    >
      <EmptyState
        description="Pronto vas a poder describir tu problema, adjuntar fotos y recibir propuestas desde esta pantalla."
        title="Módulo preparado"
      />
    </Screen>
  );
}

export function CustomerRequestsScreen() {
  return (
    <Screen
      subtitle="Las solicitudes reales todavía no forman parte de esta fase, pero el espacio ya está reservado."
      title="Mis solicitudes"
    >
      <EmptyState
        description="Cuando la fase de marketplace avance, acá vas a ver el historial y el estado de cada pedido."
        title="Sin solicitudes todavía"
      />
    </Screen>
  );
}

export function CustomerProfileScreen() {
  return (
    <CustomerProfileEditorScreen
      mode="edit"
      subtitle="Editá tus datos básicos y mantené tu información al día."
      title="Perfil"
    />
  );
}

function CustomerProfileEditorScreen({
  mode,
  subtitle,
  title,
}: {
  mode: 'edit' | 'onboarding';
  subtitle: string;
  title: string;
}) {
  const queryClient = useQueryClient();
  const { refreshProfile, sessionState, signOut } = useAuthSession();
  const profile = sessionState.status === 'authenticated' ? sessionState.profile : null;
  const [error, setError] = useState<string | null>(null);

  const addressQuery = useQuery({
    queryKey:
      sessionState.status === 'authenticated'
        ? queryKeys.customerAddress(sessionState.user.id)
        : ['customer-address'],
    enabled: sessionState.status === 'authenticated',
    queryFn: fetchOwnDefaultAddress,
  });

  const saveMutation = useMutation({
    mutationFn: saveCustomerOnboarding,
    onSuccess: async () => {
      if (sessionState.status === 'authenticated') {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.profile(sessionState.user.id),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.customerAddress(sessionState.user.id),
        });
      }

      await refreshProfile();
    },
  });

  const initialValues = useMemo<CustomerOnboardingInput>(
    () => ({
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      phone: profile?.phone ?? '',
      city: profile?.city ?? '',
      province: profile?.province ?? '',
      initialAddress: addressQuery.data?.addressLine ?? '',
    }),
    [addressQuery.data?.addressLine, profile],
  );

  const signOutFooter = (
    <Button onPress={() => void signOut()} variant={mode === 'onboarding' ? 'secondary' : 'danger'}>
      Cerrar sesión
    </Button>
  );

  if (!profile) {
    return (
      <Screen footer={signOutFooter} subtitle="Todavía estamos resolviendo tu sesión." title={title}>
        <ErrorState message="No encontramos tu perfil todavía." />
      </Screen>
    );
  }

  return (
    <Screen footer={signOutFooter} subtitle={subtitle} title={title}>
      {error ? <ErrorState message={error} title="No pudimos guardar el perfil" /> : null}
      <CustomerProfileForm
        initialValues={initialValues}
        loading={saveMutation.isPending}
        onSubmit={async (values) => {
          setError(null);

          try {
            await saveMutation.mutateAsync(values);
          } catch (submissionError) {
            setError(
              submissionError instanceof Error
                ? submissionError.message
                : 'No pudimos guardar el perfil.',
            );
          }
        }}
        submitLabel={mode === 'onboarding' ? 'Finalizar onboarding' : 'Guardar cambios'}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1811',
  },
  welcomeText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#675a49',
  },
});
