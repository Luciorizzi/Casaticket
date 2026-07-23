import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ZodError } from 'zod';

import { getJobQuoteStatusLabel, getPaymentStatusLabel } from '@casaticket/domain';
import type { Job, JobPayment, JobQuote, JobReview } from '@casaticket/types';
import type {
  CreateJobQuoteInput,
  CreateReviewInput,
  CompleteJobByProfessionalInput,
  ProposeJobVisitInput,
  RecordJobDiagnosisInput,
} from '@casaticket/validation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Screen } from '@/components/ui/screen';
import { TextInput } from '@/components/ui/text-input';
import { colors } from '@/components/ui/theme';
import { JobProgressList, type JobProgressRowItem, type JobProgressRowState } from '@/features/jobs/job-progress-list';
import {
  completeProfessionalJob,
  createJobReview,
  createProfessionalJobQuote,
  getJobPayment,
  getProfessionalJobById,
  jobPaymentQueryKey,
  jobQuotesQueryKey,
  jobReviewsQueryKey,
  listJobReviews,
  listJobQuotes,
  professionalJobQueryKey,
  proposeProfessionalJobVisit,
  recordProfessionalJobDiagnosis,
  sendProfessionalJobQuote,
  startProfessionalJob,
} from '@/features/jobs/api';
import { DatePickerField } from '@/features/jobs/date-picker-field';
import { getMobileJobStatusLabel } from '@/features/jobs/status-labels';
import { getUserFacingErrorMessage, logDevelopmentSupabaseError } from '@/lib/errors';

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function isFutureDate(date: string) {
  return date > todayDateString();
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    currency: 'ARS',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function getSubmissionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  return getUserFacingErrorMessage(error, fallback);
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

function shortText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}…`;
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
      return 'Pendiente de pago';
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
      return 'Listo para iniciar';
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

function createProfessionalProgressRows({
  job,
  payment,
  quote,
}: {
  job: Job;
  payment: JobPayment | null;
  quote: JobQuote | null;
}): JobProgressRowItem[] {
  return [
    {
      id: 'selected',
      state: getProgressRowState('selected', job.status),
      subtitle: 'Trabajo seleccionado',
      title: 'Profesional',
    },
    {
      id: 'visit',
      state: getProgressRowState('visit', job.status),
      subtitle: getVisitSubtitle(job),
      title: 'Visita',
    },
    {
      id: 'diagnosis',
      state: getProgressRowState('diagnosis', job.status),
      subtitle: getDiagnosisSubtitle(job),
      title: 'Diagnóstico',
    },
    {
      id: 'quote',
      state: getProgressRowState('quote', job.status),
      subtitle: getQuoteSubtitle(quote),
      title: 'Presupuesto',
    },
    {
      id: 'payment',
      state: getProgressRowState('payment', job.status),
      subtitle: getPaymentSubtitle(payment, job),
      title: 'Pago',
    },
    {
      id: 'execution',
      state: getProgressRowState('execution', job.status),
      subtitle: getExecutionSubtitle(job),
      title: 'Ejecución',
    },
    {
      id: 'completed',
      state: getProgressRowState('completed', job.status),
      subtitle: getFinalizationSubtitle(job),
      title: 'Finalización',
    },
  ];
}

export function ProfessionalJobDetailScreen({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const jobQuery = useQuery({
    queryKey: professionalJobQueryKey(jobId),
    queryFn: () => getProfessionalJobById(jobId),
    enabled: Boolean(jobId),
  });
  const job = jobQuery.data ?? null;
  const quotesQuery = useQuery({
    queryKey: job ? jobQuotesQueryKey(job.id) : jobQuotesQueryKey(jobId || 'pending'),
    queryFn: () => listJobQuotes(job?.id ?? ''),
    enabled: Boolean(job),
  });
  const paymentQuery = useQuery({
    queryKey: job ? jobPaymentQueryKey(job.id) : jobPaymentQueryKey(jobId || 'pending'),
    queryFn: () => getJobPayment(job?.id ?? ''),
    enabled: Boolean(job),
  });
  const reviewsQuery = useQuery({
    queryKey: job ? jobReviewsQueryKey(job.id) : jobReviewsQueryKey(jobId || 'pending'),
    queryFn: () => listJobReviews(job?.id ?? ''),
    enabled: Boolean(job),
  });

  const setJob = (updatedJob: Job) => {
    queryClient.setQueryData(professionalJobQueryKey(updatedJob.id), updatedJob);
  };
  const setQuotes = (jobIdToUpdate: string, updater: (quotes: JobQuote[]) => JobQuote[]) => {
    queryClient.setQueryData<JobQuote[]>(jobQuotesQueryKey(jobIdToUpdate), (currentQuotes = []) =>
      updater(currentQuotes),
    );
  };
  const refetchQuotes = (jobIdToUpdate: string) => {
    void queryClient.invalidateQueries({ queryKey: jobQuotesQueryKey(jobIdToUpdate) });
  };

  const proposeVisitMutation = useMutation({
    mutationFn: (values: ProposeJobVisitInput) => proposeProfessionalJobVisit(jobId, values),
    onSuccess: setJob,
  });
  const diagnosisMutation = useMutation({
    mutationFn: (values: RecordJobDiagnosisInput) => recordProfessionalJobDiagnosis(jobId, values),
    onSuccess: (updatedJob) => {
      setJob(updatedJob);
      refetchQuotes(updatedJob.id);
    },
  });
  const createQuoteMutation = useMutation({
    mutationFn: (values: CreateJobQuoteInput) => createProfessionalJobQuote(jobId, values),
    onSuccess: (quote) => {
      setQuotes(quote.jobId, (currentQuotes) => [
        quote,
        ...currentQuotes.filter((currentQuote) => currentQuote.id !== quote.id),
      ]);
    },
  });
  const sendQuoteMutation = useMutation({
    mutationFn: sendProfessionalJobQuote,
    onSuccess: (quote) => {
      setQuotes(quote.jobId, (currentQuotes) =>
        currentQuotes.map((currentQuote) => (currentQuote.id === quote.id ? quote : currentQuote)),
      );
      queryClient.setQueryData<Job>(professionalJobQueryKey(jobId), (currentJob) =>
        currentJob ? { ...currentJob, status: 'quote_sent' } : currentJob,
      );
      if (process.env.NODE_ENV !== 'production' && quote.status !== 'sent') {
        console.info('[professional-job:send-quote-result]', {
          quoteId: quote.id,
          quoteStatus: quote.status,
          jobStatus: 'quote_sent',
        });
      }
    },
  });
  const startJobMutation = useMutation({
    mutationFn: () => startProfessionalJob(jobId),
    onSuccess: setJob,
  });
  const completeJobMutation = useMutation({
    mutationFn: (values: CompleteJobByProfessionalInput) => completeProfessionalJob(jobId, values),
    onSuccess: setJob,
  });
  const reviewMutation = useMutation({
    mutationFn: (values: CreateReviewInput) => createJobReview(jobId, values),
    onSuccess: (review) => {
      queryClient.setQueryData<JobReview[]>(jobReviewsQueryKey(review.jobId), (currentReviews = []) => [
        ...currentReviews.filter((currentReview) => currentReview.id !== review.id),
        review,
      ]);
    },
  });

  if (!jobId) {
    return (
      <Screen subtitle="No encontramos el identificador del trabajo." title="Trabajo">
        <ErrorState message="Volvé a Mis trabajos e intentá abrirlo nuevamente." />
      </Screen>
    );
  }

  if (jobQuery.isPending) {
    return (
      <Screen subtitle="Cargando información del trabajo." title="Trabajo">
        <LoadingState message="Cargando trabajo..." />
      </Screen>
    );
  }

  if (jobQuery.error || !job) {
    return (
      <Screen subtitle="No pudimos cargar este trabajo." title="Trabajo">
        <ErrorState
          message="El trabajo no existe o no tenés permiso para verlo."
          onRetry={() => void jobQuery.refetch()}
        />
      </Screen>
    );
  }

  const quotes = quotesQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const latestQuote = quotes[0] ?? null;
  const draftQuote = quotes.find((quote) => quote.status === 'draft') ?? null;
  const payment = paymentQuery.data ?? null;
  const hasProfessionalReview = reviews.some((review) => review.reviewerRole === 'professional');

  return (
    <Screen
      footer={
        <Button onPress={() => router.back()} variant="secondary">
          Volver a Mis trabajos
        </Button>
      }
      subtitle={`Estado: ${getMobileJobStatusLabel(job.status)}`}
      title="Gestionar trabajo"
    >
      <JobSummaryCard job={job} payment={payment} quote={latestQuote} />
      {quotesQuery.isPending ? <LoadingState message="Cargando presupuestos..." /> : null}
      {paymentQuery.isPending && job.status !== 'quote_sent' ? <LoadingState message="Cargando pago..." /> : null}
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <JobStatusActions
        draftQuote={draftQuote}
        isPending={
          proposeVisitMutation.isPending ||
          diagnosisMutation.isPending ||
          createQuoteMutation.isPending ||
          sendQuoteMutation.isPending
          || startJobMutation.isPending
          || completeJobMutation.isPending
          || reviewMutation.isPending
        }
        job={job}
        hasProfessionalReview={hasProfessionalReview}
        payment={payment}
        onCreateQuote={async (values) => {
          setFormError(null);

          try {
            await createQuoteMutation.mutateAsync(values);
          } catch (error) {
            logDevelopmentSupabaseError('professional-job:create-quote-form', error);
            setFormError(getSubmissionErrorMessage(error, 'No pudimos crear el presupuesto.'));
          }
        }}
        onProposeVisit={async (values) => {
          setFormError(null);

          try {
            await proposeVisitMutation.mutateAsync(values);
          } catch (error) {
            logDevelopmentSupabaseError('professional-job:propose-visit-form', error);
            setFormError(getSubmissionErrorMessage(error, 'No pudimos proponer la visita.'));
          }
        }}
        onReview={async (values) => {
          setFormError(null);

          try {
            await reviewMutation.mutateAsync(values);
          } catch (error) {
            logDevelopmentSupabaseError('professional-job:create-review-form', error);
            setFormError(getSubmissionErrorMessage(error, 'No pudimos guardar la calificación.'));
          }
        }}
        onRecordDiagnosis={async (values) => {
          setFormError(null);

          try {
            await diagnosisMutation.mutateAsync(values);
          } catch (error) {
            logDevelopmentSupabaseError('professional-job:record-diagnosis-form', error);
            setFormError(getSubmissionErrorMessage(error, 'No pudimos guardar el diagnóstico.'));
          }
        }}
        onSendQuote={async (quoteId) => {
          setFormError(null);

          try {
            await sendQuoteMutation.mutateAsync(quoteId);
          } catch (error) {
            logDevelopmentSupabaseError('professional-job:send-quote-form', error);
            setFormError(getSubmissionErrorMessage(error, 'No pudimos enviar el presupuesto.'));
          }
        }}
        onStartJob={async () => {
          setFormError(null);

          Alert.alert('Iniciar trabajo', 'Confirmá que vas a comenzar la ejecución del trabajo.', [
            { style: 'cancel', text: 'Volver' },
            {
              onPress: () =>
                void startJobMutation.mutateAsync().catch((error) => {
                  logDevelopmentSupabaseError('professional-job:start-form', error);
                  setFormError(getSubmissionErrorMessage(error, 'No pudimos iniciar el trabajo.'));
                }),
              text: 'Iniciar trabajo',
            },
          ]);
        }}
        onSubmitCompletion={async (values) => {
          setFormError(null);

          try {
            await completeJobMutation.mutateAsync(values);
          } catch (error) {
            logDevelopmentSupabaseError('professional-job:complete-form', error);
            setFormError(getSubmissionErrorMessage(error, 'No pudimos marcar el trabajo como terminado.'));
          }
        }}
      />
      {quotes.length === 0 ? (
        <EmptyState
          description="Después de registrar el diagnóstico vas a poder preparar un presupuesto formal."
          title="Sin presupuesto"
        />
      ) : null}
      {quotes.length > 1 ? <QuoteHistoryCard quotes={quotes.slice(1)} /> : null}
    </Screen>
  );
}

function JobSummaryCard({ job, payment, quote }: { job: Job; payment: JobPayment | null; quote: JobQuote | null }) {
  return <JobProgressList rows={createProfessionalProgressRows({ job, payment, quote })} />;
}

function JobStatusActions({
  draftQuote,
  isPending,
  job,
  hasProfessionalReview,
  onCreateQuote,
  onProposeVisit,
  onReview,
  onRecordDiagnosis,
  onSendQuote,
  onStartJob,
  onSubmitCompletion,
  payment,
}: {
  draftQuote: JobQuote | null;
  hasProfessionalReview: boolean;
  isPending: boolean;
  job: Job;
  onCreateQuote: (values: CreateJobQuoteInput) => Promise<void>;
  onProposeVisit: (values: ProposeJobVisitInput) => Promise<void>;
  onReview: (values: CreateReviewInput) => Promise<void>;
  onRecordDiagnosis: (values: RecordJobDiagnosisInput) => Promise<void>;
  onSendQuote: (quoteId: string) => Promise<void>;
  onStartJob: () => Promise<void>;
  onSubmitCompletion: (values: CompleteJobByProfessionalInput) => Promise<void>;
  payment: JobPayment | null;
}) {
  if (job.status === 'coordination_pending') {
    return <ProposeVisitForm loading={isPending} onSubmit={onProposeVisit} />;
  }

  if (job.status === 'visit_proposed') {
    return (
      <ReadOnlyStatus
        message="La propuesta está pendiente de confirmación del cliente."
        title="Visita propuesta"
      />
    );
  }

  if (job.status === 'visit_confirmed' || job.status === 'diagnosis_pending') {
    return <DiagnosisForm loading={isPending} onSubmit={onRecordDiagnosis} />;
  }

  if (draftQuote) {
    return (
      <Card>
        <View style={styles.stack}>
          <Text style={styles.title}>Presupuesto en borrador</Text>
          <Text style={styles.meta}>Revisalo y envialo cuando esté listo. Después no se podrá editar.</Text>
          <Button disabled={isPending} onPress={() => void onSendQuote(draftQuote.id)}>
            {isPending ? 'Enviando...' : 'Enviar presupuesto'}
          </Button>
        </View>
      </Card>
    );
  }

  if (job.status === 'quote_pending') {
    return <QuoteForm loading={isPending} onSubmit={onCreateQuote} title="Crear presupuesto" />;
  }

  if (job.status === 'quote_sent') {
    return <ReadOnlyStatus title="Presupuesto enviado" message="Esperando respuesta del cliente." />;
  }

  if (job.status === 'payment_pending' || job.status === 'quote_accepted') {
    return <ReadOnlyStatus title="Esperando pago protegido" message="Esperando pago protegido del cliente." />;
  }

  if (job.status === 'ready_to_start') {
    return (
      <Card>
        <View style={styles.stack}>
          <Text style={styles.title}>Pago asegurado</Text>
          <Text style={styles.meta}>Pago asegurado. Ya podés iniciar el trabajo.</Text>
          {payment ? (
            <>
              <Text style={styles.meta}>Monto estimado a recibir: {formatMoney(payment.professionalAmount)}</Text>
              <Text style={styles.meta}>Comisión CasaTicket: {formatMoney(payment.platformFeeAmount)}</Text>
              <Text style={styles.meta}>Estado de liberación: {getPaymentStatusLabel(payment.status)}</Text>
            </>
          ) : null}
          <Button disabled={isPending} onPress={() => void onStartJob()}>
            {isPending ? 'Iniciando...' : 'Iniciar trabajo'}
          </Button>
        </View>
      </Card>
    );
  }

  if (job.status === 'quote_rejected') {
    return <QuoteForm loading={isPending} onSubmit={onCreateQuote} title="Crear nueva versión" />;
  }

  if (job.status === 'in_progress') {
    return <CompleteJobForm loading={isPending} onSubmit={onSubmitCompletion} />;
  }

  if (job.status === 'review_pending' || job.status === 'completion_pending') {
    return (
      <ReadOnlyStatus
        title="Revisión del cliente"
        message="El pago sigue protegido hasta que el cliente confirme o venza la ventana de reclamo."
      />
    );
  }

  if (job.status === 'completed') {
    if (payment?.status !== 'released') {
      return (
        <ReadOnlyStatus
          title="Pago pendiente de liberación"
          message="Vas a poder calificar cuando el pago esté liberado."
        />
      );
    }

    if (hasProfessionalReview) {
      return <ReadOnlyStatus title="Calificación enviada" message="Ya calificaste a este cliente." />;
    }

    return <ReviewForm loading={isPending} onSubmit={onReview} title="Calificar cliente" />;
  }

  if (job.status === 'disputed') {
    return (
      <ReadOnlyStatus
        title="Problema reportado"
        message="El cliente reportó un problema. El historial queda visible para seguimiento."
      />
    );
  }

  return <ReadOnlyStatus title="Trabajo cancelado" message="Este trabajo ya no admite acciones." />;
}

function ReadOnlyStatus({ message, title }: { message: string; title: string }) {
  return (
    <Card>
      <View style={styles.stack}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{message}</Text>
      </View>
    </Card>
  );
}

function CompleteJobForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (values: CompleteJobByProfessionalInput) => Promise<void>;
}) {
  const [completionSummary, setCompletionSummary] = useState('');
  const [finalNotes, setFinalNotes] = useState('');
  const [finalMaterialsNotes, setFinalMaterialsNotes] = useState('');
  const [finalMaterialsAmount, setFinalMaterialsAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async () => {
    const materialsAmount = finalMaterialsAmount.trim() ? Number(finalMaterialsAmount) : null;
    const payload = {
      completionSummary: completionSummary.trim(),
      finalMaterialsAmount: materialsAmount,
      finalMaterialsNotes: finalMaterialsNotes.trim() || null,
      finalNotes: finalNotes.trim() || null,
    };
    setValidationError(null);

    if (payload.completionSummary.length < 20) {
      setValidationError('El resumen debe tener al menos 20 caracteres.');
      return;
    }

    if (materialsAmount !== null && (!Number.isFinite(materialsAmount) || materialsAmount < 0)) {
      setValidationError('El importe final de materiales debe ser válido.');
      return;
    }

    await onSubmit(payload);
  };

  return (
    <Card>
      <View style={styles.stack}>
        <Text style={styles.title}>Marcar trabajo como terminado</Text>
        <Text style={styles.label}>Resumen del trabajo realizado</Text>
        <TextInput
          multiline
          onChangeText={setCompletionSummary}
          placeholder="Contá qué trabajo realizaste"
          value={completionSummary}
        />
        <Text style={styles.label}>Observaciones finales</Text>
        <TextInput
          multiline
          onChangeText={setFinalNotes}
          placeholder="Observaciones opcionales"
          value={finalNotes}
        />
        <Text style={styles.label}>Materiales realmente utilizados</Text>
        <TextInput
          multiline
          onChangeText={setFinalMaterialsNotes}
          placeholder="Materiales utilizados"
          value={finalMaterialsNotes}
        />
        <Text style={styles.label}>Importe final de materiales</Text>
        <TextInput
          keyboardType="numeric"
          onChangeText={setFinalMaterialsAmount}
          placeholder="Importe informativo"
          value={finalMaterialsAmount}
        />
        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
        <Button disabled={loading} onPress={() => void submit()}>
          {loading ? 'Guardando...' : 'Marcar trabajo como terminado'}
        </Button>
      </View>
    </Card>
  );
}

function ProposeVisitForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (values: ProposeJobVisitInput) => Promise<void>;
}) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTimeText, setScheduledTimeText] = useState('');
  const [schedulingNotes, setSchedulingNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async () => {
    const nextDate = scheduledDate.trim();
    const nextTimeText = scheduledTimeText.trim();
    const nextNotes = schedulingNotes.trim();
    setValidationError(null);

    if (!nextDate) {
      setValidationError('La fecha es obligatoria.');
      return;
    }

    if (!isFutureDate(nextDate)) {
      setValidationError('La fecha debe ser futura.');
      return;
    }

    if (!nextTimeText) {
      setValidationError('El horario es obligatorio.');
      return;
    }

    await onSubmit({
      scheduledDate: nextDate,
      scheduledTimeText: nextTimeText,
      schedulingNotes: nextNotes || null,
    });
  };

  return (
    <Card>
      <View style={styles.stack}>
        <Text style={styles.title}>Proponer visita</Text>
        <Text style={styles.label}>Fecha</Text>
        <DatePickerField
          disablePast
          onChange={(value) => setScheduledDate(value ?? '')}
          placeholder="Seleccionar fecha"
          value={scheduledDate || null}
        />
        <Text style={styles.label}>Horario</Text>
        <TextInput onChangeText={setScheduledTimeText} placeholder="Horario" value={scheduledTimeText} />
        <Text style={styles.label}>Notas opcionales</Text>
        <TextInput
          multiline
          onChangeText={setSchedulingNotes}
          placeholder="Notas de coordinación"
          value={schedulingNotes}
        />
        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
        <Button disabled={loading} onPress={() => void submit()}>
          {loading ? 'Guardando...' : 'Proponer visita'}
        </Button>
      </View>
    </Card>
  );
}

function DiagnosisForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (values: RecordJobDiagnosisInput) => Promise<void>;
}) {
  const [diagnosisText, setDiagnosisText] = useState('');
  const [recommendedWorkText, setRecommendedWorkText] = useState('');
  const [materialsNotes, setMaterialsNotes] = useState('');
  const [diagnosisNotes, setDiagnosisNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async () => {
    const payload = {
      diagnosisText: diagnosisText.trim(),
      recommendedWorkText: recommendedWorkText.trim(),
      materialsNotes: materialsNotes.trim() || null,
      diagnosisNotes: diagnosisNotes.trim() || null,
    };
    setValidationError(null);

    if (payload.diagnosisText.length < 20) {
      setValidationError('El diagnóstico debe tener al menos 20 caracteres.');
      return;
    }

    if (payload.recommendedWorkText.length < 10) {
      setValidationError('El trabajo recomendado debe tener al menos 10 caracteres.');
      return;
    }

    await onSubmit(payload);
  };

  return (
    <Card>
      <View style={styles.stack}>
        <Text style={styles.title}>Registrar diagnóstico</Text>
        <Text style={styles.label}>Diagnóstico técnico</Text>
        <TextInput
          multiline
          onChangeText={setDiagnosisText}
          placeholder="Qué encontraste durante la visita"
          value={diagnosisText}
        />
        <Text style={styles.label}>Trabajo recomendado</Text>
        <TextInput
          multiline
          onChangeText={setRecommendedWorkText}
          placeholder="Qué conviene hacer para resolverlo"
          value={recommendedWorkText}
        />
        <Text style={styles.label}>Materiales / observaciones</Text>
        <TextInput
          multiline
          onChangeText={setMaterialsNotes}
          placeholder="Materiales necesarios u observaciones"
          value={materialsNotes}
        />
        <Text style={styles.label}>Notas internas opcionales</Text>
        <TextInput
          multiline
          onChangeText={setDiagnosisNotes}
          placeholder="Notas adicionales del diagnóstico"
          value={diagnosisNotes}
        />
        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
        <Button disabled={loading} onPress={() => void submit()}>
          {loading ? 'Guardando...' : 'Guardar diagnóstico'}
        </Button>
      </View>
    </Card>
  );
}

function QuoteForm({
  loading,
  onSubmit,
  title,
}: {
  loading: boolean;
  onSubmit: (values: CreateJobQuoteInput) => Promise<void>;
  title: string;
}) {
  const [laborAmount, setLaborAmount] = useState('');
  const [materialsAmount, setMaterialsAmount] = useState('0');
  const [visitAmount, setVisitAmount] = useState('0');
  const [description, setDescription] = useState('');
  const [estimatedDurationText, setEstimatedDurationText] = useState('');
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const platformFeeAmount = useMemo(() => {
    const amount = Number(laborAmount || 0);
    return Number.isFinite(amount) ? Math.round(amount * 0.05 * 100) / 100 : 0;
  }, [laborAmount]);
  const total = useMemo(
    () => Number(laborAmount || 0) + Number(visitAmount || 0) + platformFeeAmount,
    [laborAmount, platformFeeAmount, visitAmount],
  );

  const submit = async () => {
    const payload = {
      description: description.trim(),
      estimatedDurationText: estimatedDurationText.trim() || null,
      laborAmount: Number(laborAmount || 0),
      materialsAmount: Number(materialsAmount || 0),
      validUntil,
      visitAmount: Number(visitAmount || 0),
    };
    setValidationError(null);

    if (!Number.isFinite(total) || total <= 0) {
      setValidationError('El presupuesto debe incluir al menos un importe mayor a cero.');
      return;
    }

    if (payload.description.length < 20) {
      setValidationError('La descripción debe tener al menos 20 caracteres.');
      return;
    }

    await onSubmit(payload);
  };

  return (
    <Card>
      <View style={styles.stack}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.label}>Mano de obra</Text>
        <TextInput keyboardType="numeric" onChangeText={setLaborAmount} placeholder="Mano de obra" value={laborAmount} />
        <Text style={styles.label}>Materiales aproximados</Text>
        <TextInput keyboardType="numeric" onChangeText={setMaterialsAmount} placeholder="Materiales aproximados" value={materialsAmount} />
        <Text style={styles.meta}>No incluido en el total. Puede variar según compra y disponibilidad.</Text>
        <Text style={styles.label}>Visita</Text>
        <TextInput keyboardType="numeric" onChangeText={setVisitAmount} placeholder="Visita" value={visitAmount} />
        <Text style={styles.meta}>Comisión CasaTicket (5%): {formatMoney(platformFeeAmount)}</Text>
        <Text style={styles.total}>Total del servicio: {formatMoney(Number.isFinite(total) ? total : 0)}</Text>
        <Text style={styles.label}>Detalle del presupuesto</Text>
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="Descripción formal del presupuesto"
          value={description}
        />
        <Text style={styles.label}>Duración estimada</Text>
        <TextInput
          onChangeText={setEstimatedDurationText}
          placeholder="Duración estimada"
          value={estimatedDurationText}
        />
        <Text style={styles.label}>Válido hasta</Text>
        <DatePickerField
          allowClear
          disablePast
          onChange={setValidUntil}
          placeholder="Seleccionar vigencia"
          value={validUntil}
        />
        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
        <Button disabled={loading} onPress={() => void submit()}>
          {loading ? 'Guardando...' : 'Guardar borrador'}
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
  onSubmit: (values: CreateReviewInput) => Promise<void>;
  title: string;
}) {
  const [rating, setRating] = useState('');
  const [comment, setComment] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async () => {
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

    await onSubmit(payload);
  };

  return (
    <Card>
      <View style={styles.stack}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.label}>Calificación general</Text>
        <TextInput keyboardType="numeric" onChangeText={setRating} placeholder="1 a 5" value={rating} />
        <Text style={styles.label}>Comentario opcional</Text>
        <TextInput multiline onChangeText={setComment} placeholder="Comentario opcional" value={comment} />
        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
        <Button disabled={loading} onPress={() => void submit()}>
          {loading ? 'Guardando...' : title}
        </Button>
      </View>
    </Card>
  );
}

function QuoteHistoryCard({ quotes }: { quotes: JobQuote[] }) {
  return (
    <Card>
      <View style={styles.stack}>
        <Text style={styles.title}>Historial de presupuestos</Text>
        {quotes.map((quote) => (
          <Text key={quote.id} style={styles.meta}>
            v{quote.version}: {getJobQuoteStatusLabel(quote.status)} · {formatMoney(quote.totalAmount)}
          </Text>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
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
  box: {
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.surfaceStrong,
    padding: 12,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
