import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ZodError } from 'zod';

import { getJobQuoteStatusLabel } from '@casaticket/domain';
import type { Job, JobQuote } from '@casaticket/types';

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
  PrimaryActionBar,
  ProcessTimeline,
  ScreenHeader,
  SectionCard,
  StatusHeader,
} from '@/components/ui/workflow';
import {
  acceptCustomerJobQuote,
  confirmCustomerJobVisit,
  customerJobByIdQueryKey,
  customerJobQueryKey,
  getCustomerJobById,
  getCustomerJobByRequest,
  jobQuotesQueryKey,
  listJobQuotes,
  rejectCustomerJobQuote,
  rejectCustomerJobVisit,
} from '@/features/jobs/api';
import { getMobileJobStatusLabel } from '@/features/jobs/status-labels';
import { getUserFacingErrorMessage, logDevelopmentSupabaseError } from '@/lib/errors';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    currency: 'ARS',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
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

function getCustomerNextAction(job: Job, sentQuote: JobQuote | null): string {
  if (job.status === 'visit_proposed') {
    return 'Confirmar visita';
  }

  if (sentQuote) {
    return 'Revisar presupuesto';
  }

  if (job.status === 'quote_accepted') {
    return 'Presupuesto aceptado';
  }

  return 'Seguir coordinación';
}

function getCustomerJobDescription(job: Job): string {
  switch (job.status) {
    case 'visit_proposed':
      return 'El profesional propuso una visita. Confirmá si te sirve.';
    case 'visit_confirmed':
    case 'diagnosis_pending':
      return 'La visita está confirmada. El profesional debe cargar el diagnóstico.';
    case 'quote_pending':
      return 'El diagnóstico ya está listo. Falta recibir el presupuesto.';
    case 'quote_sent':
      return 'Tenés un presupuesto listo para revisar.';
    case 'quote_rejected':
      return 'El presupuesto fue rechazado. Esperá una nueva versión.';
    case 'quote_accepted':
      return 'Aceptaste el presupuesto.';
    case 'cancelled':
      return 'Este trabajo fue cancelado.';
    case 'coordination_pending':
      return 'Usá el chat para coordinar la visita.';
  }
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getRelevantDate(job: Job): string {
  if (job.scheduledDate) {
    return `${job.scheduledDate}${job.scheduledTimeText ? ` · ${job.scheduledTimeText}` : ''}`;
  }

  return `Actualizado: ${formatDateTime(job.updatedAt)}`;
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

  return (
    <SectionCard title="Proceso del trabajo">
      <StatusHeader
        actionLabel={getCustomerNextAction(job, sentQuote)}
        description={getCustomerJobDescription(job)}
        status={getMobileJobStatusLabel(job.status)}
        tone={job.status === 'quote_accepted' ? 'success' : 'accent'}
      />
      <ProcessTimeline currentStep={getTimelineStep(job.status)} steps={timelineSteps} />
      <InfoRow label="Fecha relevante" value={getRelevantDate(job)} />
      <InfoRow
        label="Total"
        value={visibleQuote ? formatMoney(visibleQuote.totalAmount) : 'Sin presupuesto todavía'}
      />
      {quotesQuery.error ? <ErrorState message="No pudimos cargar el presupuesto." /> : null}
      <PrimaryActionBar
        primaryAction={
          job.id ? (
            <Button
              onPress={() =>
                router.push({
                  pathname: '/(customer)/jobs/[jobId]',
                  params: { jobId: job.id },
                } as Href)
              }
            >
              Ver progreso del trabajo
            </Button>
          ) : (
            <Text style={styles.meta}>El trabajo todavía no está disponible.</Text>
          )
        }
      />
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

  const updateJobStatus = (jobStatus: Job['status']) => {
    if (!job) {
      return;
    }

    queryClient.setQueryData(customerJobQueryKey(requestId), { ...job, status: jobStatus });
  };
  const refreshQuotes = () => {
    if (job) {
      void queryClient.invalidateQueries({ queryKey: jobQuotesQueryKey(job.id) });
    }
  };

  const confirmVisitMutation = useMutation({
    mutationFn: () => confirmCustomerJobVisit(job?.id ?? ''),
    onSuccess: (updatedJob) => {
      queryClient.setQueryData(customerJobQueryKey(requestId), updatedJob);
    },
  });
  const rejectVisitMutation = useMutation({
    mutationFn: () => rejectCustomerJobVisit(job?.id ?? ''),
    onSuccess: (updatedJob) => {
      queryClient.setQueryData(customerJobQueryKey(requestId), updatedJob);
    },
  });
  const acceptQuoteMutation = useMutation({
    mutationFn: acceptCustomerJobQuote,
    onSuccess: (result) => {
      updateJobStatus(result.jobStatus);
      refreshQuotes();
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
  const latestQuote = quotes[0] ?? null;
  const sentQuote = quotes.find((quote) => quote.status === 'sent') ?? null;
  const loading =
    confirmVisitMutation.isPending ||
    rejectVisitMutation.isPending ||
    acceptQuoteMutation.isPending ||
    rejectQuoteMutation.isPending;

  return (
    <View style={styles.stack}>
      <SectionCard title="Trabajo seleccionado">
        <StatusHeader
          actionLabel={getCustomerNextAction(job, sentQuote)}
          description={getCustomerJobDescription(job)}
          status={getMobileJobStatusLabel(job.status)}
          tone={job.status === 'quote_accepted' ? 'success' : 'accent'}
        />
        <ProcessTimeline currentStep={getTimelineStep(job.status)} steps={timelineSteps} />
      </SectionCard>
      <VisitSummary job={job} />
      {job.diagnosisText ? <DiagnosisSummary job={job} /> : null}
        {quotesQuery.isPending ? <LoadingState message="Cargando presupuestos..." /> : null}
        {latestQuote ? (
          <QuoteSummary quote={latestQuote} />
        ) : (
          <EmptyState description="El profesional todavía no envió un presupuesto formal." title="Sin presupuesto" />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <CustomerActions
          currentSentQuote={sentQuote}
          job={job}
          loading={loading}
          onAcceptQuote={(quoteId) => {
            setError(null);
            Alert.alert('Aceptar presupuesto', 'Aceptar todavía no genera un pago en esta fase.', [
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
        />
        {quotes.length > 1 ? <QuoteHistory quotes={quotes.slice(1)} /> : null}
    </View>
  );
}

function CustomerActions({
  currentSentQuote,
  job,
  loading,
  onAcceptQuote,
  onConfirmVisit,
  onRejectQuote,
  onRejectVisit,
}: {
  currentSentQuote: JobQuote | null;
  job: Job;
  loading: boolean;
  onAcceptQuote: (quoteId: string) => void;
  onConfirmVisit: () => void;
  onRejectQuote: (quoteId: string, rejectedReason: string | null) => void;
  onRejectVisit: () => void;
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
        <Text style={styles.meta}>Aceptar todavía no genera un pago en esta fase.</Text>
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

  return null;
}

function VisitSummary({ job }: { job: Job }) {
  return (
    <CollapsibleSection
      preview={`${job.scheduledDate ?? 'Sin fecha'} · ${job.scheduledTimeText ?? 'Sin horario'}`}
      title="Coordinación"
    >
      <InfoRow label="Fecha" value={job.scheduledDate ?? 'Sin propuesta'} />
      <InfoRow label="Horario" value={job.scheduledTimeText ?? 'Sin horario'} />
      <InfoRow label="Notas" value={job.schedulingNotes ?? 'Sin notas'} />
    </CollapsibleSection>
  );
}

function DiagnosisSummary({ job }: { job: Job }) {
  return (
    <CollapsibleSection
      preview={shortText(job.diagnosisText ?? 'Diagnóstico pendiente', 90)}
      title="Diagnóstico"
    >
      <InfoRow label="Problema detectado" value={job.diagnosisText ?? 'Sin diagnóstico'} />
      <InfoRow label="Trabajo recomendado" value={job.recommendedWorkText ?? 'Sin recomendación'} />
      <InfoRow label="Materiales" value={job.materialsNotes ?? 'Sin observaciones'} />
    </CollapsibleSection>
  );
}

function QuoteSummary({ quote }: { quote: JobQuote }) {
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
      initiallyExpanded={quote.status === 'sent'}
      preview={`v${quote.version} · ${getJobQuoteStatusLabel(quote.status)} · ${formatMoney(quote.totalAmount)}`}
      title="Presupuesto"
    >
      <Text numberOfLines={2} style={styles.body}>{quote.description}</Text>
      {rows.map((row) => (
        <InfoRow key={row.label} label={row.label} value={formatMoney(row.amount)} />
      ))}
      <Text style={styles.meta}>Materiales no incluidos en el total final.</Text>
      <InfoRow label="Total final" value={formatMoney(quote.totalAmount)} />
      <InfoRow label="Estado" value={getJobQuoteStatusLabel(quote.status)} />
      <InfoRow label="Vigencia" value={quote.validUntil ?? 'Sin vencimiento'} />
      <InfoRow label="Duración" value={quote.estimatedDurationText ?? 'Sin estimación'} />
      {quote.rejectedReason ? <InfoRow label="Motivo rechazo" value={quote.rejectedReason} /> : null}
    </CollapsibleSection>
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
