import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getApplicationProposalTypeLabel,
  getApplicationStatusLabel,
  getProfileDisplayName,
  getServiceRequestTypeLabel,
  getServiceRequestUrgencyLabel,
} from '@casaticket/domain';
import type {
  ProfessionalApplication,
  ProfessionalOpportunity,
  ProfessionalSelectedJob,
} from '@casaticket/types';
import type { CreateApplicationInput, ProfessionalOnboardingInput } from '@casaticket/validation';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Screen } from '@/components/ui/screen';
import {
  getAvailabilityBadge,
  getVerificationLabel,
  StatusBadge,
} from '@/components/ui/status-badge';
import { PrimaryActionBar, StatusHeader } from '@/components/ui/workflow';
import { ensureApplicationConversation } from '@/features/applications/chat-api';
import { useAuthSession } from '@/features/auth/auth-provider';
import { listActiveCategories } from '@/features/categories/api';
import { resolveAppRoute } from '@/features/navigation/access';
import { ApplicationForm } from '@/features/professional/application-form';
import {
  createApplication,
  getOwnApplication,
  getProfessionalOpportunity,
  listOwnApplications,
  listProfessionalOpportunities,
  listProfessionalSelectedJobs,
  withdrawApplication,
} from '@/features/professional/opportunities-api';
import { getMobileJobStatusLabel } from '@/features/jobs/status-labels';
import { ProfessionalProfileForm } from '@/features/professional/professional-profile-form';
import { saveProfessionalOnboarding } from '@/features/profile/api';
import { getUserFacingErrorMessage, logDevelopmentSupabaseError } from '@/lib/errors';
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
    queryKey: queryKeys.categories,
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
      subtitle="Desde acá vas a gestionar tu disponibilidad y ver oportunidades compatibles."
      title="Inicio profesional"
    >
      <Card>
        <View style={styles.row}>
          <Avatar name={getProfileDisplayName(profile)} />
          <View style={styles.copy}>
            <Text style={styles.welcomeTitle}>Hola, {profile.firstName}</Text>
            <Text style={styles.welcomeText}>
              Tu perfil ya quedó listo para recibir oportunidades del marketplace.
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
        description="Las postulaciones ya se gestionan desde Oportunidades. La selección del profesional queda para una fase posterior."
        title="Oportunidades disponibles"
      />
    </Screen>
  );
}

export function ProfessionalOpportunitiesScreen() {
  const { sessionState } = useAuthSession();
  const professionalProfile =
    sessionState.status === 'authenticated' ? sessionState.professionalProfile : null;
  const professionalId = professionalProfile?.id ?? null;
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [onlyWithoutApplication, setOnlyWithoutApplication] = useState(false);
  const opportunitiesQuery = useQuery({
    queryKey: professionalId
      ? queryKeys.professionalOpportunities(professionalId)
      : ['professional-opportunities'],
    queryFn: () => listProfessionalOpportunities(professionalId ?? ''),
    enabled: Boolean(professionalId),
  });
  const applicationsQuery = useQuery({
    queryKey: professionalId
      ? queryKeys.professionalApplications(professionalId)
      : ['professional-applications'],
    queryFn: () => listOwnApplications(professionalId ?? ''),
    enabled: Boolean(professionalId),
  });
  const applicationsByRequest = useMemo(
    () =>
      new Map((applicationsQuery.data ?? []).map((application) => [application.requestId, application])),
    [applicationsQuery.data],
  );
  const opportunities = opportunitiesQuery.data ?? [];
  const categories = uniqueValues(opportunities.map((opportunity) => opportunity.categoryName ?? 'Sin categoría'));
  const urgencies = uniqueValues(opportunities.map((opportunity) => opportunity.urgency));
  const cities = uniqueValues(opportunities.map((opportunity) => opportunity.city));
  const filteredOpportunities = opportunities.filter((opportunity) => {
    const categoryName = opportunity.categoryName ?? 'Sin categoría';

    return (
      (!categoryFilter || categoryName === categoryFilter) &&
      (!urgencyFilter || opportunity.urgency === urgencyFilter) &&
      (!cityFilter || opportunity.city === cityFilter) &&
      (!onlyWithoutApplication || !applicationsByRequest.has(opportunity.requestId))
    );
  });

  if (!professionalId) {
    return (
      <Screen subtitle="Todavía estamos resolviendo tu perfil profesional." title="Oportunidades">
        <ErrorState message="No encontramos tu perfil profesional todavía." />
      </Screen>
    );
  }

  if (opportunitiesQuery.isPending || applicationsQuery.isPending) {
    return (
      <Screen subtitle="Buscando solicitudes compatibles con tus rubros." title="Oportunidades">
        <LoadingState message="Cargando oportunidades..." />
      </Screen>
    );
  }

  if (opportunitiesQuery.error || applicationsQuery.error) {
    return (
      <Screen subtitle="Buscando solicitudes compatibles con tus rubros." title="Oportunidades">
        <ErrorState
          message="No pudimos cargar oportunidades."
          onRetry={() => {
            void opportunitiesQuery.refetch();
            void applicationsQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen
      subtitle="Solicitudes publicadas compatibles con tus rubros. No mostramos dirección exacta ni datos del cliente."
      title="Oportunidades"
    >
      <OpportunityFilters
        categories={categories}
        categoryFilter={categoryFilter}
        cities={cities}
        cityFilter={cityFilter}
        onCategoryChange={setCategoryFilter}
        onCityChange={setCityFilter}
        onOnlyWithoutApplicationChange={setOnlyWithoutApplication}
        onUrgencyChange={setUrgencyFilter}
        onlyWithoutApplication={onlyWithoutApplication}
        urgencies={urgencies}
        urgencyFilter={urgencyFilter}
      />
      <Button
        onPress={() => {
          void opportunitiesQuery.refetch();
          void applicationsQuery.refetch();
        }}
        variant="secondary"
      >
        Actualizar oportunidades
      </Button>
      {filteredOpportunities.length === 0 ? (
        <EmptyState
          description="No hay solicitudes compatibles con los filtros actuales."
          title="Sin oportunidades todavía"
        />
      ) : (
        filteredOpportunities.map((opportunity) => (
          <OpportunityListItem
            application={applicationsByRequest.get(opportunity.requestId) ?? null}
            key={opportunity.requestId}
            opportunity={opportunity}
          />
        ))
      )}
    </Screen>
  );
}

export function ProfessionalOpportunityDetailScreen({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();
  const { sessionState } = useAuthSession();
  const professionalProfile =
    sessionState.status === 'authenticated' ? sessionState.professionalProfile : null;
  const professionalId = professionalProfile?.id ?? null;
  const [error, setError] = useState<string | null>(null);
  const opportunityQuery = useQuery({
    queryKey:
      professionalId && requestId
        ? queryKeys.professionalOpportunity(professionalId, requestId)
        : ['professional-opportunity', requestId],
    queryFn: () => getProfessionalOpportunity(requestId, professionalId ?? ''),
    enabled: Boolean(professionalId && requestId),
  });
  const applicationQuery = useQuery({
    queryKey:
      professionalId && requestId
        ? queryKeys.professionalApplication(professionalId, requestId)
        : ['professional-application', requestId],
    queryFn: () => getOwnApplication(requestId, professionalId ?? ''),
    enabled: Boolean(professionalId && requestId),
  });
  const createMutation = useMutation({
    mutationFn: (values: CreateApplicationInput) =>
      createApplication(professionalId ?? '', requestId, values),
    onSuccess: (application) => {
      if (!professionalId) {
        return;
      }

      queryClient.setQueryData(queryKeys.professionalApplication(professionalId, requestId), application);
      queryClient.setQueryData<ProfessionalApplication[]>(
        queryKeys.professionalApplications(professionalId),
        (currentApplications = []) => [
          application,
          ...currentApplications.filter((item) => item.id !== application.id),
        ],
      );
    },
  });
  const withdrawMutation = useMutation({
    mutationFn: (application: ProfessionalApplication) =>
      withdrawApplication(application.id, professionalId ?? ''),
    onSuccess: (application) => {
      if (!professionalId) {
        return;
      }

      queryClient.setQueryData(queryKeys.professionalApplication(professionalId, requestId), application);
      queryClient.setQueryData<ProfessionalApplication[]>(
        queryKeys.professionalApplications(professionalId),
        (currentApplications = []) =>
          currentApplications.map((item) => (item.id === application.id ? application : item)),
      );
    },
  });
  const openConversationMutation = useMutation({
    mutationFn: ensureApplicationConversation,
    onSuccess: (conversation) => {
      if (!professionalId) {
        return;
      }

      queryClient.setQueryData(queryKeys.applicationConversation(conversation.applicationId), conversation);
      updateProfessionalApplicationChatCache({
        conversationId: conversation.id,
        professionalId,
        queryClient,
        requestId,
        unreadCount: conversation.unreadCount,
      });
      navigateToConversation(conversation.id);
    },
  });
  const navigateToConversation = (conversationId: string) => {
    router.push({
      pathname: '/chat/[conversationId]',
      params: { conversationId },
    } as Href);
  };

  if (!professionalId) {
    return (
      <Screen subtitle="Todavía estamos resolviendo tu perfil profesional." title="Oportunidad">
        <ErrorState message="No encontramos tu perfil profesional todavía." />
      </Screen>
    );
  }

  if (opportunityQuery.isPending || applicationQuery.isPending) {
    return (
      <Screen subtitle="Buscando el detalle de esta oportunidad." title="Oportunidad">
        <LoadingState message="Cargando oportunidad..." />
      </Screen>
    );
  }

  if (opportunityQuery.error || !opportunityQuery.data) {
    return (
      <Screen subtitle="Buscando el detalle de esta oportunidad." title="Oportunidad">
        <ErrorState
          message="No pudimos abrir esta oportunidad."
          onRetry={() => void opportunityQuery.refetch()}
        />
      </Screen>
    );
  }

  const opportunity = opportunityQuery.data;
  const application = applicationQuery.data ?? null;
  const withdraw = () => {
    if (!application) {
      return;
    }

    Alert.alert(
      'Retirar postulación',
      'La postulación quedará visible para vos como retirada.',
      [
        { style: 'cancel', text: 'Volver' },
        {
          onPress: () => void withdrawMutation.mutateAsync(application),
          style: 'destructive',
          text: 'Retirar postulación',
        },
      ],
    );
  };

  return (
    <Screen subtitle="Detalle seguro de la solicitud publicada." title={opportunity.title}>
      <OpportunityDetailCard opportunity={opportunity} />
      {application ? (
        <>
          <ApplicationSummary application={application} />
          <Button
            onPress={() => {
              if (application.conversationId) {
                navigateToConversation(application.conversationId);
                return;
              }

              void openConversationMutation.mutateAsync(application.id).catch((openError) => {
                logDevelopmentSupabaseError('professional-applications:open-chat', openError);
              });
            }}
            variant="secondary"
          >
            Abrir conversación
          </Button>
          {openConversationMutation.error ? (
            <ErrorState message="No pudimos abrir la conversacion." title="Chat no disponible" />
          ) : null}
        </>
      ) : (
        <>
          {error ? <ErrorState message={error} title="No pudimos enviar la postulación" /> : null}
          <ApplicationForm
            loading={createMutation.isPending}
            onSubmit={async (values) => {
              setError(null);

              try {
                await createMutation.mutateAsync(values);
              } catch (submissionError) {
                logDevelopmentSupabaseError('professional-applications:create-screen', submissionError);
                setError(
                  getUserFacingErrorMessage(
                    submissionError,
                    'No pudimos enviar la postulación.',
                  ),
                );
              }
            }}
          />
        </>
      )}
      {application && ['submitted', 'viewed'].includes(application.status) ? (
        <Button disabled={withdrawMutation.isPending} onPress={withdraw} variant="danger">
          {withdrawMutation.isPending ? 'Retirando...' : 'Retirar postulación'}
        </Button>
      ) : null}
      {withdrawMutation.error ? (
        <ErrorState message="No pudimos retirar la postulación." title="Retiro fallido" />
      ) : null}
    </Screen>
  );
}

export function ProfessionalJobsScreen() {
  const queryClient = useQueryClient();
  const { sessionState } = useAuthSession();
  const professionalProfile =
    sessionState.status === 'authenticated' ? sessionState.professionalProfile : null;
  const professionalId = professionalProfile?.id ?? null;
  const selectedJobsQuery = useQuery({
    queryKey: professionalId
      ? queryKeys.professionalSelectedJobs(professionalId)
      : ['professional-selected-jobs'],
    queryFn: () => listProfessionalSelectedJobs(professionalId ?? ''),
    enabled: Boolean(professionalId),
  });
  const openJobConversationMutation = useMutation({
    mutationFn: ensureApplicationConversation,
    onSuccess: (conversation) => {
      if (!professionalId) {
        return;
      }

      queryClient.setQueryData(queryKeys.applicationConversation(conversation.applicationId), conversation);
      updateProfessionalSelectedJobChatCache({
        applicationId: conversation.applicationId,
        conversationId: conversation.id,
        professionalId,
        queryClient,
        unreadCount: conversation.unreadCount,
      });
      navigateToJobConversation(conversation.id);
    },
  });
  const navigateToJobConversation = (conversationId: string) => {
    router.push({
      pathname: '/chat/[conversationId]',
      params: { conversationId },
    } as Href);
  };

  if (!professionalId) {
    return (
      <Screen subtitle="Todavía estamos resolviendo tu perfil profesional." title="Mis trabajos">
        <ErrorState message="No encontramos tu perfil profesional todavía." />
      </Screen>
    );
  }

  if (selectedJobsQuery.isPending) {
    return (
      <Screen subtitle="Solicitudes donde el cliente ya te eligio." title="Mis trabajos">
        <LoadingState message="Cargando trabajos..." />
      </Screen>
    );
  }

  if (selectedJobsQuery.error) {
    return (
      <Screen subtitle="Solicitudes donde el cliente ya te eligio." title="Mis trabajos">
        <ErrorState
          message="No pudimos cargar tus trabajos."
          onRetry={() => void selectedJobsQuery.refetch()}
        />
      </Screen>
    );
  }

  const selectedJobs = selectedJobsQuery.data ?? [];

  return (
    <Screen subtitle="Solicitudes donde el cliente ya te eligió." title="Mis trabajos">
      {openJobConversationMutation.error ? (
        <ErrorState message="No pudimos abrir la conversacion." title="Chat no disponible" />
      ) : null}
      {selectedJobs.length === 0 ? (
        <EmptyState
          description="Cuando un cliente seleccione tu postulación, la vas a ver en esta sección."
          title="Todavía no hay trabajos"
        />
      ) : (
        selectedJobs.map((job) => {
          const openChat = () => {
            if (job.conversationId) {
              navigateToJobConversation(job.conversationId);
              return;
            }

            void openJobConversationMutation.mutateAsync(job.applicationId).catch((openError) => {
              logDevelopmentSupabaseError('professional-jobs:open-chat', openError);
            });
          };

          return (
            <ProfessionalSelectedJobCard
              job={job}
              key={job.applicationId}
              onManageJob={() => {
                console.info('[professional-jobs:navigation]', {
                  jobId: job.jobId,
                  requestId: job.requestId,
                });

                if (!job.jobId) {
                  return;
                }

                router.push({
                  pathname: '/(professional)/jobs/[jobId]',
                  params: { jobId: job.jobId },
                } as Href);
              }}
              onOpenChat={openChat}
            />
          );
        })
      )}
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
  const { sessionState, setProfileFromMutation, signOut } = useAuthSession();
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
    onSuccess: ({ categories, professionalProfile: updatedProfessionalProfile, profile: updatedProfile }) => {
      if (sessionState.status === 'authenticated') {
        queryClient.setQueryData(queryKeys.profile(sessionState.user.id), updatedProfile);
        queryClient.setQueryData(
          queryKeys.professionalProfile(sessionState.user.id),
          updatedProfessionalProfile,
        );
        queryClient.setQueryData(queryKeys.professionalCategories(sessionState.user.id), categories);
        setProfileFromMutation(updatedProfile);

        const resolvedRoute = resolveAppRoute({
          isAuthenticated: true,
          profile: updatedProfile,
          professionalProfile: updatedProfessionalProfile,
          professionalCategoryIds: categories,
        });

        if (process.env.NODE_ENV !== 'production') {
          console.info('[professional-onboarding] profile saved', {
            userId: sessionState.user.id,
            profileCacheUpdated:
              queryClient.getQueryData(queryKeys.profile(sessionState.user.id)) === updatedProfile,
            professionalProfileCacheUpdated:
              queryClient.getQueryData(queryKeys.professionalProfile(sessionState.user.id)) ===
              updatedProfessionalProfile,
            categoryCount: categories.length,
            onboardingCompleted: updatedProfile.onboardingCompleted,
            resolvedRoute,
          });
        }

        router.replace(resolvedRoute as Href);
      }
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
            logDevelopmentSupabaseError('professional-onboarding', submissionError);
            setError(
              getUserFacingErrorMessage(
                submissionError,
                'No pudimos guardar tu perfil profesional.',
              ),
            );
          }
        }}
        submitLabel={mode === 'onboarding' ? 'Finalizar onboarding' : 'Guardar cambios'}
      />
    </Screen>
  );
}

function OpportunityFilters({
  categories,
  categoryFilter,
  cities,
  cityFilter,
  onCategoryChange,
  onCityChange,
  onOnlyWithoutApplicationChange,
  onUrgencyChange,
  onlyWithoutApplication,
  urgencies,
  urgencyFilter,
}: {
  categories: string[];
  categoryFilter: string | null;
  cities: string[];
  cityFilter: string | null;
  onCategoryChange: (value: string | null) => void;
  onCityChange: (value: string | null) => void;
  onOnlyWithoutApplicationChange: (value: boolean) => void;
  onUrgencyChange: (value: string | null) => void;
  onlyWithoutApplication: boolean;
  urgencies: string[];
  urgencyFilter: string | null;
}) {
  return (
    <Card>
      <Text style={styles.filterTitle}>Filtros rápidos</Text>
      <FilterPills
        currentValue={categoryFilter}
        label="Categoría"
        onChange={onCategoryChange}
        values={categories}
      />
      <FilterPills
        currentValue={urgencyFilter}
        label="Urgencia"
        onChange={onUrgencyChange}
        values={urgencies}
        valueLabel={(value) => getServiceRequestUrgencyLabel(value as ProfessionalOpportunity['urgency'])}
      />
      <FilterPills currentValue={cityFilter} label="Ciudad" onChange={onCityChange} values={cities} />
      <Pressable
        onPress={() => onOnlyWithoutApplicationChange(!onlyWithoutApplication)}
        style={[styles.choice, onlyWithoutApplication ? styles.choiceSelected : null]}
      >
        <Text style={[styles.choiceLabel, onlyWithoutApplication ? styles.choiceLabelSelected : null]}>
          Solo sin mi postulación
        </Text>
      </Pressable>
    </Card>
  );
}

function FilterPills({
  currentValue,
  label,
  onChange,
  valueLabel = (value) => value,
  values,
}: {
  currentValue: string | null;
  label: string;
  onChange: (value: string | null) => void;
  valueLabel?: (value: string) => string;
  values: string[];
}) {
  if (values.length === 0) {
    return null;
  }

  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.pillRow}>
        <Pressable
          onPress={() => onChange(null)}
          style={[styles.choice, currentValue === null ? styles.choiceSelected : null]}
        >
          <Text style={[styles.choiceLabel, currentValue === null ? styles.choiceLabelSelected : null]}>
            Todas
          </Text>
        </Pressable>
        {values.map((value) => (
          <Pressable
            key={value}
            onPress={() => onChange(value)}
            style={[styles.choice, currentValue === value ? styles.choiceSelected : null]}
          >
            <Text style={[styles.choiceLabel, currentValue === value ? styles.choiceLabelSelected : null]}>
              {valueLabel(value)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function OpportunityListItem({
  application,
  opportunity,
}: {
  application: ProfessionalApplication | null;
  opportunity: ProfessionalOpportunity;
}) {
  return (
    <Pressable onPress={() => router.push(`/(professional)/opportunities/${opportunity.requestId}` as Href)}>
      <Card>
        <View style={styles.requestCard}>
          <Text style={styles.requestTitle}>{opportunity.title}</Text>
          <Text style={styles.requestMeta}>
            {opportunity.categoryName ?? 'No estoy seguro del rubro'} · {opportunity.city}
          </Text>
          <Text style={styles.requestMeta}>
            {getServiceRequestUrgencyLabel(opportunity.urgency)} · {getServiceRequestTypeLabel(opportunity.requestType)}
          </Text>
          <Text style={styles.requestMeta}>Publicada: {formatDateTime(opportunity.publishedAt)}</Text>
          {opportunity.preferredDate ? (
            <Text style={styles.requestMeta}>Fecha preferida: {opportunity.preferredDate}</Text>
          ) : null}
          {application ? (
            <StatusBadge tone="accent" value={`Postulación ${getApplicationStatusLabel(application.status)}`} />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function OpportunityDetailCard({ opportunity }: { opportunity: ProfessionalOpportunity }) {
  return (
    <Card>
      <View style={styles.requestCard}>
        <Text style={styles.requestTitle}>{opportunity.title}</Text>
        <Text style={styles.requestDescription}>{opportunity.description}</Text>
        <Text style={styles.requestMeta}>
          Categoría: {opportunity.categoryName ?? 'No estoy seguro del rubro'}
        </Text>
        <Text style={styles.requestMeta}>
          Ubicación: {opportunity.city}, {opportunity.province}
        </Text>
        <Text style={styles.requestMeta}>Tipo: {getServiceRequestTypeLabel(opportunity.requestType)}</Text>
        <Text style={styles.requestMeta}>Urgencia: {getServiceRequestUrgencyLabel(opportunity.urgency)}</Text>
        <Text style={styles.requestMeta}>
          Fecha preferida: {opportunity.preferredDate ?? 'Sin fecha preferida'}
        </Text>
        <Text style={styles.requestMeta}>
          Horario: {opportunity.preferredTimeText ?? 'Sin horario específico'}
        </Text>
        <Text style={styles.requestMeta}>
          Disponibilidad: {opportunity.availabilityNotes ?? 'Sin notas adicionales'}
        </Text>
        <Text style={styles.requestMeta}>Publicada: {formatDateTime(opportunity.publishedAt)}</Text>
      </View>
    </Card>
  );
}

function ApplicationSummary({ application }: { application: ProfessionalApplication }) {
  return (
    <Card>
      <View style={styles.requestCard}>
        <Text style={styles.requestTitle}>Tu postulación</Text>
        {application.unreadCount > 0 ? (
          <Text style={styles.unreadText}>{application.unreadCount} mensajes sin leer</Text>
        ) : null}
        <Text style={styles.requestMeta}>Estado: {getApplicationStatusLabel(application.status)}</Text>
        <Text style={styles.requestMeta}>
          Tipo: {getApplicationProposalTypeLabel(application.proposalType)}
        </Text>
        <Text style={styles.requestDescription}>{application.message}</Text>
        <Text style={styles.requestMeta}>Disponibilidad: {application.availabilityText}</Text>
        <Text style={styles.requestMeta}>
          Visita: {formatPrice(application.visitPrice) ?? 'Sin precio de visita'}
        </Text>
        <Text style={styles.requestMeta}>
          Estimado: {formatPrice(application.estimatedPrice) ?? 'Sin precio estimado'}
        </Text>
        <Text style={styles.requestMeta}>
          Duración: {application.estimatedDurationText ?? 'Sin duración estimada'}
        </Text>
        <ConversationSummary
          lastMessageAt={application.lastMessageAt}
          lastMessageBody={application.lastMessageBody}
          unreadCount={application.unreadCount}
        />
      </View>
    </Card>
  );
}

function ConversationSummary({
  lastMessageAt,
  lastMessageBody,
  unreadCount,
}: {
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  unreadCount: number;
}) {
  return (
    <View style={styles.conversationSummary}>
      <View style={styles.copy}>
        <Text style={styles.requestTitle}>Conversación</Text>
        <Text numberOfLines={2} style={styles.requestMeta}>
          {lastMessageBody ? `Último mensaje: ${lastMessageBody}` : 'Todavía no hay mensajes.'}
        </Text>
        {lastMessageAt ? <Text style={styles.requestMeta}>{formatDateTime(lastMessageAt)}</Text> : null}
      </View>
      {unreadCount > 0 ? <Text style={styles.unreadBadge}>{unreadCount}</Text> : null}
    </View>
  );
}

function ProfessionalSelectedJobCard({
  job,
  onManageJob,
  onOpenChat,
}: {
  job: ProfessionalSelectedJob;
  onManageJob: () => void;
  onOpenChat: () => void;
}) {
  const nextAction = getProfessionalJobNextAction(job.jobStatus);

  return (
    <Card>
      <View style={styles.requestCard}>
        <StatusHeader
          actionLabel={nextAction}
          description={`${job.categoryName ?? 'Sin categoría'} · ${job.city}`}
          status={job.jobStatus ? getMobileJobStatusLabel(job.jobStatus) : 'Profesional seleccionado'}
          tone="success"
        />
        <Text style={styles.requestTitle}>{job.title}</Text>
        <Text style={styles.requestMeta}>Fecha relevante: {formatDateTime(job.selectedAt)}</Text>
        <ConversationSummary
          lastMessageAt={job.lastMessageAt}
          lastMessageBody={job.lastMessageBody}
          unreadCount={job.unreadCount}
        />
        <PrimaryActionBar
          primaryAction={
            job.jobId ? (
              <Button onPress={onManageJob}>Gestionar trabajo</Button>
            ) : (
              <Text style={styles.requestMeta}>El trabajo todavía no está disponible para gestionar.</Text>
            )
          }
          secondaryAction={
            <Button onPress={onOpenChat} variant="secondary">
              Abrir conversación
            </Button>
          }
        />
      </View>
    </Card>
  );
}

function updateProfessionalApplicationChatCache({
  conversationId,
  professionalId,
  queryClient,
  requestId,
  unreadCount,
}: {
  conversationId?: string;
  professionalId: string;
  queryClient: QueryClient;
  requestId: string;
  unreadCount?: number;
}) {
  const patch: Partial<Pick<ProfessionalApplication, 'conversationId' | 'unreadCount'>> = {};

  if (typeof conversationId !== 'undefined') {
    patch.conversationId = conversationId;
  }

  if (typeof unreadCount !== 'undefined') {
    patch.unreadCount = unreadCount;
  }

  queryClient.setQueryData<ProfessionalApplication | null>(
    queryKeys.professionalApplication(professionalId, requestId),
    (currentApplication) => (currentApplication ? { ...currentApplication, ...patch } : currentApplication),
  );
  queryClient.setQueryData<ProfessionalApplication[]>(
    queryKeys.professionalApplications(professionalId),
    (currentApplications = []) =>
      currentApplications.map((application) =>
        application.requestId === requestId ? { ...application, ...patch } : application,
      ),
  );
}

function updateProfessionalSelectedJobChatCache({
  applicationId,
  conversationId,
  professionalId,
  queryClient,
  unreadCount,
}: {
  applicationId: string;
  conversationId?: string;
  professionalId: string;
  queryClient: QueryClient;
  unreadCount?: number;
}) {
  const patch: Partial<Pick<ProfessionalSelectedJob, 'conversationId' | 'unreadCount'>> = {};

  if (typeof conversationId !== 'undefined') {
    patch.conversationId = conversationId;
  }

  if (typeof unreadCount !== 'undefined') {
    patch.unreadCount = unreadCount;
  }

  queryClient.setQueryData<ProfessionalSelectedJob[]>(
    queryKeys.professionalSelectedJobs(professionalId),
    (currentJobs = []) =>
      currentJobs.map((job) => (job.applicationId === applicationId ? { ...job, ...patch } : job)),
  );
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPrice(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return new Intl.NumberFormat('es-AR', {
    currency: 'ARS',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function getProfessionalJobNextAction(status: ProfessionalSelectedJob['jobStatus']): string {
  switch (status) {
    case 'coordination_pending':
      return 'Proponer visita';
    case 'visit_proposed':
      return 'Esperar confirmación';
    case 'visit_confirmed':
    case 'diagnosis_pending':
      return 'Registrar diagnóstico';
    case 'quote_pending':
      return 'Crear presupuesto';
    case 'quote_sent':
      return 'Esperar respuesta';
    case 'quote_rejected':
      return 'Crear nueva versión';
    case 'quote_accepted':
      return 'Presupuesto aceptado';
    case 'cancelled':
      return 'Trabajo cancelado';
    case null:
      return 'Gestionar trabajo';
  }
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
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1811',
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#675a49',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dccbb1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  choiceSelected: {
    borderColor: '#bb5e3c',
    backgroundColor: '#f2ddd1',
  },
  choiceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d1811',
  },
  choiceLabelSelected: {
    color: '#bb5e3c',
  },
  requestCard: {
    gap: 10,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1811',
  },
  requestMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: '#675a49',
  },
  requestDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1d1811',
  },
  conversationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    backgroundColor: '#f3eadc',
    padding: 12,
  },
  unreadBadge: {
    minWidth: 28,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#bb5e3c',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
  },
  unreadText: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#bb5e3c',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
