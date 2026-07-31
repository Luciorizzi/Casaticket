import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SERVICE_REQUEST_URGENCIES,
  getApplicationProposalTypeLabel,
  getApplicationStatusLabel,
  getProfileDisplayName,
  getServiceRequestTypeLabel,
  getServiceRequestUrgencyLabel,
} from '@casaticket/domain';
import type {
  Category,
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
import { TextInput } from '@/components/ui/text-input';
import {
  getAvailabilityBadge,
  getVerificationLabel,
  StatusBadge,
} from '@/components/ui/status-badge';
import { PrimaryActionBar, ScreenHeader, StatusHeader } from '@/components/ui/workflow';
import { ensureApplicationConversation } from '@/features/applications/chat-api';
import { useAuthSession } from '@/features/auth/auth-provider';
import { listActiveCategories } from '@/features/categories/api';
import { resolveAppRoute } from '@/features/navigation/access';
import { ApplicationForm } from '@/features/professional/application-form';
import {
  BUENOS_AIRES_CITY_OPTIONS,
  getCityFilterValue,
  normalizeCityName,
} from '@/features/professional/city-catalog';
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
import { ProfessionalProfileHubScreen } from '@/features/professional/professional-profile-screens';
import { NotificationBell } from '@/features/notifications/notification-access';
import { saveProfessionalOnboarding } from '@/features/profile/api';
import { profileAvatarQueryKey, resolveProfileAvatarUrl } from '@/features/profile/avatar-api';
import { getUserFacingErrorMessage, logDevelopmentSupabaseError } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { AttachmentGallerySection } from '@/features/attachments/components';
import { formatLocation, getCityDisplayName } from '@/features/location/location';
import { LocationSummary } from '@/features/location/location-summary';

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
  const avatarQuery = useQuery({
    enabled: Boolean(profile?.avatarPath),
    queryFn: () => resolveProfileAvatarUrl(profile?.avatarPath ?? null),
    queryKey: profileAvatarQueryKey(profile?.avatarPath ?? null),
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
      <View style={styles.headerAction}><NotificationBell /></View>
      <Card>
        <View style={styles.row}>
          <Avatar name={getProfileDisplayName(profile)} uri={avatarQuery.data ?? null} />
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

type FilterOption = {
  keywords?: string[];
  label: string;
  value: string;
};

type OpportunitiesView = 'opportunities' | 'applications';
type ApplicationFilter = 'all' | 'pending' | 'selected' | 'rejected' | 'withdrawn';

export function ProfessionalOpportunitiesScreen() {
  const queryClient = useQueryClient();
  const { sessionState } = useAuthSession();
  const professionalProfile =
    sessionState.status === 'authenticated' ? sessionState.professionalProfile : null;
  const professionalId = professionalProfile?.id ?? null;
  const opportunitiesQueryKey = useMemo(
    () =>
      professionalId
        ? queryKeys.professionalOpportunities(professionalId)
        : ['professional-opportunities'],
    [professionalId],
  );
  const applicationsQueryKey = useMemo(
    () =>
      professionalId
        ? queryKeys.professionalApplications(professionalId)
        : ['professional-applications'],
    [professionalId],
  );
  const professionalCategoryIds = useMemo(
    () => (sessionState.status === 'authenticated' ? sessionState.professionalCategoryIds : []),
    [sessionState],
  );
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [view, setView] = useState<OpportunitiesView>('opportunities');
  const [applicationFilter, setApplicationFilter] = useState<ApplicationFilter>('all');
  const refreshInFlightRef = useRef(false);
  const opportunitiesQuery = useQuery({
    queryKey: opportunitiesQueryKey,
    queryFn: () => listProfessionalOpportunities(professionalId ?? ''),
    enabled: Boolean(professionalId),
  });
  const applicationsQuery = useQuery({
    queryKey: applicationsQueryKey,
    queryFn: () => listOwnApplications(professionalId ?? ''),
    enabled: Boolean(professionalId),
  });
  const categoryQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: listActiveCategories,
  });
  const activeApplicationsByRequest = useMemo(
    () =>
      new Map(
        (applicationsQuery.data ?? [])
          .filter((application) => ['submitted', 'viewed', 'selected'].includes(application.status))
          .map((application) => [application.requestId, application]),
      ),
    [applicationsQuery.data],
  );
  const professionalCategoryIdSet = useMemo(
    () => new Set(professionalCategoryIds),
    [professionalCategoryIds],
  );
  const activeCategories = useMemo(
    () => (categoryQuery.data ?? []).filter((category) => category.active),
    [categoryQuery.data],
  );
  const categoriesById = useMemo(
    () => new Map(activeCategories.map((category) => [category.id, category])),
    [activeCategories],
  );
  const opportunities = useMemo(
    () =>
      dedupeOpportunities(opportunitiesQuery.data ?? [])
        .filter((opportunity) =>
          isOpportunityCompatibleWithProfessional(opportunity, professionalCategoryIdSet),
        ),
    [opportunitiesQuery.data, professionalCategoryIdSet],
  );
  const categoryFilters = useMemo(
    () => createOpportunityCategoryFilters(activeCategories),
    [activeCategories],
  );
  const cityFilters = useMemo(
    () => createCityFilterOptions(opportunities),
    [opportunities],
  );
  const urgencyFilters = useMemo(
    () => createUrgencyFilterOptions(),
    [],
  );
  const filteredOpportunities = opportunities.filter((opportunity) => {
    const matchesCategory = matchesOpportunityCategoryFilter(
      opportunity,
      categoryFilter,
    );
    const matchesCity = cityFilter === 'all' || getCityFilterValue(opportunity.city) === cityFilter;
    const matchesUrgency = urgencyFilter === 'all' || opportunity.urgency === urgencyFilter;

    return (
      matchesCategory &&
      matchesCity &&
      matchesUrgency &&
      !activeApplicationsByRequest.has(opportunity.requestId)
    );
  });
  const applications = useMemo(
    () => dedupeApplications(applicationsQuery.data ?? []),
    [applicationsQuery.data],
  );
  const filteredApplications = applications.filter(
    (application) =>
      applicationFilter === 'all' || getApplicationFilter(application) === applicationFilter,
  );
  const isRefreshing =
    opportunitiesQuery.isRefetching || applicationsQuery.isRefetching || categoryQuery.isRefetching;

  const refreshOpportunities = useCallback(() => {
    if (!professionalId || refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    void Promise.allSettled([
      queryClient.refetchQueries({ exact: true, queryKey: opportunitiesQueryKey }),
      queryClient.refetchQueries({ exact: true, queryKey: applicationsQueryKey }),
      queryClient.refetchQueries({ exact: true, queryKey: queryKeys.categories }),
    ]).finally(() => {
      refreshInFlightRef.current = false;
    });
  }, [applicationsQueryKey, opportunitiesQueryKey, professionalId, queryClient]);
  const activeFilterCount = [categoryFilter, cityFilter, urgencyFilter].filter(
    (filter) => filter !== 'all',
  ).length;

  useFocusEffect(
    useCallback(() => {
      if (!professionalId) {
        return undefined;
      }

      refreshOpportunities();

      return undefined;
    }, [professionalId, refreshOpportunities]),
  );

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
            void categoryQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList<ProfessionalOpportunity | ProfessionalApplication>
        contentContainerStyle={styles.opportunitiesListContent}
        data={view === 'opportunities' ? filteredOpportunities : filteredApplications}
        ItemSeparatorComponent={() => <View style={styles.opportunitySeparator} />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) =>
          view === 'opportunities'
            ? (item as ProfessionalOpportunity).requestId
            : (item as ProfessionalApplication).id
        }
        ListEmptyComponent={
          <EmptyState
            description={view === 'opportunities'
              ? 'Probá cambiar los filtros o actualizar la lista.'
              : 'Actualizá la lista para consultar cambios recientes.'}
            title={view === 'opportunities'
              ? 'No hay oportunidades disponibles.'
              : getApplicationEmptyMessage(applicationFilter)}
          />
        }
        ListHeaderComponent={
          <View style={styles.opportunitiesListHeader}>
            <View style={styles.opportunitiesHeader} testID="opportunities-header">
              <View style={styles.opportunitiesHeaderCopy}>
                <Text style={styles.opportunitiesTitle}>Oportunidades</Text>
                <Text style={styles.opportunitiesSubtitle}>
                  Solicitudes publicadas compatibles con tus rubros.
                </Text>
                <Text numberOfLines={1} style={styles.opportunitiesPrivacy}>
                  No mostramos dirección exacta ni datos del cliente.
                </Text>
              </View>
              <RefreshIconButton
                disabled={isRefreshing}
                loading={isRefreshing}
                onRefresh={refreshOpportunities}
              />
            </View>
            <OpportunitiesViewTabs onChange={setView} value={view} />
            {view === 'opportunities' ? (
              <>
                <OpportunityFilters
                  activeFilterCount={activeFilterCount}
                  categoryFilter={categoryFilter}
                  categoryFilters={categoryFilters}
                  cityFilter={cityFilter}
                  cityFilters={cityFilters}
                  onCategoryChange={setCategoryFilter}
                  onCityChange={setCityFilter}
                  onClearCategory={() => setCategoryFilter('all')}
                  onClearCity={() => setCityFilter('all')}
                  onClearFilters={() => {
                    setCategoryFilter('all');
                    setCityFilter('all');
                    setUrgencyFilter('all');
                  }}
                  onClearUrgency={() => setUrgencyFilter('all')}
                  onUrgencyChange={setUrgencyFilter}
                  urgencyFilter={urgencyFilter}
                  urgencyFilters={urgencyFilters}
                />
                <OpportunityListHeader count={filteredOpportunities.length} />
              </>
            ) : (
              <ApplicationFilters onChange={setApplicationFilter} value={applicationFilter} />
            )}
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshOpportunities} tintColor="#bb5e3c" />
        }
        renderItem={({ item }) =>
          view === 'opportunities' ? (
            <OpportunityListItem
              application={activeApplicationsByRequest.get((item as ProfessionalOpportunity).requestId) ?? null}
              categoryName={getOpportunityCategoryName(item as ProfessionalOpportunity, categoriesById)}
              opportunity={item as ProfessionalOpportunity}
            />
          ) : (
            <ProfessionalApplicationListItem application={item as ProfessionalApplication} />
          )
        }
        showsVerticalScrollIndicator={false}
      />
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
    <Screen>
      <ScreenHeader
        backAction={<ProfessionalOpportunityBackButton />}
        subtitle="Detalle seguro de la solicitud publicada."
        title={opportunity.title}
      />
      <OpportunityDetailCard opportunity={opportunity} />
      <Card>
        <AttachmentGallerySection serviceRequestId={opportunity.requestId} title="Fotos del problema" type="request_evidence" />
      </Card>
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

function ProfessionalOpportunityBackButton() {
  return (
    <Pressable
      accessibilityLabel="Volver a oportunidades"
      accessibilityRole="button"
      onPress={() => router.replace('/(professional)/opportunities')}
      style={styles.opportunityBackButton}
    >
      <Ionicons color="#bb5e3c" name="chevron-back" size={22} />
      <Text style={styles.opportunityBackLabel}>Volver</Text>
    </Pressable>
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
  return <ProfessionalProfileHubScreen />;
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
  activeFilterCount,
  categoryFilter,
  categoryFilters,
  cityFilter,
  cityFilters,
  onCategoryChange,
  onCityChange,
  onClearCategory,
  onClearCity,
  onClearFilters,
  onClearUrgency,
  onUrgencyChange,
  urgencyFilter,
  urgencyFilters,
}: {
  activeFilterCount: number;
  categoryFilter: string;
  categoryFilters: FilterOption[];
  cityFilter: string;
  cityFilters: FilterOption[];
  onCategoryChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onClearCategory: () => void;
  onClearCity: () => void;
  onClearFilters: () => void;
  onClearUrgency: () => void;
  onUrgencyChange: (value: string) => void;
  urgencyFilter: string;
  urgencyFilters: FilterOption[];
}) {
  return (
    <View style={styles.filterBar}>
      <ScrollView
        contentContainerStyle={styles.filterChips}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterChipsScroll}
      >
        <SearchableFilter
          label="Categoría"
          onClear={onClearCategory}
          onSelect={onCategoryChange}
          options={categoryFilters}
          selectedValue={categoryFilter}
        />
        <SearchableFilter
          label="Ciudad"
          onClear={onClearCity}
          onSelect={onCityChange}
          options={cityFilters}
          selectedValue={cityFilter}
        />
        <SearchableFilter
          label="Urgencia"
          onClear={onClearUrgency}
          onSelect={onUrgencyChange}
          options={urgencyFilters}
          searchable={false}
          selectedValue={urgencyFilter}
        />
      </ScrollView>
      {activeFilterCount >= 2 ? (
        <Pressable accessibilityRole="button" onPress={onClearFilters} style={styles.clearFiltersButton}>
          <Text style={styles.clearFiltersLabel}>Limpiar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SearchableFilter({
  label,
  onClear,
  onSelect,
  options,
  searchable = true,
  selectedValue,
}: {
  label: string;
  onClear: () => void;
  onSelect: (value: string) => void;
  options: FilterOption[];
  searchable?: boolean;
  selectedValue: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedLabel = getOptionLabel(options, selectedValue);
  const active = selectedValue !== 'all';
  const normalizedLabel = label.toLocaleLowerCase('es');
  const filteredOptions = options.filter((option) => {
    const normalizedSearch = normalizeCityName(search);

    if (!normalizedSearch) {
      return true;
    }

    return [option.label, ...(option.keywords ?? [])].some((keyword) =>
      normalizeCityName(keyword).includes(normalizedSearch),
    );
  });

  return (
    <>
      <View style={[styles.filterChip, active ? styles.filterChipActive : null]}>
        <Pressable
          accessibilityLabel={`Filtrar por ${normalizedLabel}`}
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => {
            setSearch('');
            setOpen(true);
          }}
          style={styles.filterChipSelector}
        >
          <Text numberOfLines={1} style={[styles.filterChipLabel, active ? styles.filterChipLabelActive : null]}>
            {active ? selectedLabel : label}
          </Text>
          {!active ? <Ionicons color="#8c765d" name="chevron-down" size={16} /> : null}
        </Pressable>
        {active ? (
          <Pressable
            accessibilityLabel={`Limpiar filtro de ${normalizedLabel}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClear}
            style={styles.filterChipClear}
          >
            <Ionicons color="#bb5e3c" name="close" size={17} />
          </Pressable>
        ) : null}
      </View>
      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            {searchable ? (
              <TextInput
                autoFocus
                onChangeText={setSearch}
                placeholder={`Buscar ${label.toLowerCase()}`}
                value={search}
              />
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.filterModalList}>
              {filteredOptions.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  style={[
                    styles.filterOption,
                    selectedValue === option.value ? styles.filterOptionSelected : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterOptionLabel,
                      selectedValue === option.value ? styles.filterOptionLabelSelected : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button onPress={() => setOpen(false)} variant="secondary">
              Cerrar
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
}

function OpportunityListHeader({ count }: { count: number }) {
  return (
    <View style={styles.opportunityHeader}>
      <Text style={styles.opportunityCount}>
        {count} {count === 1 ? 'oportunidad' : 'oportunidades'}
      </Text>
    </View>
  );
}

const APPLICATION_FILTERS: { label: string; value: ApplicationFilter }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'Seleccionadas', value: 'selected' },
  { label: 'No seleccionadas', value: 'rejected' },
  { label: 'Retiradas', value: 'withdrawn' },
];

function OpportunitiesViewTabs({
  onChange,
  value,
}: {
  onChange: (value: OpportunitiesView) => void;
  value: OpportunitiesView;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.internalTabs}>
      {([
        ['opportunities', 'Oportunidades'],
        ['applications', 'Mis postulaciones'],
      ] as const).map(([tabValue, label]) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: value === tabValue }}
          key={tabValue}
          onPress={() => onChange(tabValue)}
          style={[styles.internalTab, value === tabValue ? styles.internalTabActive : null]}
        >
          <Text style={[styles.internalTabLabel, value === tabValue ? styles.internalTabLabelActive : null]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ApplicationFilters({
  onChange,
  value,
}: {
  onChange: (value: ApplicationFilter) => void;
  value: ApplicationFilter;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.applicationFilters}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {APPLICATION_FILTERS.map((filter) => (
        <Pressable
          accessibilityLabel={`Mostrar ${filter.label.toLowerCase()}`}
          accessibilityRole="button"
          accessibilityState={{ selected: value === filter.value }}
          key={filter.value}
          onPress={() => onChange(filter.value)}
          style={[styles.applicationFilter, value === filter.value ? styles.applicationFilterActive : null]}
        >
          <Text style={[styles.applicationFilterLabel, value === filter.value ? styles.applicationFilterLabelActive : null]}>
            {filter.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ProfessionalApplicationListItem({ application }: { application: ProfessionalApplication }) {
  const status = getProfessionalApplicationPresentation(application);
  const openApplication = () => {
    if (status.filter === 'selected') {
      if (application.jobId) {
        router.push(`/(professional)/jobs/${application.jobId}` as Href);
        return;
      }

      router.push('/(professional)/jobs');
      return;
    }

    router.push(`/(professional)/opportunities/${application.requestId}` as Href);
  };

  return (
    <Pressable
      accessibilityLabel={`Abrir postulación: ${application.requestTitle ?? 'Solicitud'}`}
      accessibilityRole="button"
      onPress={openApplication}
      testID="professional-application-card"
    >
      <View style={styles.opportunityCard}>
        <View style={styles.opportunityRow}>
          <View style={styles.opportunityCopy}>
            <Text numberOfLines={1} style={styles.opportunityCategory}>
              Postulación
            </Text>
            <Text numberOfLines={1} style={styles.requestTitle} testID="application-card-title">
              {application.requestTitle ?? 'Solicitud de servicio'}
            </Text>
            <Text numberOfLines={1} style={styles.requestMeta}>
              {[application.categoryName, application.city].filter(Boolean).join(' · ')}
            </Text>
            <StatusBadge tone={status.tone} value={status.label} />
            <Text numberOfLines={2} style={styles.requestDescriptionCompact}>
              {application.message}
            </Text>
            <Text style={styles.requestMeta}>
              Postulado {formatRelativePublishedAt(application.createdAt)}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

function RefreshIconButton({
  disabled,
  loading,
  onRefresh,
}: {
  disabled: boolean;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel="Actualizar oportunidades"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onRefresh}
      style={[styles.refreshIconButton, disabled ? styles.refreshIconButtonDisabled : null]}
    >
      {loading ? (
        <ActivityIndicator color="#bb5e3c" size="small" />
      ) : (
        <Ionicons color="#bb5e3c" name="refresh" size={22} />
      )}
    </Pressable>
  );
}

function OpportunityListItem({
  application,
  categoryName,
  opportunity,
}: {
  application: ProfessionalApplication | null;
  categoryName: string;
  opportunity: ProfessionalOpportunity;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/(professional)/opportunities/${opportunity.requestId}` as Href)}
      testID="professional-opportunity-card"
    >
      <View style={styles.opportunityCard}>
        <View style={styles.opportunityRow}>
          <View style={styles.opportunityCopy}>
            <Text numberOfLines={1} style={styles.opportunityCategory}>
              {categoryName}
            </Text>
            <View style={styles.opportunityTitleRow}>
              <Text numberOfLines={1} style={styles.requestTitle} testID="opportunity-card-title">
                {opportunity.title}
              </Text>
              {application ? (
                <StatusBadge tone="accent" value={`Postulación ${getApplicationStatusLabel(application.status)}`} />
              ) : null}
            </View>
            <LocationSummary city={opportunity.city} province={opportunity.province} />
            <Text numberOfLines={1} style={styles.requestMeta}>
              {getServiceRequestUrgencyLabel(opportunity.urgency)} · {getServiceRequestTypeLabel(opportunity.requestType)}
            </Text>
            {opportunity.attachmentCount ? (
              <View style={styles.opportunityAttachmentCount}>
                <Ionicons color="#8c765d" name="images-outline" size={15} />
                <Text style={styles.requestMeta}>{opportunity.attachmentCount}</Text>
              </View>
            ) : null}
            <Text numberOfLines={2} style={styles.requestDescriptionCompact}>
              {opportunity.description}
            </Text>
            <Text numberOfLines={1} style={styles.requestMeta}>
              Publicada {formatRelativePublishedAt(opportunity.publishedAt)}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
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
        <Text style={styles.requestMeta}>Ciudad: {getCityDisplayName(opportunity.city) || 'No informada'}</Text>
        <Text style={styles.requestMeta}>Provincia: {opportunity.province || 'No informada'}</Text>
        <Text style={styles.requestMeta}>{formatLocation(opportunity.city, opportunity.province)}</Text>
        <Text style={styles.requestMeta}>La dirección exacta se habilita cuando el cliente selecciona al profesional.</Text>
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

function getApplicationFilter(application: ProfessionalApplication): Exclude<ApplicationFilter, 'all'> {
  if (application.status === 'withdrawn') {
    return 'withdrawn';
  }

  if (application.status === 'selected') {
    return 'selected';
  }

  if (application.status === 'rejected' || application.requestStatus === 'cancelled') {
    return 'rejected';
  }

  return 'pending';
}

function getProfessionalApplicationPresentation(application: ProfessionalApplication): {
  filter: Exclude<ApplicationFilter, 'all'>;
  label: string;
  tone: 'accent' | 'neutral' | 'success' | 'warning';
} {
  const filter = getApplicationFilter(application);

  switch (filter) {
    case 'pending':
      return { filter, label: 'Pendiente de aceptación', tone: 'warning' };
    case 'selected':
      return { filter, label: 'Seleccionada', tone: 'success' };
    case 'rejected':
      return { filter, label: 'No seleccionada', tone: 'neutral' };
    case 'withdrawn':
      return { filter, label: 'Retirada', tone: 'neutral' };
  }
}

function getApplicationEmptyMessage(filter: ApplicationFilter): string {
  switch (filter) {
    case 'pending':
      return 'No tenés postulaciones pendientes.';
    case 'selected':
      return 'Todavía no fuiste seleccionado en ninguna solicitud.';
    case 'rejected':
      return 'No hay postulaciones cerradas sin selección.';
    case 'withdrawn':
      return 'No retiraste ninguna postulación.';
    case 'all':
      return 'Todavía no tenés postulaciones.';
  }
}

function dedupeApplications(applications: ProfessionalApplication[]): ProfessionalApplication[] {
  const byApplicationId = new Map<string, ProfessionalApplication>();

  applications.forEach((application) => {
    const current = byApplicationId.get(application.id);

    if (!current || compareNullableDates(application.updatedAt, current.updatedAt) > 0) {
      byApplicationId.set(application.id, application);
    }
  });

  return Array.from(byApplicationId.values()).sort((left, right) =>
    compareNullableDates(right.createdAt, left.createdAt),
  );
}


function dedupeOpportunities(opportunities: ProfessionalOpportunity[]): ProfessionalOpportunity[] {
  const byRequestId = new Map<string, ProfessionalOpportunity>();

  opportunities.forEach((opportunity) => {
    const current = byRequestId.get(opportunity.requestId);

    if (!current || compareNullableDates(opportunity.publishedAt, current.publishedAt) > 0) {
      byRequestId.set(opportunity.requestId, opportunity);
    }
  });

  return Array.from(byRequestId.values()).sort((left, right) =>
    compareNullableDates(right.publishedAt, left.publishedAt),
  );
}

function compareNullableDates(left: string | null, right: string | null): number {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;

  return leftTime - rightTime;
}

function isOpportunityCompatibleWithProfessional(
  opportunity: ProfessionalOpportunity,
  professionalCategoryIds: Set<string>,
): boolean {
  if (professionalCategoryIds.size === 0 || !opportunity.categoryId) {
    return true;
  }

  return professionalCategoryIds.has(opportunity.categoryId);
}

function createOpportunityCategoryFilters(categories: Category[]): FilterOption[] {
  return [
    { label: 'Todas las categorías', value: 'all' },
    { label: 'Sin categoría', value: 'uncategorized' },
    ...categories.map((category) => ({
      keywords: [category.slug, category.description ?? ''],
      label: category.name,
      value: `category:${category.id}`,
    })),
  ];
}

function createCityFilterOptions(opportunities: ProfessionalOpportunity[]): FilterOption[] {
  const cityOptionsByValue = new Map<string, FilterOption>(
    BUENOS_AIRES_CITY_OPTIONS.map((option) => [
      getCityFilterValue(option.label),
      {
        keywords: option.aliases,
        label: option.label,
        value: getCityFilterValue(option.label),
      },
    ]),
  );

  opportunities.forEach((opportunity) => {
    const value = getCityFilterValue(opportunity.city);

    if (!cityOptionsByValue.has(value)) {
      cityOptionsByValue.set(value, {
        keywords: [opportunity.city],
        label: opportunity.city,
        value,
      });
    }
  });

  return [
    { label: 'Todas las ciudades', value: 'all' },
    ...Array.from(cityOptionsByValue.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    ),
  ];
}

function createUrgencyFilterOptions(): FilterOption[] {
  return [
    { label: 'Todas', value: 'all' },
    ...SERVICE_REQUEST_URGENCIES.map((urgency) => ({
      label: getServiceRequestUrgencyLabel(urgency),
      value: urgency,
    })),
  ];
}

function getOptionLabel(options: FilterOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? options[0]?.label ?? '';
}

function matchesOpportunityCategoryFilter(opportunity: ProfessionalOpportunity, filter: string): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'uncategorized') {
    return !opportunity.categoryId;
  }

  return opportunity.categoryId === filter.replace('category:', '');
}

function getOpportunityCategoryName(
  opportunity: ProfessionalOpportunity,
  categoriesById: Map<string, Category>,
): string {
  if (opportunity.categoryName) {
    return opportunity.categoryName;
  }

  if (opportunity.categoryId) {
    return categoriesById.get(opportunity.categoryId)?.name ?? 'Sin categoría definida';
  }

  return 'Sin categoría definida';
}

function formatRelativePublishedAt(value: string | null): string {
  if (!value) {
    return 'sin fecha';
  }

  const publishedAt = new Date(value);

  if (Number.isNaN(publishedAt.getTime())) {
    return 'sin fecha';
  }

  const diffMs = Date.now() - publishedAt.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / 86_400_000));

  if (diffDays === 0) {
    return 'hoy';
  }

  if (diffDays === 1) {
    return 'ayer';
  }

  if (diffDays < 30) {
    return `hace ${diffDays} días`;
  }

  return formatDateTime(value);
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
    case 'payment_pending':
      return 'Esperar pago';
    case 'quote_rejected':
      return 'Crear nueva versión';
    case 'quote_accepted':
      return 'Presupuesto aceptado';
    case 'ready_to_start':
      return 'Listo para iniciar';
    case 'in_progress':
      return 'Trabajo en curso';
    case 'review_pending':
      return 'Esperar confirmación';
    case 'completion_pending':
      return 'Esperar confirmación';
    case 'completed':
      return 'Trabajo completado';
    case 'disputed':
      return 'Problema reportado';
    case 'cancelled':
      return 'Trabajo cancelado';
    case null:
      return 'Gestionar trabajo';
  }
}

const styles = StyleSheet.create({
  headerAction: { alignItems: 'flex-end' },
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
  opportunitiesListContent: {
    paddingBottom: 24,
  },
  opportunitiesListHeader: {
    gap: 12,
    marginBottom: 10,
  },
  opportunitiesHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  opportunitiesHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  opportunitiesTitle: {
    color: '#1d1811',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  opportunitiesSubtitle: {
    color: '#675a49',
    fontSize: 15,
    lineHeight: 21,
  },
  opportunitiesPrivacy: {
    color: '#8c765d',
    fontSize: 12,
    lineHeight: 17,
  },
  internalTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#dccbb1',
  },
  internalTab: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  internalTabActive: {
    borderBottomColor: '#bb5e3c',
  },
  internalTabLabel: {
    color: '#675a49',
    fontSize: 14,
    fontWeight: '700',
  },
  internalTabLabelActive: {
    color: '#bb5e3c',
  },
  applicationFilters: {
    gap: 8,
    paddingRight: 8,
  },
  applicationFilter: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dccbb1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
  },
  applicationFilterActive: {
    borderColor: '#bb5e3c',
    backgroundColor: '#f2ddd1',
  },
  applicationFilterLabel: {
    color: '#675a49',
    fontSize: 13,
    fontWeight: '700',
  },
  applicationFilterLabelActive: {
    color: '#9b472b',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChips: {
    gap: 8,
    paddingRight: 4,
  },
  filterChipsScroll: {
    flex: 1,
  },
  filterChip: {
    minHeight: 44,
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dccbb1',
    backgroundColor: '#ffffff',
  },
  filterChipActive: {
    borderColor: '#bb5e3c',
    backgroundColor: '#f2ddd1',
  },
  filterChipSelector: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 14,
    paddingRight: 12,
  },
  filterChipLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1d1811',
  },
  filterChipLabelActive: {
    color: '#9b472b',
  },
  filterChipClear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 8,
  },
  clearFiltersButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  clearFiltersLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#bb5e3c',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(29, 24, 17, 0.36)',
    padding: 20,
  },
  filterModalCard: {
    maxHeight: '78%',
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#fffaf2',
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1811',
  },
  filterModalList: {
    maxHeight: 360,
  },
  filterOption: {
    borderBottomWidth: 1,
    borderBottomColor: '#eadcc8',
    paddingVertical: 13,
  },
  filterOptionSelected: {
    backgroundColor: '#f2ddd1',
  },
  filterOptionLabel: {
    fontSize: 15,
    color: '#1d1811',
  },
  filterOptionLabelSelected: {
    color: '#bb5e3c',
    fontWeight: '700',
  },
  opportunityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opportunityCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#675a49',
  },
  refreshIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dccbb1',
    backgroundColor: '#ffffff',
  },
  refreshIconButtonDisabled: {
    opacity: 0.5,
  },
  opportunityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  opportunityCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4d5bf',
    backgroundColor: '#fffaf1',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  opportunitySeparator: {
    height: 10,
  },
  opportunityCopy: {
    flex: 1,
    gap: 4,
  },
  opportunityCategory: {
    color: '#bb5e3c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  opportunityAttachmentCount: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  opportunityBackButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingRight: 8,
  },
  opportunityBackLabel: {
    color: '#bb5e3c',
    fontSize: 15,
    fontWeight: '700',
  },
  opportunityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestDescriptionCompact: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1d1811',
  },
  chevron: {
    fontSize: 28,
    lineHeight: 30,
    color: '#9c8a73',
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
