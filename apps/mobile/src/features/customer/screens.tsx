import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getApplicationProposalTypeLabel,
  getProfileDisplayName,
  getServiceRequestStatusLabel,
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
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
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
      <ServiceRequestDetailCard request={request} />
      {request.status === 'published' ? (
        <Button disabled={cancelMutation.isPending} onPress={confirmCancel} variant="danger">
          {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar solicitud'}
        </Button>
      ) : null}
      {cancelMutation.error ? (
        <ErrorState message="No pudimos cancelar la solicitud." title="Cancelación fallida" />
      ) : null}
      {selectMutation.error ? (
        <ErrorState message="No pudimos seleccionar este profesional." title="Selección fallida" />
      ) : null}
      {openConversationMutation.error ? (
        <ErrorState message="No pudimos abrir la conversacion." title="Chat no disponible" />
      ) : null}
      <CustomerApplicationsSection
        applications={applications}
        expandedApplicationId={expandedApplicationId}
        loadingApplicationId={selectMutation.variables?.id ?? null}
        markingViewed={markViewedMutation.isPending}
        onOpenApplication={(application) => {
          setExpandedApplicationId((currentId) =>
            currentId === application.id ? null : application.id,
          );

          if (application.status === 'submitted') {
            void markViewedMutation.mutateAsync(application.id).catch((error) => {
              logDevelopmentSupabaseError('customer-applications:mark-viewed-screen', error);
            });
          }
        }}
        onOpenChat={(application) => {
          setExpandedApplicationId(application.id);

          if (application.conversationId) {
            navigateToConversation(application.conversationId);
            return;
          }

          void openConversationMutation.mutateAsync(application.id).catch((error) => {
            logDevelopmentSupabaseError('customer-applications:open-chat', error);
          });
        }}
        onSelectApplication={(application) => {
          Alert.alert(
            '¿Querés elegir a este profesional?',
            'La selección no se podrá cambiar libremente. Las demás propuestas serán rechazadas. Todavía no se habilitan pagos ni chat en esta fase.',
            [
              { style: 'cancel', text: 'Volver' },
              {
                onPress: () => void selectMutation.mutateAsync(application),
                text: 'Seleccionar profesional',
              },
            ],
          );
        }}
        request={request}
        selecting={selectMutation.isPending}
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
      <Card>
        <View style={styles.requestCard}>
          <Text style={styles.requestTitle}>{request.title}</Text>
          <Text style={styles.requestMeta}>
            {request.category?.name ?? 'Sin categoría'} · {getServiceRequestStatusLabel(request.status)}
          </Text>
          <Text style={styles.requestMeta}>
            {request.city} · {getServiceRequestUrgencyLabel(request.urgency)}
          </Text>
          <Text style={styles.requestMeta}>Publicada: {formatDateTime(request.publishedAt)}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function ServiceRequestDetailCard({ request }: { request: ServiceRequestWithCategory }) {
  return (
    <Card>
      <View style={styles.requestCard}>
        <Text style={styles.requestTitle}>{request.title}</Text>
        <Text style={styles.requestDescription}>{request.description}</Text>
        <Text style={styles.requestMeta}>Categoría: {request.category?.name ?? 'Sin categoría'}</Text>
        <Text style={styles.requestMeta}>Tipo: {getServiceRequestTypeLabel(request.requestType)}</Text>
        <Text style={styles.requestMeta}>Urgencia: {getServiceRequestUrgencyLabel(request.urgency)}</Text>
        <Text style={styles.requestMeta}>
          Dirección: {request.addressText}, {request.city}, {request.province}
        </Text>
        <Text style={styles.requestMeta}>
          Fecha preferida: {request.preferredDate ?? 'Sin fecha preferida'}
        </Text>
        <Text style={styles.requestMeta}>
          Horario: {request.preferredTimeText ?? 'Sin horario específico'}
        </Text>
        <Text style={styles.requestMeta}>
          Disponibilidad: {request.availabilityNotes ?? 'Sin notas adicionales'}
        </Text>
        <Text style={styles.requestMeta}>Estado: {getServiceRequestStatusLabel(request.status)}</Text>
        <Text style={styles.requestMeta}>Publicada: {formatDateTime(request.publishedAt)}</Text>
      </View>
    </Card>
  );
}

function CustomerApplicationsSection({
  applications,
  expandedApplicationId,
  loadingApplicationId,
  markingViewed,
  onOpenApplication,
  onOpenChat,
  onSelectApplication,
  request,
  selecting,
}: {
  applications: CustomerRequestApplication[];
  expandedApplicationId: string | null;
  loadingApplicationId: string | null;
  markingViewed: boolean;
  onOpenApplication: (application: CustomerRequestApplication) => void;
  onOpenChat: (application: CustomerRequestApplication) => void;
  onSelectApplication: (application: CustomerRequestApplication) => void;
  request: ServiceRequestWithCategory;
  selecting: boolean;
}) {
  const selectedApplication = applications.find((application) => application.status === 'selected') ?? null;

  return (
    <Card>
      <View style={styles.requestCard}>
        <Text style={styles.requestTitle}>Profesionales interesados</Text>
        <Text style={styles.requestMeta}>
          {applications.length === 1
            ? '1 postulacion recibida'
            : `${applications.length} postulaciones recibidas`}
        </Text>
        {selectedApplication ? (
          <StatusBadge
            tone="success"
            value={`Profesional seleccionado: ${getProfessionalDisplayName(selectedApplication)}`}
          />
        ) : null}
        {applications.length === 0 ? (
          <EmptyState
            description="Cuando un profesional compatible se postule, vas a ver su propuesta aca."
            title="Sin postulaciones todavia"
          />
        ) : (
          applications.map((application) => (
            <CustomerApplicationCard
              application={application}
              expanded={expandedApplicationId === application.id}
              key={application.id}
              loading={selecting && loadingApplicationId === application.id}
              markingViewed={markingViewed && expandedApplicationId === application.id}
              onOpen={() => onOpenApplication(application)}
              onOpenChat={() => onOpenChat(application)}
              onSelect={() => onSelectApplication(application)}
              request={request}
              selecting={selecting}
            />
          ))
        )}
      </View>
    </Card>
  );
}

function CustomerApplicationCard({
  application,
  expanded,
  loading,
  markingViewed,
  onOpen,
  onOpenChat,
  onSelect,
  request,
  selecting,
}: {
  application: CustomerRequestApplication;
  expanded: boolean;
  loading: boolean;
  markingViewed: boolean;
  onOpen: () => void;
  onOpenChat: () => void;
  onSelect: () => void;
  request: ServiceRequestWithCategory;
  selecting: boolean;
}) {
  const canSelect =
    ['published', 'receiving_applications'].includes(request.status) &&
    ['submitted', 'viewed'].includes(application.status);

  return (
    <View style={styles.applicationCard}>
      <Pressable onPress={onOpen} style={styles.applicationHeader}>
        <View style={styles.copy}>
          <Text style={styles.requestTitle}>{getProfessionalDisplayName(application)}</Text>
          {application.unreadCount > 0 ? (
            <Text style={styles.unreadText}>{application.unreadCount} mensajes sin leer</Text>
          ) : null}
          <Text style={styles.requestMeta}>
            {application.professionalCategoryNames.join(', ') || 'Sin rubros cargados'} ·{' '}
            {application.professionalYearsExperience ?? 0} anos de experiencia
          </Text>
          <Text style={styles.requestMeta}>
            {application.professionalBaseCity} · Radio {application.professionalServiceRadiusKm} km
          </Text>
        </View>
        <StatusBadge tone={getApplicationStatusTone(application.status)} value={getCustomerApplicationStatusLabel(application.status)} />
      </Pressable>

      <Text style={styles.requestDescription}>{application.message}</Text>
      <Text style={styles.requestMeta}>Disponibilidad: {application.availabilityText}</Text>
      <Text style={styles.requestMeta}>
        Propuesta: {getApplicationProposalTypeLabel(application.proposalType)}
      </Text>
      <Text style={styles.requestMeta}>
        Visita: {formatPrice(application.visitPrice) ?? 'Sin precio de visita'} · Estimado:{' '}
        {formatPrice(application.estimatedPrice) ?? 'Sin precio estimado'}
      </Text>
      <Text style={styles.requestMeta}>
        Duracion: {application.estimatedDurationText ?? 'Sin duracion estimada'}
      </Text>
      <Text style={styles.requestMeta}>Postulacion: {formatDateTime(application.createdAt)}</Text>

      {expanded ? (
        <View style={styles.applicationDetails}>
          <Text style={styles.requestTitle}>Perfil publico</Text>
          <Text style={styles.requestMeta}>
            Verificacion: {getVerificationLabel(application.professionalVerificationStatus)}
          </Text>
          <Text style={styles.requestDescription}>
            {application.professionalBio ?? 'Este profesional todavia no cargo una bio.'}
          </Text>
          <ConversationSummary
            lastMessageAt={application.lastMessageAt}
            lastMessageBody={application.lastMessageBody}
            unreadCount={application.unreadCount}
          />
          {markingViewed ? <Text style={styles.requestMeta}>Marcando como vista...</Text> : null}
          <Button onPress={onOpenChat} variant="secondary">
            Abrir conversacion
          </Button>
          {canSelect ? (
            <Button disabled={selecting} onPress={onSelect}>
              {loading ? 'Seleccionando...' : 'Seleccionar profesional'}
            </Button>
          ) : null}
        </View>
      ) : (
        <Button onPress={onOpen} variant="secondary">
          Ver perfil y propuesta
        </Button>
      )}
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
        <Text style={styles.requestTitle}>Conversacion</Text>
        <Text numberOfLines={2} style={styles.requestMeta}>
          {lastMessageBody ? `Ultimo mensaje: ${lastMessageBody}` : 'Todavia no hay mensajes.'}
        </Text>
        {lastMessageAt ? <Text style={styles.requestMeta}>{formatDateTime(lastMessageAt)}</Text> : null}
      </View>
      {unreadCount > 0 ? <Text style={styles.unreadBadge}>{unreadCount}</Text> : null}
    </View>
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
