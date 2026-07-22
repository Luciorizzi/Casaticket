import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ZodError } from 'zod';

import { getJobQuoteStatusLabel } from '@casaticket/domain';
import type { Job, JobQuote } from '@casaticket/types';
import type {
  CreateJobQuoteInput,
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
import {
  CollapsibleSection,
  InfoRow,
  ProcessTimeline,
  SectionCard,
  StatusHeader,
} from '@/components/ui/workflow';
import {
  createProfessionalJobQuote,
  getProfessionalJobById,
  jobQuotesQueryKey,
  listJobQuotes,
  professionalJobQueryKey,
  proposeProfessionalJobVisit,
  recordProfessionalJobDiagnosis,
  sendProfessionalJobQuote,
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

const timelineSteps = [
  { key: 'selected', label: 'Profesional' },
  { key: 'visit', label: 'Visita' },
  { key: 'diagnosis', label: 'Diagnóstico' },
  { key: 'quote', label: 'Presupuesto' },
  { key: 'accepted', label: 'Aceptado' },
];

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
    case 'quote_accepted':
      return 'accepted';
    case 'cancelled':
      return 'selected';
  }
}

function getProfessionalNextAction(status: Job['status']): string {
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
      return 'Esperar respuesta del cliente';
    case 'quote_rejected':
      return 'Crear nueva versión';
    case 'quote_accepted':
      return 'Presupuesto aceptado';
    case 'cancelled':
      return 'Trabajo cancelado';
  }
}

function shortText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}…`;
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
  const latestQuote = quotes[0] ?? null;
  const draftQuote = quotes.find((quote) => quote.status === 'draft') ?? null;

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
      <JobSummaryCard job={job} />
      {quotesQuery.isPending ? <LoadingState message="Cargando presupuestos..." /> : null}
      {latestQuote ? <QuoteSummaryCard quote={latestQuote} /> : null}
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <JobStatusActions
        draftQuote={draftQuote}
        isPending={
          proposeVisitMutation.isPending ||
          diagnosisMutation.isPending ||
          createQuoteMutation.isPending ||
          sendQuoteMutation.isPending
        }
        job={job}
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

function JobSummaryCard({ job }: { job: Job }) {
  return (
    <>
      <SectionCard title="Trabajo seleccionado">
        <StatusHeader
          actionLabel={getProfessionalNextAction(job.status)}
          description="Avanzá el trabajo según el estado actual."
          status={getMobileJobStatusLabel(job.status)}
          tone={job.status === 'quote_accepted' ? 'success' : 'accent'}
        />
        <ProcessTimeline currentStep={getTimelineStep(job.status)} steps={timelineSteps} />
      </SectionCard>
      <CollapsibleSection
        preview={`${job.scheduledDate ?? 'Sin fecha'} · ${job.scheduledTimeText ?? 'Sin horario'}`}
        title="Coordinación"
      >
        <InfoRow label="Fecha propuesta" value={job.scheduledDate ?? 'Sin propuesta'} />
        <InfoRow label="Horario" value={job.scheduledTimeText ?? 'Sin horario'} />
        <InfoRow label="Notas" value={job.schedulingNotes ?? 'Sin notas'} />
      </CollapsibleSection>
      {job.diagnosisText ? (
        <CollapsibleSection
          preview={shortText(job.diagnosisText, 90)}
          title="Diagnóstico"
        >
          <InfoRow label="Problema detectado" value={job.diagnosisText} />
          <InfoRow label="Trabajo recomendado" value={job.recommendedWorkText ?? 'Sin recomendación'} />
          <InfoRow label="Materiales" value={job.materialsNotes ?? 'Sin observaciones'} />
          {job.diagnosisNotes ? <InfoRow label="Notas internas" value={job.diagnosisNotes} /> : null}
        </CollapsibleSection>
      ) : null}
    </>
  );
}

function JobStatusActions({
  draftQuote,
  isPending,
  job,
  onCreateQuote,
  onProposeVisit,
  onRecordDiagnosis,
  onSendQuote,
}: {
  draftQuote: JobQuote | null;
  isPending: boolean;
  job: Job;
  onCreateQuote: (values: CreateJobQuoteInput) => Promise<void>;
  onProposeVisit: (values: ProposeJobVisitInput) => Promise<void>;
  onRecordDiagnosis: (values: RecordJobDiagnosisInput) => Promise<void>;
  onSendQuote: (quoteId: string) => Promise<void>;
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

  if (job.status === 'quote_accepted') {
    return <ReadOnlyStatus title="Presupuesto aceptado" message="El cliente aceptó el presupuesto." />;
  }

  if (job.status === 'quote_rejected') {
    return <QuoteForm loading={isPending} onSubmit={onCreateQuote} title="Crear nueva versión" />;
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

function QuoteSummaryCard({ quote }: { quote: JobQuote }) {
  const rows = useMemo(
    () => [
      { label: 'Mano de obra', amount: quote.laborAmount },
      { label: 'Materiales aproximados', amount: quote.materialsAmount },
      { label: 'Visita', amount: quote.visitAmount },
      { label: 'Comisión CasaTicket (5%)', amount: quote.platformFeeAmount },
    ],
    [quote],
  );

  return (
    <CollapsibleSection
      initiallyExpanded={quote.status === 'draft'}
      preview={`v${quote.version} · ${getJobQuoteStatusLabel(quote.status)} · ${formatMoney(quote.totalAmount)}`}
      title="Presupuesto"
    >
      <Text numberOfLines={2} style={styles.body}>{quote.description}</Text>
      {rows.map((row) => (
        <InfoRow key={row.label} label={row.label} value={formatMoney(row.amount)} />
      ))}
      <Text style={styles.meta}>Materiales no incluidos en el total final.</Text>
      <InfoRow label="Total del servicio" value={formatMoney(quote.totalAmount)} />
      <InfoRow label="Estado" value={getJobQuoteStatusLabel(quote.status)} />
      <InfoRow label="Vigencia" value={quote.validUntil ?? 'Sin vencimiento'} />
      <InfoRow label="Duración" value={quote.estimatedDurationText ?? 'Sin estimación'} />
      {quote.rejectedReason ? <InfoRow label="Motivo rechazo" value={quote.rejectedReason} /> : null}
    </CollapsibleSection>
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
