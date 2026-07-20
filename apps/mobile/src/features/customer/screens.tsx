import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getProfileDisplayName,
  getServiceRequestStatusLabel,
  getServiceRequestTypeLabel,
  getServiceRequestUrgencyLabel,
} from '@casaticket/domain';
import type { ServiceRequestWithCategory } from '@casaticket/types';
import type { CreateServiceRequestInput, CustomerOnboardingInput } from '@casaticket/validation';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Screen } from '@/components/ui/screen';
import { useAuthSession } from '@/features/auth/auth-provider';
import { listActiveCategories } from '@/features/categories/api';
import { CustomerProfileForm } from '@/features/customer/customer-profile-form';
import { ServiceRequestForm } from '@/features/customer/service-request-form';
import {
  cancelOwnServiceRequest,
  createServiceRequest,
  getOwnServiceRequest,
  listOwnServiceRequests,
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
  const requestQuery = useQuery({
    queryKey:
      sessionState.status === 'authenticated'
        ? queryKeys.serviceRequest(sessionState.user.id, requestId)
        : ['service-request', requestId],
    queryFn: () => getOwnServiceRequest(requestId),
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

  if (requestQuery.isPending) {
    return (
      <Screen subtitle="Buscando la información de tu solicitud." title="Detalle">
        <LoadingState message="Cargando solicitud..." />
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

  const request = requestQuery.data;
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

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
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
});
