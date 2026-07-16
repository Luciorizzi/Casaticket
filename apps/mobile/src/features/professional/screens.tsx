import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { getProfileDisplayName } from '@casaticket/domain';
import type { ProfessionalOnboardingInput } from '@casaticket/validation';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import {
  getAvailabilityBadge,
  getVerificationLabel,
  StatusBadge,
} from '@/components/ui/status-badge';
import { useAuthSession } from '@/features/auth/auth-provider';
import { listActiveCategories } from '@/features/categories/api';
import { ProfessionalProfileForm } from '@/features/professional/professional-profile-form';
import { saveProfessionalOnboarding } from '@/features/profile/api';
import { queryKeys } from '@/lib/query-keys';

export function ProfessionalOnboardingScreen() {
  return (
    <ProfessionalProfileEditorScreen
      mode="onboarding"
      subtitle="Completá tu perfil profesional para empezar a recibir oportunidades relevantes."
      title="Tu perfil profesional"
    />
  );
}

export function ProfessionalHomeScreen() {
  const { sessionState } = useAuthSession();
  const profile = sessionState.status === 'authenticated' ? sessionState.profile : null;
  const professionalProfile =
    sessionState.status === 'authenticated' ? sessionState.professionalProfile : null;
  const professionalCategoryIds = useMemo(
    () =>
      sessionState.status === 'authenticated' ? sessionState.professionalCategoryIds : [],
    [sessionState],
  );
  const categoryQuery = useQuery({
    queryKey: ['categories'],
    queryFn: listActiveCategories,
  });

  const categoryLabels = (categoryQuery.data ?? [])
    .filter((category) => professionalCategoryIds.includes(category.id))
    .map((category) => category.name);

  if (!profile || !professionalProfile) {
    return (
      <Screen subtitle="Todavía estamos resolviendo tu perfil profesional." title="Inicio">
        <ErrorState message="No encontramos la información profesional todavía." />
      </Screen>
    );
  }

  return (
    <Screen
      subtitle="Desde acá vas a gestionar tu disponibilidad y más adelante tus oportunidades."
      title="Inicio profesional"
    >
      <Card>
        <View style={styles.row}>
          <Avatar name={getProfileDisplayName(profile)} />
          <View style={styles.copy}>
            <Text style={styles.welcomeTitle}>Hola, {profile.firstName}</Text>
            <Text style={styles.welcomeText}>
              Tu perfil ya quedó listo para la próxima fase del marketplace.
            </Text>
          </View>
        </View>
        <View style={styles.badges}>
          <StatusBadge
            tone="warning"
            value={getVerificationLabel(professionalProfile.verificationStatus)}
          />
          <StatusBadge
            tone="accent"
            value={getAvailabilityBadge(professionalProfile.availabilityStatus)}
          />
        </View>
        <Text style={styles.detailText}>Radio: {professionalProfile.serviceRadiusKm} km</Text>
        <Text style={styles.detailText}>
          Rubros: {categoryLabels.join(', ') || 'Todavía sin rubros cargados'}
        </Text>
        <Button onPress={() => router.push('/(professional)/opportunities')}>Ver oportunidades</Button>
      </Card>

      <EmptyState
        description="Oportunidades y trabajos siguen en modo placeholder. La navegación y el estado del perfil ya están listos para la fase siguiente."
        title="Todavía no hay oportunidades activas"
      />
    </Screen>
  );
}

export function ProfessionalOpportunitiesScreen() {
  return (
    <Screen
      subtitle="Este módulo va a mostrar oportunidades compatibles con tus rubros y tu radio de trabajo."
      title="Oportunidades"
    >
      <EmptyState
        description="La estructura de navegación ya está separada para profesionales. El listado real llega después."
        title="Sin oportunidades todavía"
      />
    </Screen>
  );
}

export function ProfessionalJobsScreen() {
  return (
    <Screen subtitle="Más adelante vas a seguir tus trabajos desde acá." title="Mis trabajos">
      <EmptyState
        description="En esta fase dejamos listo el acceso por rol, el perfil y la persistencia de sesión."
        title="Todavía no hay trabajos"
      />
    </Screen>
  );
}

export function ProfessionalProfileScreen() {
  return (
    <ProfessionalProfileEditorScreen
      mode="edit"
      subtitle="Editá tu perfil profesional, tus rubros y tu disponibilidad."
      title="Perfil"
    />
  );
}

function ProfessionalProfileEditorScreen({
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
  const professionalProfile =
    sessionState.status === 'authenticated' ? sessionState.professionalProfile : null;
  const professionalCategoryIds = useMemo(
    () =>
      sessionState.status === 'authenticated' ? sessionState.professionalCategoryIds : [],
    [sessionState],
  );
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: saveProfessionalOnboarding,
    onSuccess: async () => {
      if (sessionState.status === 'authenticated') {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.profile(sessionState.user.id),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.professionalProfile(sessionState.user.id),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.professionalCategories(sessionState.user.id),
        });
      }

      await refreshProfile();
    },
  });

  const initialValues = useMemo<ProfessionalOnboardingInput>(
    () => ({
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      phone: profile?.phone ?? '',
      city: profile?.city ?? '',
      province: profile?.province ?? '',
      bio: professionalProfile?.bio ?? '',
      yearsExperience: professionalProfile?.yearsExperience ?? 0,
      baseCity: professionalProfile?.baseCity ?? profile?.city ?? '',
      serviceRadiusKm: professionalProfile?.serviceRadiusKm ?? 10,
      availabilityStatus: professionalProfile?.availabilityStatus ?? 'available',
      categoryIds: professionalCategoryIds,
    }),
    [professionalCategoryIds, professionalProfile, profile],
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
      {profile.role === 'professional' && mode === 'edit' ? (
        <Card>
          <Text style={styles.infoText}>
            Si en el futuro necesitás cambiar el tipo de cuenta, contactá a soporte para revisarlo
            junto con el equipo operativo.
          </Text>
        </Card>
      ) : null}
      {error ? <ErrorState message={error} title="No pudimos guardar el perfil" /> : null}
      <ProfessionalProfileForm
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
                : 'No pudimos guardar tu perfil profesional.',
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
  badges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  detailText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1d1811',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#675a49',
  },
});
