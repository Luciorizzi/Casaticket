import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ZodError } from 'zod';

import { getJobQuoteStatusLabel, getPaymentStatusLabel } from '@casaticket/domain';
import type { Job, JobPayment, JobQuote, JobReview } from '@casaticket/types';
import type { CreateReviewInput, DisputeJobCompletionInput } from '@casaticket/validation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Screen } from '@/components/ui/screen';
import { TextInput } from '@/components/ui/text-input';
import { colors } from '@/components/ui/theme';
import {
  InfoRow,
  ScreenHeader,
  SectionCard,
} from '@/components/ui/workflow';
import { JobProgressList, type JobProgressRowItem, type JobProgressRowState } from '@/features/jobs/job-progress-list';
import {
  acceptCustomerJobQuote,
  confirmCustomerJobCompletion,
  confirmCustomerJobVisit,
  createJobReview,
  customerJobByIdQueryKey,
  customerJobQueryKey,
  disputeCustomerJobCompletion,
  getCustomerJobById,
  getCustomerJobByRequest,
  getJobPayment,
  jobPaymentQueryKey,
  jobQuotesQueryKey,
  jobReviewsQueryKey,
  listJobReviews,
  listJobQuotes,
  mockPaymentProvider,
  rejectCustomerJobQuote,
  rejectCustomerJobVisit,
  retryMockPayment,
} from '@/features/jobs/api';
import { getUserFacingErrorMessage, logDevelopmentSupabaseError } from '@/lib/errors';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    currency: 'ARS',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

const progressStepOrder = ['selected', 'visit', 'diagnosis', 'quote', 'payment', 'execution', 'completed'] as const;
type ProgressStep = (typeof progressStepOrder)[number];

function getTimelineStep(status: Job['status']): string {
  switch (status) {
    case 'coordination_pending':
    case 'visit_proposed':
      return 'selected';
    case 'visit_confirmed':
    case 'diagnosis_pending':
      return 'visit';
    case 'quote_pending':
      return 'diagnosis';
    case 'quote_sent':
    case 'quote_rejected':
      return 'quote';
    case 'payment_pending':
      return 'payment';
    case 'quote_accepted':
    case 'ready_to_start':
    case 'in_progress':
    case 'review_pending':
    case 'completion_pending':
      return 'execution';
    case 'completed':
    case 'disputed':
      return 'completed';
    case 'cancelled':
      return 'selected';
  }
}

function getProgressRowState(step: ProgressStep, status: Job['status']): JobProgressRowState {
  if (status === 'disputed' && step === 'completed') {
    return 'warning';
  }

  const currentIndex = progressStepOrder.indexOf(getTimelineStep(status) as ProgressStep);
  const stepIndex = progressStepOrder.indexOf(step);

  if (stepIndex < currentIndex) {
    return 'done';
  }

  if (stepIndex === currentIndex) {
    return 'active';
  }

  return 'pending';
}

function shortText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}…`;
}

function getSubmissionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  return getUserFacingErrorMessage(error, fallback);
}

function formatDateShort(value: string | null): string {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

function getVisitSubtitle(job: Job): string {
  const status = job.status === 'visit_confirmed' || job.status === 'diagnosis_pending' ? 'Confirmada' : 'Pendiente';
  return `${formatDateShort(job.scheduledDate)} · ${job.scheduledTimeText ?? 'Sin horario'} · ${status}`;
}

function getDiagnosisSubtitle(job: Job): string {
  if (job.recommendedWorkText) {
    return shortText(job.recommendedWorkText, 46);
  }

  if (job.diagnosisText) {
    return shortText(job.diagnosisText, 46);
  }

  return getTimelineStep(job.status) === 'diagnosis' ? 'Pendiente de diagnóstico' : 'A confirmar';
}

function getQuoteSubtitle(quote: JobQuote | null): string {
  if (!quote) {
    return 'Sin presupuesto';
  }

  return `v${quote.version} · ${getJobQuoteStatusLabel(quote.status)} · ${formatMoney(quote.totalAmount)}`;
}

function getPaymentSubtitle(payment: JobPayment | null, job: Job): string {
  if (payment) {
    if (payment.status === 'failed') {
      return 'Pago rechazado · Reintentar';
    }

    return getPaymentStatusLabel(payment.status);
  }

  return job.status === 'payment_pending' ? 'Pendiente de pago' : 'A confirmar';
}

function getExecutionSubtitle(job: Job): string {
  switch (job.status) {
    case 'in_progress':
      return 'Trabajo en curso';
    case 'review_pending':
    case 'completion_pending':
      return 'Trabajo finalizado por el profesional';
    case 'completed':
      return 'Trabajo completado';
    case 'disputed':
      return 'Problema reportado';
    case 'quote_accepted':
    case 'ready_to_start':
      return 'Esperando inicio';
    default:
      return 'Pendiente';
  }
}

function getFinalizationSubtitle(job: Job): string {
  switch (job.status) {
    case 'review_pending':
    case 'completion_pending':
      return 'Pendiente de confirmación';
    case 'completed':
      return 'Trabajo confirmado';
    case 'disputed':
      return 'Problema reportado';
    default:
      return 'Pendiente';
  }
}

function createCustomerProgressRows({
  job,
  onPress,
  payment,
  quote,
}: {
  job: Job;
  onPress?: () => void;
  payment: JobPayment | null;
  quote: JobQuote | null;
}): JobProgressRowItem[] {
  return [
    {
      id: 'selected',
      onPress,
      state: getProgressRowState('selected', job.status),
      subtitle: 'Profesional seleccionado',
      title: 'Profesional',
    },
    {
      id: 'visit',
      onPress,
      state: getProgressRowState('visit', job.status),
      subtitle: getVisitSubtitle(job),
      title: 'Visita',
    },
    {
      id: 'diagnosis',
      onPress,
      state: getProgressRowState('diagnosis', job.status),
      subtitle: getDiagnosisSubtitle(job),
      title: 'Diagnóstico',
    },
    {
      id: 'quote',
      onPress,
      state: getProgressRowState('quote', job.status),
      subtitle: getQuoteSubtitle(quote),
      title: 'Presupuesto',
    },
    {
      id: 'payment',
      onPress,
      state: getProgressRowState('payment', job.status),
      subtitle: getPaymentSubtitle(payment, job),
      title: 'Pago',
    },
    {
      id: 'execution',
      onPress,
      state: getProgressRowState('execution', job.status),
      subtitle: getExecutionSubtitle(job),
      title: 'Ejecución',
    },
    {
      id: 'completed',
      onPress,
      state: getProgressRowState('completed', job.status),
      subtitle: getFinalizationSubtitle(job),
      title: 'Finalización',
    },
  ];
}

export function CustomerJobSummaryPanel({ requestId }: { requestId: string }) {
  const jobQuery = useQuery({
    queryKey: customerJobQueryKey(requestId),
    queryFn: () => getCustomerJobByRequest(requestId),
    enabled: requestId.length > 0,
  });
  const job = jobQuery.data ?? null;
  const quotesQuery = useQuery({
    queryKey: job ? jobQuotesQueryKey(job.id) : jobQuotesQueryKey(requestId),
    queryFn: () => listJobQuotes(job?.id ?? ''),
    enabled: Boolean(job),
  });
  const paymentQuery = useQuery({
    queryKey: job ? jobPaymentQueryKey(job.id) : jobPaymentQueryKey(requestId),
    queryFn: () => getJobPayment(job?.id ?? ''),
    enabled: Boolean(job),
  });

  if (jobQuery.isPending) {
    return (
      <SectionCard title="Proceso del trabajo">
        <LoadingState message="Cargando trabajo..." />
      </SectionCard>
    );
  }

  if (jobQuery.error) {
    return (
      <SectionCard title="Proceso del trabajo">
        <ErrorState message="No pudimos cargar el trabajo." onRetry={() => void jobQuery.refetch()} />
      </SectionCard>
    );
  }

  if (!job) {
    return null;
  }

  const latestQuote = quotesQuery.data?.[0] ?? null;
  const sentQuote = quotesQuery.data?.find((quote) => quote.status === 'sent') ?? null;
  const visibleQuote = sentQuote ?? latestQuote;
  const payment = paymentQuery.data ?? null;
  const openJobProgress = () => {
    router.push({
      pathname: '/(customer)/jobs/[jobId]',
      params: { jobId: job.id },
    } as Href);
  };

  return (
    <SectionCard title="Proceso del trabajo">
      <JobProgressList rows={createCustomerProgressRows({ job, onPress: openJobProgress, payment, quote: visibleQuote })} />
      {quotesQuery.error ? <ErrorState message="No pudimos cargar el presupuesto." /> : null}
      {paymentQuery.error ? <ErrorState message="No pudimos cargar el pago." /> : null}
    </SectionCard>
  );
}

export function CustomerJobDetailScreen({ jobId }: { jobId: string }) {
  const detailRouter = useRouter();
  const jobQuery = useQuery({
    queryKey: customerJobByIdQueryKey(jobId),
    queryFn: () => getCustomerJobById(jobId),
    enabled: jobId.length > 0,
  });

  if (jobQuery.isPending) {
    return (
      <Screen scroll={false}>
        <ScreenHeader
          backAction={<CustomerJobBackButton requestId={null} router={detailRouter} />}
          subtitle="Detalle operativo del trabajo."
          title="Progreso del trabajo"
        />
        <LoadingState message="Cargando trabajo..." />
      </Screen>
    );
  }

  if (jobQuery.error || !jobQuery.data) {
    return (
      <Screen>
        <ScreenHeader
          backAction={<CustomerJobBackButton requestId={jobQuery.data?.requestId ?? null} router={detailRouter} />}
          subtitle="Detalle operativo del trabajo."
          title="Progreso del trabajo"
        />
        <ErrorState message="No pudimos cargar el trabajo." onRetry={() => void jobQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        backAction={<CustomerJobBackButton requestId={jobQuery.data.requestId} router={detailRouter} />}
        subtitle="Detalle operativo del trabajo."
        title="Progreso del trabajo"
      />
      <CustomerJobPanel requestId={jobQuery.data.requestId} />
    </Screen>
  );
}

type DetailRouter = ReturnType<typeof useRouter>;

function CustomerJobBackButton({
  requestId,
  router: detailRouter,
}: {
  requestId: string | null;
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

export function CustomerJobPanel({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const jobQuery = useQuery({
    queryKey: customerJobQueryKey(requestId),
    queryFn: () => getCustomerJobByRequest(requestId),
    enabled: requestId.length > 0,
  });
  const job = jobQuery.data ?? null;
  const quotesQuery = useQuery({
    queryKey: job ? jobQuotesQueryKey(job.id) : jobQuotesQueryKey(requestId),
    queryFn: () => listJobQuotes(job?.id ?? ''),
    enabled: Boolean(job),
  });
  const paymentQuery = useQuery({
    queryKey: job ? jobPaymentQueryKey(job.id) : jobPaymentQueryKey(requestId),
    queryFn: () => getJobPayment(job?.id ?? ''),
    enabled: Boolean(job),
  });
  const reviewsQuery = useQuery({
    queryKey: job ? jobReviewsQueryKey(job.id) : jobReviewsQueryKey(requestId),
    queryFn: () => listJobReviews(job?.id ?? ''),
    enabled: Boolean(job),
  });

  const setJob = (updatedJob: Job) => {
    queryClient.setQueryData(customerJobQueryKey(requestId), updatedJob);
    queryClient.setQueryData(customerJobByIdQueryKey(updatedJob.id), updatedJob);
  };
  const updateJobStatus = (jobStatus: Job['status']) => {
    if (!job) {
      return;
    }

    const updatedJob = { ...job, status: jobStatus };
    queryClient.setQueryData(customerJobQueryKey(requestId), updatedJob);
    queryClient.setQueryData(customerJobByIdQueryKey(job.id), updatedJob);
  };
  const refreshQuotes = () => {
    if (job) {
      void queryClient.invalidateQueries({ queryKey: jobQuotesQueryKey(job.id) });
    }
  };
  const setPayment = (payment: JobPayment) => {
    queryClient.setQueryData(jobPaymentQueryKey(payment.jobId), payment);
  };

  const confirmVisitMutation = useMutation({
    mutationFn: () => confirmCustomerJobVisit(job?.id ?? ''),
    onSuccess: setJob,
  });
  const rejectVisitMutation = useMutation({
    mutationFn: () => rejectCustomerJobVisit(job?.id ?? ''),
    onSuccess: setJob,
  });
  const acceptQuoteMutation = useMutation({
    mutationFn: acceptCustomerJobQuote,
    onSuccess: (result) => {
      updateJobStatus(result.jobStatus);
      setPayment(result.payment);
      refreshQuotes();
    },
  });
  const retryPaymentMutation = useMutation({
    mutationFn: retryMockPayment,
    onSuccess: setPayment,
  });
  const processPaymentMutation = useMutation({
    mutationFn: ({ approved, paymentId }: { approved: boolean; paymentId: string }) =>
      mockPaymentProvider.processPayment(paymentId, {
        approved,
        failureReason: approved ? null : 'Pago rechazado por el proveedor simulado.',
      }),
    onSuccess: (payment) => {
      setPayment(payment);

      if (payment.status === 'secured') {
        updateJobStatus('ready_to_start');
      }
    },
  });
  const rejectQuoteMutation = useMutation({
    mutationFn: ({ quoteId, rejectedReason }: { quoteId: string; rejectedReason: string | null }) =>
      rejectCustomerJobQuote(quoteId, { rejectedReason }),
    onSuccess: (result) => {
      updateJobStatus(result.jobStatus);
      refreshQuotes();
    },
  });
  const confirmCompletionMutation = useMutation({
    mutationFn: () => confirmCustomerJobCompletion(job?.id ?? ''),
    onSuccess: setJob,
  });
  const disputeCompletionMutation = useMutation({
    mutationFn: (values: DisputeJobCompletionInput) => disputeCustomerJobCompletion(job?.id ?? '', values),
    onSuccess: setJob,
  });
  const reviewMutation = useMutation({
    mutationFn: (values: CreateReviewInput) => createJobReview(job?.id ?? '', values),
    onSuccess: (review) => {
      queryClient.setQueryData<JobReview[]>(jobReviewsQueryKey(review.jobId), (currentReviews = []) => [
        ...currentReviews.filter((currentReview) => currentReview.id !== review.id),
        review,
      ]);
    },
  });

  if (jobQuery.isPending) {
    return (
      <Card>
        <LoadingState message="Cargando trabajo..." />
      </Card>
    );
  }

  if (jobQuery.error) {
    return (
      <Card>
        <ErrorState message="No pudimos cargar el trabajo." onRetry={() => void jobQuery.refetch()} />
      </Card>
    );
  }

  if (!job) {
    return null;
  }

  const quotes = quotesQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const latestQuote = quotes[0] ?? null;
  const sentQuote = job.status === 'quote_sent' ? quotes.find((quote) => quote.status === 'sent') ?? null : null;
  const payment = paymentQuery.data ?? null;
  const hasCustomerReview = reviews.some((review) => review.reviewerRole === 'customer');
  const loading =
    confirmVisitMutation.isPending ||
    rejectVisitMutation.isPending ||
    acceptQuoteMutation.isPending ||
    retryPaymentMutation.isPending ||
    processPaymentMutation.isPending ||
    rejectQuoteMutation.isPending ||
    confirmCompletionMutation.isPending ||
    disputeCompletionMutation.isPending ||
    reviewMutation.isPending;

  return (
    <View style={styles.stack}>
      <JobProgressList rows={createCustomerProgressRows({ job, payment, quote: latestQuote })} />
      {quotesQuery.isPending ? <LoadingState message="Cargando presupuestos..." /> : null}
      {paymentQuery.isPending && job.status !== 'quote_sent' ? <LoadingState message="Cargando pago..." /> : null}
      {!latestQuote ? (
        <EmptyState description="El profesional todavía no envió un presupuesto formal." title="Sin presupuesto" />
      ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <CustomerActions
          currentSentQuote={sentQuote}
          hasCustomerReview={hasCustomerReview}
          job={job}
          latestQuote={latestQuote}
          loading={loading}
          payment={payment}
          onAcceptQuote={(quoteId) => {
            setError(null);
            Alert.alert('Aceptar presupuesto', 'Al aceptar se crea un pago pendiente para proteger el trabajo.', [
              { style: 'cancel', text: 'Volver' },
              {
                onPress: () =>
                  void acceptQuoteMutation.mutateAsync(quoteId).catch((submissionError) => {
                    logDevelopmentSupabaseError('customer-job:accept-quote-form', submissionError);
                    setError(getSubmissionErrorMessage(submissionError, 'No pudimos aceptar el presupuesto.'));
                  }),
                text: 'Aceptar presupuesto',
              },
            ]);
          }}
          onConfirmVisit={() => {
            setError(null);
            void confirmVisitMutation.mutateAsync().catch((submissionError) => {
              logDevelopmentSupabaseError('customer-job:confirm-visit-form', submissionError);
              setError(getSubmissionErrorMessage(submissionError, 'No pudimos confirmar la visita.'));
            });
          }}
          onConfirmCompletion={() => {
            setError(null);
            Alert.alert('Confirmar trabajo terminado', 'Confirmá que el trabajo quedó terminado.', [
              { style: 'cancel', text: 'Volver' },
              {
                onPress: () =>
                  void confirmCompletionMutation.mutateAsync().catch((submissionError) => {
                    logDevelopmentSupabaseError('customer-job:confirm-completion-form', submissionError);
                    setError(getSubmissionErrorMessage(submissionError, 'No pudimos confirmar el trabajo.'));
                  }),
                text: 'Confirmar',
              },
            ]);
          }}
          onPay={(paymentId, approved) => {
            setError(null);
            const processPayment = () =>
              void processPaymentMutation.mutateAsync({ approved, paymentId }).catch((submissionError) => {
                logDevelopmentSupabaseError('customer-job:process-payment-form', submissionError);
                setError(getSubmissionErrorMessage(submissionError, 'No pudimos procesar el pago.'));
              });

            if (payment?.status === 'failed') {
              void retryPaymentMutation
                .mutateAsync(paymentId)
                .then(() => processPayment())
                .catch((submissionError) => {
                  logDevelopmentSupabaseError('customer-job:retry-payment-form', submissionError);
                  setError(getSubmissionErrorMessage(submissionError, 'No pudimos reintentar el pago.'));
                });
              return;
            }

            processPayment();
          }}
          onDisputeCompletion={(values) => {
            setError(null);
            void disputeCompletionMutation.mutateAsync(values).catch((submissionError) => {
              logDevelopmentSupabaseError('customer-job:dispute-completion-form', submissionError);
              setError(getSubmissionErrorMessage(submissionError, 'No pudimos reportar el problema.'));
            });
          }}
          onRejectQuote={(quoteId, rejectedReason) => {
            setError(null);
            void rejectQuoteMutation.mutateAsync({ quoteId, rejectedReason }).catch((submissionError) => {
              logDevelopmentSupabaseError('customer-job:reject-quote-form', submissionError);
              setError(getSubmissionErrorMessage(submissionError, 'No pudimos rechazar el presupuesto.'));
            });
          }}
          onRejectVisit={() => {
            setError(null);
            void rejectVisitMutation.mutateAsync().catch((submissionError) => {
              logDevelopmentSupabaseError('customer-job:reject-visit-form', submissionError);
              setError(getSubmissionErrorMessage(submissionError, 'No pudimos rechazar la visita.'));
            });
          }}
          onReview={(values) => {
            setError(null);
            void reviewMutation.mutateAsync(values).catch((submissionError) => {
              logDevelopmentSupabaseError('customer-job:create-review-form', submissionError);
              setError(getSubmissionErrorMessage(submissionError, 'No pudimos guardar la calificación.'));
            });
          }}
        />
        {quotes.length > 1 ? <QuoteHistory quotes={quotes.slice(1)} /> : null}
    </View>
  );
}

function CustomerActions({
  currentSentQuote,
  hasCustomerReview,
  job,
  latestQuote,
  loading,
  onAcceptQuote,
  onConfirmCompletion,
  onConfirmVisit,
  onDisputeCompletion,
  onPay,
  onRejectQuote,
  onRejectVisit,
  onReview,
  payment,
}: {
  currentSentQuote: JobQuote | null;
  hasCustomerReview: boolean;
  job: Job;
  latestQuote: JobQuote | null;
  loading: boolean;
  onAcceptQuote: (quoteId: string) => void;
  onConfirmCompletion: () => void;
  onConfirmVisit: () => void;
  onDisputeCompletion: (values: DisputeJobCompletionInput) => void;
  onPay: (paymentId: string, approved: boolean) => void;
  onRejectQuote: (quoteId: string, rejectedReason: string | null) => void;
  onRejectVisit: () => void;
  onReview: (values: CreateReviewInput) => void;
  payment: JobPayment | null;
}) {
  const [rejectedReason, setRejectedReason] = useState('');

  if (job.status === 'visit_proposed') {
    return (
      <View style={styles.form}>
        <Text style={styles.subtitle}>Confirmar coordinación</Text>
        <Button disabled={loading} onPress={onConfirmVisit}>
          {loading ? 'Guardando...' : 'Confirmar visita'}
        </Button>
        <Button disabled={loading} onPress={onRejectVisit} variant="secondary">
          Rechazar propuesta
        </Button>
      </View>
    );
  }

  if (currentSentQuote) {
    return (
      <View style={styles.form}>
        <Text style={styles.subtitle}>Responder presupuesto</Text>
        <Text style={styles.meta}>Al aceptar se prepara el pago protegido. Los materiales quedan solo como referencia.</Text>
        <Button disabled={loading} onPress={() => onAcceptQuote(currentSentQuote.id)}>
          {loading ? 'Guardando...' : 'Aceptar presupuesto'}
        </Button>
        <TextInput
          multiline
          onChangeText={setRejectedReason}
          placeholder="Motivo opcional del rechazo"
          value={rejectedReason}
        />
        <Button
          disabled={loading}
          onPress={() => onRejectQuote(currentSentQuote.id, rejectedReason.trim() || null)}
          variant="secondary"
        >
          Rechazar presupuesto
        </Button>
      </View>
    );
  }

  if (job.status === 'payment_pending') {
    if (!payment) {
      return <ReadOnlyStatus title="Pago protegido" message="Preparando el pago de este presupuesto." />;
    }

    return <PaymentProtectionCard loading={loading} onPay={onPay} payment={payment} />;
  }

  if (job.status === 'quote_accepted' || job.status === 'ready_to_start') {
    return (
      <ReadOnlyStatus
        title="Pago protegido"
        message="El profesional podrá comenzar cuando coordinen el inicio del trabajo."
      />
    );
  }

  if (job.status === 'in_progress') {
    return <ReadOnlyStatus title="Trabajo en curso" message="El profesional ya inició la ejecución." />;
  }

  if (job.status === 'review_pending' || job.status === 'completion_pending') {
    return (
      <CompletionDecisionForm
        acceptedQuote={latestQuote}
        job={job}
        loading={loading}
        onConfirm={onConfirmCompletion}
        onDispute={onDisputeCompletion}
      />
    );
  }

  if (job.status === 'completed') {
    if (payment?.status !== 'released') {
      return (
        <ReadOnlyStatus
          title="Pago pendiente de liberación"
          message="Vas a poder calificar cuando el pago se libere al profesional."
        />
      );
    }

    if (hasCustomerReview) {
      return <ReadOnlyStatus title="Calificación enviada" message="Ya calificaste a este profesional." />;
    }

    return <ReviewForm loading={loading} onSubmit={onReview} title="Calificar profesional" />;
  }

  if (job.status === 'disputed') {
    return (
      <ReadOnlyStatus
        title="Problema reportado"
        message="El historial queda visible. La resolución administrativa queda fuera de esta fase."
      />
    );
  }

  return null;
}

function PaymentProtectionCard({
  loading,
  onPay,
  payment,
}: {
  loading: boolean;
  onPay: (paymentId: string, approved: boolean) => void;
  payment: JobPayment;
}) {
  return (
    <Card>
      <View style={styles.form}>
        <Text style={styles.subtitle}>Pago protegido</Text>
        <InfoRow label="Mano de obra" value={formatMoney(payment.laborAmount)} />
        <InfoRow label="Visita" value={formatMoney(payment.visitAmount)} />
        <InfoRow label="Comisión CasaTicket" value={formatMoney(payment.platformFeeAmount)} />
        <InfoRow label="Total" value={formatMoney(payment.customerTotalAmount)} />
        <Text style={styles.meta}>
          Materiales aproximados no incluidos: {formatMoney(payment.materialsReferenceAmount)}.
        </Text>
        <Text style={styles.meta}>
          El profesional podrá comenzar cuando el pago quede confirmado. El dinero se liberará después de finalizar el
          trabajo, salvo que reportes un problema.
        </Text>
        {payment.status === 'failed' && payment.failureReason ? <Text style={styles.error}>{payment.failureReason}</Text> : null}
        <Button disabled={loading} onPress={() => onPay(payment.id, true)}>
          {loading ? 'Procesando...' : 'Pagar y asegurar el trabajo'}
        </Button>
        {process.env.NODE_ENV !== 'production' ? (
          <Button disabled={loading} onPress={() => onPay(payment.id, false)} variant="secondary">
            Simular pago rechazado
          </Button>
        ) : null}
      </View>
    </Card>
  );
}

function ReadOnlyStatus({ message, title }: { message: string; title: string }) {
  return (
    <Card>
      <View style={styles.form}>
        <Text style={styles.subtitle}>{title}</Text>
        <Text style={styles.meta}>{message}</Text>
      </View>
    </Card>
  );
}

function CompletionDecisionForm({
  acceptedQuote,
  job,
  loading,
  onConfirm,
  onDispute,
}: {
  acceptedQuote: JobQuote | null;
  job: Job;
  loading: boolean;
  onConfirm: () => void;
  onDispute: (values: DisputeJobCompletionInput) => void;
}) {
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submitDispute = () => {
    const payload = {
      disputeDetails: disputeDetails.trim(),
      disputeReason: disputeReason.trim(),
    };
    setValidationError(null);

    if (payload.disputeReason.length < 3) {
      setValidationError('El motivo es obligatorio.');
      return;
    }

    if (payload.disputeDetails.length < 20) {
      setValidationError('El detalle debe tener al menos 20 caracteres.');
      return;
    }

    onDispute(payload);
  };

  return (
    <Card>
      <View style={styles.form}>
        <Text style={styles.subtitle}>Revisar finalización</Text>
        <InfoRow label="Presupuesto aceptado" value={acceptedQuote ? formatMoney(acceptedQuote.totalAmount) : 'Sin presupuesto'} />
        <InfoRow label="Trabajo realizado" value={job.completionSummary ?? 'Sin resumen'} />
        <InfoRow label="Materiales informados" value={job.finalMaterialsNotes ?? 'Sin materiales informados'} />
        <Button disabled={loading} onPress={onConfirm}>
          {loading ? 'Guardando...' : 'Confirmar trabajo terminado'}
        </Button>
        <Text style={styles.label}>Reportar un problema</Text>
        <TextInput onChangeText={setDisputeReason} placeholder="Motivo" value={disputeReason} />
        <TextInput multiline onChangeText={setDisputeDetails} placeholder="Detalle del problema" value={disputeDetails} />
        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
        <Button disabled={loading} onPress={submitDispute} variant="secondary">
          Reportar un problema
        </Button>
      </View>
    </Card>
  );
}

function ReviewForm({
  loading,
  onSubmit,
  title,
}: {
  loading: boolean;
  onSubmit: (values: CreateReviewInput) => void;
  title: string;
}) {
  const [rating, setRating] = useState('');
  const [comment, setComment] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = () => {
    const numericRating = Number(rating);
    const payload = {
      comment: comment.trim() || null,
      rating: numericRating,
    };
    setValidationError(null);

    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      setValidationError('Elegí una calificación entre 1 y 5.');
      return;
    }

    onSubmit(payload);
  };

  return (
    <Card>
      <View style={styles.form}>
        <Text style={styles.subtitle}>{title}</Text>
        <Text style={styles.label}>Calificación general</Text>
        <TextInput keyboardType="numeric" onChangeText={setRating} placeholder="1 a 5" value={rating} />
        <Text style={styles.label}>Comentario opcional</Text>
        <TextInput multiline onChangeText={setComment} placeholder="Comentario opcional" value={comment} />
        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
        <Button disabled={loading} onPress={submit}>
          {loading ? 'Guardando...' : title}
        </Button>
      </View>
    </Card>
  );
}

function QuoteHistory({ quotes }: { quotes: JobQuote[] }) {
  return (
    <View style={styles.box}>
      <Text style={styles.subtitle}>Historial de presupuestos</Text>
      {quotes.map((quote) => (
        <Text key={quote.id} style={styles.meta}>
          v{quote.version}: {getJobQuoteStatusLabel(quote.status)} · {formatMoney(quote.totalAmount)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  form: {
    gap: 10,
  },
  box: {
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.surfaceStrong,
    padding: 12,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  total: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
