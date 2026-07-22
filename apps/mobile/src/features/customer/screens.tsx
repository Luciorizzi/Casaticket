import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { router, type Href, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getApplicationProposalTypeLabel,
  getProfileDisplayName,
  getServiceRequestTypeLabel,
  getServiceRequestUrgencyLabel,
} from '@casaticket/domain';
import type {
  CustomerRequestApplication,
  CustomerSelectionResult,
  ServiceRequestWithCategory,
} from '@casaticket/types';
import type { CreateServiceRequestInput, CustomerOnboardingInput } from '@casaticket/validation';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Screen } from '@/components/ui/screen';
import { getVerificationLabel, StatusBadge } from '@/components/ui/status-badge';
import {
  InfoRow,
  PrimaryActionBar,
  ProcessTimeline,
  ScreenHeader,
  SectionCard,
  StatusHeader,
  SummaryCard,
} from '@/components/ui/workflow';
import { ensureApplicationConversation } from '@/features/applications/chat-api';
import { useAuthSession } from '@/features/auth/auth-provider';
import { listActiveCategories } from '@/features/categories/api';
import { CustomerProfileForm } from '@/features/customer/customer-profile-form';
import { ServiceRequestForm } from '@/features/customer/service-request-form';
import {
  cancelOwnServiceRequest,
  createServiceRequest,
  getOwnServiceRequest,
  listCustomerRequestApplications,
  listOwnServiceRequests,
  markCustomerApplicationViewed,
  selectProfessionalForRequest,
} from '@/features/customer/service-requests-api';
import { CustomerJobSummaryPanel } from '@/features/jobs/customer-job-panel';
import { getMobileServiceRequestStatusLabel } from '@/features/jobs/status-labels';
import { resolveAppRoute } from '@/features/navigation/access';
import { fetchOwnDefaultAddress, saveCustomerOnboarding } from '@/features/profile/api';
import { getUserFacingErrorMessage, logDevelopmentSupabaseError } from '@/lib/errors';
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
        <Button onPress={() => router.push('/(customer)/create-request')}>
          Publicar una solicitud
        </Button>
      </Card>

      <EmptyState
        actionLabel="Ver mis solicitudes"
        description="Las solicitudes ya quedan guardadas para que puedas abrirlas y cancelarlas si siguen publicadas."
        onAction={() => router.push('/(customer)/requests')}
        title="Seguimiento de solicitudes"
      />
    </Screen>
  );
}

export function CustomerCreateRequestScreen() {
  const queryClient = useQueryClient();
  const { sessionState } = useAuthSession();
  const profile = sessionState.status === 'authenticated' ? sessionState.profile : null;
  const [error, setError] = useState<string | null>(null);
  const categoryQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: listActiveCategories,
  });
  const createMutation = useMutation({
    mutationFn: createServiceRequest,
    onSuccess: (createdRequest) => {
      if (sessionState.status !== 'authenticated') {
        return;
      }

      const listKey = queryKeys.serviceRequests(sessionState.user.id);
      const detailKey = queryKeys.serviceRequest(sessionState.user.id, createdRequest.id);
      queryClient.setQueryData(detailKey, createdRequest);
      queryClient.setQueryData<ServiceRequestWithCategory[]>(listKey, (currentRequests = []) => [
        createdRequest,
        ...currentRequests.filter((request) => request.id !== createdRequest.id),
      ]);

      router.replace(`/(customer)/requests/${createdRequest.id}` as Href);
    },
  });
  const initialValues = useMemo<CreateServiceRequestInput>(
    () => ({
      title: '',
      description: '',
      categoryId: null,
      unsureCategory: false,
      requestType: 'quote',
      urgency: 'flexible',
      addressText: '',
      city: profile?.city ?? '',
      province: profile?.province ?? '',
      preferredDate: null,
      preferredTimeText: null,
      availabilityNotes: null,
    }),
    [profile?.city, profile?.province],
  );

  return (
    <Screen
      subtitle="Describí qué necesitás, dónde es y cuándo podrías recibir ayuda."
      title="Crear solicitud"
    >
      {error ? <ErrorState message={error} title="No pudimos publicar la solicitud" /> : null}
      <ServiceRequestForm
        categories={categoryQuery.data ?? []}
        categoriesError={categoryQuery.error instanceof Error ? categoryQuery.error.message : undefined}
        categoriesLoading={categoryQuery.isPending}
        initialValues={initialValues}
        loading={createMutation.isPending}
        onRetryCategories={() => void categoryQuery.refetch()}
        onSubmit={async (values) => {
          setError(null);

          try {
            await createMutation.mutateAsync(values);
          } catch (submissionError) {
            logDevelopmentSupabaseError('service-requests:create-screen', submissionError);
            setError(
              getUserFacingErrorMessage(
                submissionError,
                'No pudimos publicar la solicitud.',
              ),
            );
          }
        }}
      />
    </Screen>
  );
}

export function CustomerRequestsScreen() {
  const { sessionState } = useAuthSession();
  const requestsQuery = useQuery({
    queryKey:
      sessionState.status === 'authenticated'
        ? queryKeys.serviceRequests(sessionState.user.id)
        : ['service-requests'],
    queryFn: listOwnServiceRequests,
    enabled: sessionState.status === 'authenticated',
  });

  if (requestsQuery.isPending) {
    return (
      <Screen subtitle="Buscando tus publicaciones más recientes." title="Mis solicitudes">
        <LoadingState message="Cargando solicitudes..." />
      </Screen>
    );
  }

  if (requestsQuery.error) {
    return (
      <Screen subtitle="Buscando tus publicaciones más recientes." title="Mis solicitudes">
        <ErrorState
          message="No pudimos cargar tus solicitudes."
          onRetry={() => void requestsQuery.refetch()}
        />
      </Screen>
    );
  }

  const requests = requestsQuery.data ?? [];

  return (
    <Screen
      subtitle="Tus publicaciones aparecen ordenadas de más reciente a más antigua."
      title="Mis solicitudes"
    >
      {requests.length === 0 ? (
        <EmptyState
          actionLabel="Crear solicitud"
          description="Todavía no publicaste solicitudes. Podés crear la primera ahora."
          onAction={() => router.push('/(customer)/create-request')}
          title="Sin solicitudes todavía"
        />
      ) : (
        <>
          <Button onPress={() => void requestsQuery.refetch()} variant="secondary">
            Actualizar listado
          </Button>
          {requests.map((request) => (
            <ServiceRequestListItem key={request.id} request={request} />
          ))}
        </>
      )}
    </Screen>
  );
}

export function CustomerRequestDetailScreen({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();
  const { sessionState } = useAuthSession();
  const requestQuery = useQuery({
    queryKey:
      sessionState.status === 'authenticated'
        ? queryKeys.serviceRequest(sessionState.user.id, requestId)
        : ['service-request', requestId],
    queryFn: () => getOwnServiceRequest(requestId),
    enabled: sessionState.status === 'authenticated' && requestId.length > 0,
  });
  const applicationsQuery = useQuery({
    queryKey:
      sessionState.status === 'authenticated'
        ? queryKeys.customerRequestApplications(sessionState.user.id, requestId)
        : ['customer-request-applications', requestId],
    queryFn: () => listCustomerRequestApplications(requestId),
    enabled: sessionState.status === 'authenticated' && requestId.length > 0,
  });
  const cancelMutation = useMutation({
    mutationFn: cancelOwnServiceRequest,
    onSuccess: (updatedRequest) => {
      if (sessionState.status !== 'authenticated') {
        return;
      }

      queryClient.setQueryData(
        queryKeys.serviceRequest(sessionState.user.id, updatedRequest.id),
        updatedRequest,
      );
      queryClient.setQueryData<ServiceRequestWithCategory[]>(
        queryKeys.serviceRequests(sessionState.user.id),
        (currentRequests = []) =>
          currentRequests.map((request) =>
            request.id === updatedRequest.id ? updatedRequest : request,
          ),
      );
    },
  });
  const markViewedMutation = useMutation({
    mutationFn: markCustomerApplicationViewed,
    onSuccess: (viewedApplication) => {
      if (sessionState.status !== 'authenticated') {
        return;
      }

      queryClient.setQueryData<CustomerRequestApplication[]>(
        queryKeys.customerRequestApplications(sessionState.user.id, requestId),
        (currentApplications = []) =>
          currentApplications.map((application) =>
            application.id === viewedApplication.application_id
              ? { ...application, status: viewedApplication.status }
              : application,
          ),
      );
    },
  });
  const openConversationMutation = useMutation({
    mutationFn: ensureApplicationConversation,
    onSuccess: (conversation, applicationId) => {
      if (sessionState.status !== 'authenticated') {
        return;
      }

      queryClient.setQueryData(queryKeys.applicationConversation(applicationId), conversation);
      updateCustomerApplicationChatCache({
        applicationId,
        patch: { conversationId: conversation.id, unreadCount: conversation.unreadCount },
        queryClient,
        requestId,
        userId: sessionState.user.id,
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

  if (requestQuery.isPending || applicationsQuery.isPending) {
    return (
      <Screen subtitle="Buscando la información de tu solicitud." title="Detalle">
        <LoadingState message="Cargando solicitud..." />
      </Screen>
    );
  }

  if (sessionState.status !== 'authenticated') {
    return (
      <Screen subtitle="Necesitás iniciar sesión para ver esta solicitud." title="Detalle">
        <ErrorState message="No encontramos una sesión activa." />
      </Screen>
    );
  }

  if (requestQuery.error || !requestQuery.data) {
    return (
      <Screen subtitle="Buscando la información de tu solicitud." title="Detalle">
        <ErrorState
          message="No pudimos abrir esta solicitud."
          onRetry={() => void requestQuery.refetch()}
        />
      </Screen>
    );
  }

  if (applicationsQuery.error) {
    return (
      <Screen subtitle="Buscando postulaciones recibidas." title={requestQuery.data.title}>
        <ErrorState
          message="No pudimos cargar las postulaciones."
          onRetry={() => void applicationsQuery.refetch()}
        />
      </Screen>
    );
  }

  const request = requestQuery.data;
  const applications = applicationsQuery.data ?? [];
  const selectedApplication = applications.find((application) => application.status === 'selected') ?? null;
  const confirmCancel = () => {
    Alert.alert(
      'Cancelar solicitud',
      'La solicitud seguirá visible en tu historial como cancelada.',
      [
        { style: 'cancel', text: 'Volver' },
        {
          onPress: () => void cancelMutation.mutateAsync(request.id),
          style: 'destructive',
          text: 'Cancelar solicitud',
        },
      ],
    );
  };

  return (
    <Screen subtitle="Detalle de la solicitud publicada." title={request.title}>
      <ServiceRequestDetailCard applications={applications} request={request} />
      {request.status === 'published' ? (
        <Button disabled={cancelMutation.isPending} onPress={confirmCancel} variant="danger">
          {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar solicitud'}
        </Button>
      ) : null}
      {cancelMutation.error ? (
        <ErrorState message="No pudimos cancelar la solicitud." title="Cancelación fallida" />
      ) : null}
      {openConversationMutation.error ? (
        <ErrorState message="No pudimos abrir la conversacion." title="Chat no disponible" />
      ) : null}
      <CustomerApplicationsSection
        applications={applications}
        onOpenApplication={(application) => {
          if (application.status === 'submitted') {
            void markViewedMutation.mutateAsync(application.id).catch((error) => {
              logDevelopmentSupabaseError('customer-applications:mark-viewed-screen', error);
            });
          }

          router.push({
            pathname: '/(customer)/requests/[id]/applications/[applicationId]',
            params: { applicationId: application.id, id: request.id },
          } as Href);
        }}
        onOpenChat={(application) => {
          if (application.conversationId) {
            navigateToConversation(application.conversationId);
            return;
          }

          void openConversationMutation.mutateAsync(application.id).catch((error) => {
            logDevelopmentSupabaseError('customer-applications:open-chat', error);
          });
        }}
      />
      {request.status === 'professional_selected' && selectedApplication ? (
        <CustomerJobSummaryPanel requestId={request.id} />
      ) : null}
    </Screen>
  );
}

export function CustomerRequestDetailsScreen({ requestId }: { requestId: string }) {
  const detailRouter = useRouter();
  const { sessionState } = useAuthSession();
  const backAction = <CustomerRequestBackButton requestId={requestId} router={detailRouter} />;
  const requestQuery = useQuery({
    queryKey:
      sessionState.status === 'authenticated'
        ? queryKeys.serviceRequest(sessionState.user.id, requestId)
        : ['service-request', requestId],
    queryFn: () => getOwnServiceRequest(requestId),
    enabled: sessionState.status === 'authenticated' && requestId.length > 0,
  });

  if (requestQuery.isPending) {
    return (
      <Screen scroll={false}>
        <ScreenHeader backAction={backAction} subtitle="Información completa de la solicitud." title="Detalles" />
        <LoadingState message="Cargando solicitud..." />
      </Screen>
    );
  }

  if (sessionState.status !== 'authenticated') {
    return (
      <Screen>
        <ScreenHeader backAction={backAction} subtitle="Información completa de la solicitud." title="Detalles" />
        <ErrorState message="No encontramos una sesión activa." />
      </Screen>
    );
  }

  if (requestQuery.error || !requestQuery.data) {
    return (
      <Screen>
        <ScreenHeader backAction={backAction} subtitle="Información completa de la solicitud." title="Detalles" />
        <ErrorState message="No pudimos abrir esta solicitud." onRetry={() => void requestQuery.refetch()} />
      </Screen>
    );
  }

  const request = requestQuery.data;

  return (
    <Screen>
      <ScreenHeader backAction={backAction} subtitle="Información completa de la solicitud." title={request.title} />
      <SectionCard title="Solicitud">
        <InfoRow label="Descripción" value={request.description} />
        <InfoRow label="Categoría" value={request.category?.name ?? 'Sin categoría'} />
        <InfoRow label="Tipo" value={getServiceRequestTypeLabel(request.requestType)} />
        <InfoRow label="Urgencia" value={getServiceRequestUrgencyLabel(request.urgency)} />
      </SectionCard>
      <SectionCard title="Ubicación">
        <InfoRow label="Dirección" value={request.addressText} />
        <InfoRow label="Ciudad" value={request.city} />
        <InfoRow label="Provincia" value={request.province} />
      </SectionCard>
      <SectionCard title="Preferencias">
        <InfoRow label="Fecha preferida" value={request.preferredDate ?? 'Sin fecha preferida'} />
        <InfoRow label="Horario" value={request.preferredTimeText ?? 'Sin horario específico'} />
        <InfoRow label="Disponibilidad" value={request.availabilityNotes ?? 'Sin notas adicionales'} />
      </SectionCard>
      <SectionCard title="Estado">
        <InfoRow label="Publicación" value={formatDateTime(request.publishedAt)} />
        <InfoRow label="Estado" value={getMobileServiceRequestStatusLabel(request.status)} />
      </SectionCard>
    </Screen>
  );
}

export function CustomerApplicationDetailScreen({
  applicationId,
  requestId,
}: {
  applicationId: string;
  requestId: string;
}) {
  const detailRouter = useRouter();
  const queryClient = useQueryClient();
  const { sessionState } = useAuthSession();
  const backAction = <CustomerRequestBackButton requestId={requestId} router={detailRouter} />;
  const requestQuery = useQuery({
    queryKey:
      sessionState.status === 'authenticated'
        ? queryKeys.serviceRequest(sessionState.user.id, requestId)
        : ['service-request', requestId],
    queryFn: () => getOwnServiceRequest(requestId),
    enabled: sessionState.status === 'authenticated' && requestId.length > 0,
  });
  const applicationsQuery = useQuery({
    queryKey:
      sessionState.status === 'authenticated'
        ? queryKeys.customerRequestApplications(sessionState.user.id, requestId)
        : ['customer-request-applications', requestId],
    queryFn: () => listCustomerRequestApplications(requestId),
    enabled: sessionState.status === 'authenticated' && requestId.length > 0,
  });
  const markViewedMutation = useMutation({
    mutationFn: markCustomerApplicationViewed,
    onSuccess: (viewedApplication) => {
      if (sessionState.status !== 'authenticated') {
        return;
      }

      queryClient.setQueryData<CustomerRequestApplication[]>(
        queryKeys.customerRequestApplications(sessionState.user.id, requestId),
        (currentApplications = []) =>
          currentApplications.map((application) =>
            application.id === viewedApplication.application_id
              ? { ...application, status: viewedApplication.status }
              : application,
          ),
      );
    },
  });
  const selectMutation = useMutation({
    mutationFn: (application: CustomerRequestApplication) =>
      selectProfessionalForRequest(requestId, application.id),
    onSuccess: (selection) => {
      if (sessionState.status !== 'authenticated') {
        return;
      }

      syncSelectionCache({
        queryClient,
        request: requestQuery.data ?? null,
        selection,
        userId: sessionState.user.id,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.job(selection.requestId) });
      void queryClient.invalidateQueries({ queryKey: ['customer-job', selection.requestId] });

      if (process.env.NODE_ENV !== 'production') {
        console.info('[customer-applications] professional selected', {
          requestId: selection.requestId,
          selectedApplicationId: selection.selectedApplicationId,
          selectedProfessionalId: selection.selectedProfessionalId,
          requestStatus: selection.requestStatus,
          requestCacheUpdated: Boolean(
            queryClient.getQueryData(queryKeys.serviceRequest(sessionState.user.id, selection.requestId)),
          ),
          applicationsCacheUpdated: Boolean(
            queryClient.getQueryData(
              queryKeys.customerRequestApplications(sessionState.user.id, selection.requestId),
            ),
          ),
        });
      }

      router.replace({
        pathname: '/(customer)/requests/[id]',
        params: { id: selection.requestId },
      } as Href);
    },
  });
  const openConversationMutation = useMutation({
    mutationFn: ensureApplicationConversation,
    onSuccess: (conversation, selectedApplicationId) => {
      if (sessionState.status !== 'authenticated') {
        return;
      }

      queryClient.setQueryData(queryKeys.applicationConversation(selectedApplicationId), conversation);
      updateCustomerApplicationChatCache({
        applicationId: selectedApplicationId,
        patch: { conversationId: conversation.id, unreadCount: conversation.unreadCount },
        queryClient,
        requestId,
        userId: sessionState.user.id,
      });
      router.push({
        pathname: '/chat/[conversationId]',
        params: { conversationId: conversation.id },
      } as Href);
    },
  });
  const request = requestQuery.data ?? null;
  const applications = applicationsQuery.data ?? [];
  const application = applications.find((currentApplication) => currentApplication.id === applicationId) ?? null;
  const canSelect =
    request &&
    ['published', 'receiving_applications'].includes(request.status) &&
    application &&
    ['submitted', 'viewed'].includes(application.status);

  useEffect(() => {
    if (application?.status !== 'submitted') {
      return;
    }

    void markViewedMutation.mutateAsync(application.id).catch((error) => {
      logDevelopmentSupabaseError('customer-applications:mark-viewed-detail', error);
    });
  }, [application?.id, application?.status, markViewedMutation]);

  if (requestQuery.isPending || applicationsQuery.isPending) {
    return (
      <Screen scroll={false}>
        <ScreenHeader backAction={backAction} subtitle="Perfil y propuesta recibida." title="Propuesta" />
        <LoadingState message="Cargando propuesta..." />
      </Screen>
    );
  }

  if (sessionState.status !== 'authenticated') {
    return (
      <Screen>
        <ScreenHeader backAction={backAction} subtitle="Perfil y propuesta recibida." title="Propuesta" />
        <ErrorState message="No encontramos una sesión activa." />
      </Screen>
    );
  }

  if (requestQuery.error || applicationsQuery.error || !request || !application) {
    return (
      <Screen>
        <ScreenHeader backAction={backAction} subtitle="Perfil y propuesta recibida." title="Propuesta" />
        <ErrorState
          message="No pudimos abrir esta propuesta."
          onRetry={() => {
            void requestQuery.refetch();
            void applicationsQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        backAction={backAction}
        subtitle={request.title}
        title={getProfessionalDisplayName(application)}
      />
      {selectMutation.error ? (
        <ErrorState message="No pudimos seleccionar este profesional." title="Selección fallida" />
      ) : null}
      {openConversationMutation.error ? (
        <ErrorState message="No pudimos abrir la conversación." title="Chat no disponible" />
      ) : null}
      <SectionCard title="Perfil">
        <InfoRow label="Nombre" value={getProfessionalDisplayName(application)} />
        <InfoRow
          label="Rubro principal"
          value={application.professionalCategoryNames[0] ?? 'Sin rubro principal'}
        />
        <InfoRow
          label="Experiencia"
          value={`${application.professionalYearsExperience ?? 0} años`}
        />
        <InfoRow
          label="Verificación"
          value={getVerificationLabel(application.professionalVerificationStatus)}
        />
        <InfoRow label="Bio" value={application.professionalBio ?? 'Este profesional todavía no cargó una bio.'} />
      </SectionCard>
      <SectionCard title="Propuesta">
        <InfoRow label="Tipo" value={getApplicationProposalTypeLabel(application.proposalType)} />
        <InfoRow label="Mensaje" value={application.message} />
        <InfoRow label="Disponibilidad" value={application.availabilityText} />
        <InfoRow label="Visita" value={formatPrice(application.visitPrice) ?? 'Sin precio de visita'} />
        <InfoRow label="Estimado" value={formatPrice(application.estimatedPrice) ?? 'Sin precio estimado'} />
        <InfoRow label="Duración" value={application.estimatedDurationText ?? 'Sin duración estimada'} />
        <InfoRow label="Postulación" value={formatDateTime(application.createdAt)} />
      </SectionCard>
      <ConversationSummary
        lastMessageAt={application.lastMessageAt}
        lastMessageBody={application.lastMessageBody}
        unreadCount={application.unreadCount}
      />
      <PrimaryActionBar
        primaryAction={
          canSelect ? (
            <Button disabled={selectMutation.isPending} onPress={() => {
              Alert.alert(
                '¿Querés elegir a este profesional?',
                'La selección no se podrá cambiar libremente. Las demás propuestas serán rechazadas.',
                [
                  { style: 'cancel', text: 'Volver' },
                  {
                    onPress: () => void selectMutation.mutateAsync(application),
                    text: 'Seleccionar profesional',
                  },
                ],
              );
            }}>
              {selectMutation.isPending ? 'Seleccionando...' : 'Seleccionar profesional'}
            </Button>
          ) : null
        }
        secondaryAction={
          <Button
            onPress={() => {
              if (application.conversationId) {
                router.push({
                  pathname: '/chat/[conversationId]',
                  params: { conversationId: application.conversationId },
                } as Href);
                return;
              }

              void openConversationMutation.mutateAsync(application.id).catch((error) => {
                logDevelopmentSupabaseError('customer-applications:open-chat-detail', error);
              });
            }}
            variant="secondary"
          >
            Abrir conversación
          </Button>
        }
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
  const { sessionState, setProfileFromMutation, signOut } = useAuthSession();
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
    onSuccess: async (updatedProfile) => {
      if (sessionState.status === 'authenticated') {
        queryClient.setQueryData(queryKeys.profile(sessionState.user.id), updatedProfile);
        setProfileFromMutation(updatedProfile);

        await queryClient.invalidateQueries({
          queryKey: queryKeys.customerAddress(sessionState.user.id),
        });

        const resolvedRoute = resolveAppRoute({
          isAuthenticated: true,
          profile: updatedProfile,
          professionalProfile: null,
          professionalCategoryIds: [],
        });

        if (process.env.NODE_ENV !== 'production') {
          console.info('[customer-onboarding] profile saved', {
            userId: sessionState.user.id,
            profileCacheUpdated:
              queryClient.getQueryData(queryKeys.profile(sessionState.user.id)) === updatedProfile,
            onboardingCompleted: updatedProfile.onboardingCompleted,
            resolvedRoute,
          });
        }

        router.replace(resolvedRoute as Href);
      }
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
            logDevelopmentSupabaseError('customer-onboarding', submissionError);
            setError(
              getUserFacingErrorMessage(
                submissionError,
                'No pudimos guardar el perfil.',
              ),
            );
          }
        }}
        submitLabel={mode === 'onboarding' ? 'Finalizar onboarding' : 'Guardar cambios'}
      />
    </Screen>
  );
}

function ServiceRequestListItem({ request }: { request: ServiceRequestWithCategory }) {
  return (
    <Pressable onPress={() => router.push(`/(customer)/requests/${request.id}` as Href)}>
      <SummaryCard
        icon="🏠"
        secondaryText={`${request.category?.name ?? 'Sin categoría'} · ${request.city} · ${formatDateTime(request.publishedAt)}`}
        title={getMobileServiceRequestStatusLabel(request.status)}
        value={request.title}
      />
    </Pressable>
  );
}

function ServiceRequestDetailCard({
  applications,
  request,
}: {
  applications: CustomerRequestApplication[];
  request: ServiceRequestWithCategory;
}) {
  const selectedApplication = applications.find((application) => application.status === 'selected') ?? null;
  const timelineStep = request.status === 'professional_selected' ? 'selected' : 'published';

  return (
    <SectionCard title={request.title}>
      <StatusHeader
        actionLabel={
          request.status === 'professional_selected'
            ? 'Coordinar el trabajo'
            : applications.length > 0
              ? 'Revisar postulaciones'
              : 'Esperar postulaciones'
        }
        description={
          selectedApplication
            ? `Profesional seleccionado: ${getProfessionalDisplayName(selectedApplication)}`
            : 'Solicitud publicada'
        }
        status={getMobileServiceRequestStatusLabel(request.status)}
        tone={request.status === 'professional_selected' ? 'success' : 'accent'}
      />
      <ProcessTimeline
        currentStep={timelineStep}
        steps={[
          { key: 'published', label: 'Solicitud' },
          { key: 'selected', label: 'Profesional' },
          { key: 'visit', label: 'Visita' },
          { key: 'diagnosis', label: 'Diagnóstico' },
          { key: 'quote', label: 'Presupuesto' },
        ]}
      />
      <Button
        onPress={() =>
          router.push({
            pathname: '/(customer)/requests/[id]/details',
            params: { id: request.id },
          } as Href)
        }
        variant="secondary"
      >
        Ver detalles de la solicitud
      </Button>
    </SectionCard>
  );
}

function CustomerApplicationsSection({
  applications,
  onOpenApplication,
  onOpenChat,
}: {
  applications: CustomerRequestApplication[];
  onOpenApplication: (application: CustomerRequestApplication) => void;
  onOpenChat: (application: CustomerRequestApplication) => void;
}) {
  const selectedApplication = applications.find((application) => application.status === 'selected') ?? null;
  const visibleApplications = selectedApplication ? [selectedApplication] : applications;
  const title = selectedApplication ? 'Profesional seleccionado' : 'Profesionales interesados';

  return (
    <SectionCard title={title}>
      {!selectedApplication ? (
        <Text style={styles.requestMeta}>
          {applications.length === 1
            ? '1 postulación recibida'
            : `${applications.length} postulaciones recibidas`}
        </Text>
      ) : null}
        {applications.length === 0 ? (
          <EmptyState
            description="Cuando un profesional compatible se postule, vas a ver su propuesta acá."
            title="Sin postulaciones todavía"
          />
        ) : (
          visibleApplications.map((application) => (
            <CustomerApplicationCard
              application={application}
              key={application.id}
              onOpen={() => onOpenApplication(application)}
              onOpenChat={() => onOpenChat(application)}
            />
          ))
        )}
    </SectionCard>
  );
}

function CustomerApplicationCard({
  application,
  onOpen,
  onOpenChat,
}: {
  application: CustomerRequestApplication;
  onOpen: () => void;
  onOpenChat: () => void;
}) {
  return (
    <View style={styles.applicationCard}>
      <Pressable onPress={onOpen} style={styles.applicationHeader}>
        <View style={styles.copy}>
          <Text style={styles.requestTitle}>{getProfessionalDisplayName(application)}</Text>
          {application.unreadCount > 0 ? (
            <Text style={styles.unreadText}>{application.unreadCount} mensajes sin leer</Text>
          ) : null}
          <Text style={styles.requestMeta}>
            {application.professionalCategoryNames[0] ?? 'Sin rubro principal'} ·{' '}
            {application.professionalYearsExperience ?? 0} años de experiencia
          </Text>
          <Text style={styles.requestMeta}>
            Verificación: {getVerificationLabel(application.professionalVerificationStatus)}
          </Text>
        </View>
        <StatusBadge tone={getApplicationStatusTone(application.status)} value={getCustomerApplicationStatusLabel(application.status)} />
      </Pressable>

      <ConversationSummary
        lastMessageAt={application.lastMessageAt}
        lastMessageBody={application.lastMessageBody}
        unreadCount={application.unreadCount}
      />

      <PrimaryActionBar
        primaryAction={
          <Button onPress={onOpen} variant="secondary">
            Ver perfil y propuesta
          </Button>
        }
        secondaryAction={
          <Button onPress={onOpenChat} variant="secondary">
            Abrir conversación
          </Button>
        }
      />
    </View>
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

type DetailRouter = ReturnType<typeof useRouter>;

function CustomerRequestBackButton({
  requestId,
  router: detailRouter,
}: {
  requestId: string;
  router: DetailRouter;
}) {
  const handleBack = () => {
    if (detailRouter.canGoBack()) {
      detailRouter.back();
      return;
    }

    if (!requestId) {
      return;
    }

    detailRouter.replace({
      pathname: '/(customer)/requests/[id]',
      params: { id: requestId },
    } as Href);
  };

  return (
    <Button onPress={handleBack} variant="ghost">
      Volver
    </Button>
  );
}

function syncSelectionCache({
  queryClient,
  request,
  selection,
  userId,
}: {
  queryClient: QueryClient;
  request: ServiceRequestWithCategory | null;
  selection: CustomerSelectionResult;
  userId: string;
}) {
  const updatedRequest = request
    ? {
        ...request,
        status: selection.requestStatus,
        selectedProfessionalId: selection.selectedProfessionalId,
        selectedAt: selection.selectedAt,
      }
    : null;

  if (updatedRequest) {
    queryClient.setQueryData(queryKeys.serviceRequest(userId, selection.requestId), updatedRequest);
  }

  queryClient.setQueryData<ServiceRequestWithCategory[]>(
    queryKeys.serviceRequests(userId),
    (currentRequests = []) =>
      currentRequests.map((currentRequest) =>
        currentRequest.id === selection.requestId
          ? {
              ...currentRequest,
              status: selection.requestStatus,
              selectedProfessionalId: selection.selectedProfessionalId,
              selectedAt: selection.selectedAt,
            }
          : currentRequest,
      ),
  );

  queryClient.setQueryData<CustomerRequestApplication[]>(
    queryKeys.customerRequestApplications(userId, selection.requestId),
    (currentApplications = []) =>
      currentApplications.map((currentApplication) => {
        if (currentApplication.id === selection.selectedApplicationId) {
          return { ...currentApplication, status: 'selected' };
        }

        if (['submitted', 'viewed'].includes(currentApplication.status)) {
          return { ...currentApplication, status: 'rejected' };
        }

        return currentApplication;
      }),
  );
}

function updateCustomerApplicationChatCache({
  applicationId,
  patch,
  queryClient,
  requestId,
  userId,
}: {
  applicationId: string;
  patch: Partial<Pick<CustomerRequestApplication, 'conversationId' | 'unreadCount'>>;
  queryClient: QueryClient;
  requestId: string;
  userId: string;
}) {
  queryClient.setQueryData<CustomerRequestApplication[]>(
    queryKeys.customerRequestApplications(userId, requestId),
    (currentApplications = []) =>
      currentApplications.map((application) =>
        application.id === applicationId ? { ...application, ...patch } : application,
      ),
  );
}

function getProfessionalDisplayName(application: CustomerRequestApplication): string {
  return `${application.professionalFirstName} ${application.professionalLastName}`.trim();
}

function getCustomerApplicationStatusLabel(status: CustomerRequestApplication['status']): string {
  switch (status) {
    case 'submitted':
      return 'Nueva';
    case 'viewed':
      return 'Vista';
    case 'selected':
      return 'Seleccionada';
    case 'rejected':
      return 'No seleccionada';
    case 'withdrawn':
      return 'Retirada';
  }
}

function getApplicationStatusTone(status: CustomerRequestApplication['status']) {
  switch (status) {
    case 'selected':
      return 'success';
    case 'rejected':
    case 'withdrawn':
      return 'neutral';
    case 'viewed':
      return 'accent';
    case 'submitted':
      return 'warning';
  }
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
  applicationCard: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#eadcc8',
    paddingTop: 14,
  },
  applicationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  applicationDetails: {
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#fff8ef',
    padding: 12,
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
