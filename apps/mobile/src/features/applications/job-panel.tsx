import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { ZodError } from 'zod';

import { getJobQuoteStatusLabel, getJobStatusLabel } from '@casaticket/domain';
import type { Job, JobQuote } from '@casaticket/types';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import {
  acceptJobQuote,
  confirmJobVisit,
  createJobQuote,
  getJobByRequest,
  listJobQuotes,
  proposeJobVisit,
  recordJobDiagnosis,
  rejectJobQuote,
  rejectJobVisit,
  sendJobQuote,
} from '@/features/applications/jobs-api';
import { getUserFacingErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';

interface JobPanelProps {
  requestId: string;
  role: 'customer' | 'professional';
}

export function JobPanel({ requestId, role }: JobPanelProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const jobQuery = useQuery({
    queryKey: queryKeys.job(requestId),
    queryFn: () => getJobByRequest(requestId),
    enabled: requestId.length > 0,
  });
  const job = jobQuery.data ?? null;
  const quotesQuery = useQuery({
    queryKey: job ? queryKeys.jobQuotes(job.id) : ['job-quotes', requestId],
    queryFn: () => listJobQuotes(job?.id ?? ''),
    enabled: Boolean(job),
  });

  const refreshJob = (updatedJob?: Job) => {
    if (updatedJob) {
      queryClient.setQueryData(queryKeys.job(requestId), updatedJob);
    } else {
      void jobQuery.refetch();
    }

    if (job) {
      void quotesQuery.refetch();
    }
  };
  const visitMutation = useMutation({
    mutationFn: (values: { scheduledDate: string | null; scheduledTimeText: string; schedulingNotes: string | null }) =>
      proposeJobVisit(job?.id ?? '', values),
    onSuccess: (updatedJob) => refreshJob(updatedJob),
  });
  const confirmVisitMutation = useMutation({
    mutationFn: () => confirmJobVisit(job?.id ?? ''),
    onSuccess: (updatedJob) => refreshJob(updatedJob),
  });
  const rejectVisitMutation = useMutation({
    mutationFn: () => rejectJobVisit(job?.id ?? ''),
    onSuccess: (updatedJob) => refreshJob(updatedJob),
  });
  const diagnosisMutation = useMutation({
    mutationFn: (diagnosisText: string) => recordJobDiagnosis(job?.id ?? '', { diagnosisText }),
    onSuccess: (updatedJob) => refreshJob(updatedJob),
  });
  const quoteMutation = useMutation({
    mutationFn: (values: QuoteDraftState) =>
      createJobQuote(job?.id ?? '', {
        description: values.description,
        estimatedDurationText: values.estimatedDurationText || null,
        laborAmount: Number(values.laborAmount),
        materialsAmount: Number(values.materialsAmount),
        platformFeeAmount: Number(values.platformFeeAmount),
        validUntil: values.validUntil || null,
        visitAmount: Number(values.visitAmount),
      }),
    onSuccess: () => {
      if (job) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobQuotes(job.id) });
      }
    },
  });
  const sendQuoteMutation = useMutation({
    mutationFn: sendJobQuote,
    onSuccess: () => refreshJob(),
  });
  const acceptQuoteMutation = useMutation({
    mutationFn: acceptJobQuote,
    onSuccess: () => refreshJob(),
  });
  const rejectQuoteMutation = useMutation({
    mutationFn: ({ quoteId, rejectedReason }: { quoteId: string; rejectedReason: string | null }) =>
      rejectJobQuote(quoteId, { rejectedReason }),
    onSuccess: () => refreshJob(),
  });

  const quotes = quotesQuery.data ?? [];
  const latestQuote = quotes[0] ?? null;
  const currentSentQuote = quotes.find((quote) => quote.status === 'sent') ?? null;

  if (jobQuery.isPending) {
    return (
      <Card>
        <LoadingState message="Cargando coordinacion..." />
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

  return (
    <Card>
      <View style={styles.section}>
        <Text style={styles.title}>Trabajo seleccionado</Text>
        <Text style={styles.meta}>Estado: {getJobStatusLabel(job.status)}</Text>
        <VisitSummary job={job} />
        {job.diagnosisText ? (
          <View style={styles.box}>
            <Text style={styles.subtitle}>Diagnostico</Text>
            <Text style={styles.body}>{job.diagnosisText}</Text>
          </View>
        ) : null}
        {quotesQuery.isPending ? <LoadingState message="Cargando presupuestos..." /> : null}
        {latestQuote ? <QuoteSummary quote={latestQuote} /> : <EmptyState title="Sin presupuesto" description="Todavia no hay presupuesto formal." />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {role === 'professional' ? (
          <ProfessionalJobActions
            job={job}
            latestQuote={latestQuote}
            loading={
              visitMutation.isPending ||
              diagnosisMutation.isPending ||
              quoteMutation.isPending ||
              sendQuoteMutation.isPending
            }
            onCreateQuote={async (values) => {
              setError(null);

              try {
                await quoteMutation.mutateAsync(values);
              } catch (submissionError) {
                setError(formatSubmissionError(submissionError, 'No pudimos crear el presupuesto.'));
              }
            }}
            onProposeVisit={async (values) => {
              setError(null);

              try {
                await visitMutation.mutateAsync(values);
              } catch (submissionError) {
                setError(formatSubmissionError(submissionError, 'No pudimos proponer la visita.'));
              }
            }}
            onRecordDiagnosis={async (diagnosisText) => {
              setError(null);

              try {
                await diagnosisMutation.mutateAsync(diagnosisText);
              } catch (submissionError) {
                setError(formatSubmissionError(submissionError, 'No pudimos guardar el diagnostico.'));
              }
            }}
            onSendQuote={(quoteId) => void sendQuoteMutation.mutateAsync(quoteId).catch((submissionError) => {
              setError(formatSubmissionError(submissionError, 'No pudimos enviar el presupuesto.'));
            })}
          />
        ) : (
          <CustomerJobActions
            currentSentQuote={currentSentQuote}
            job={job}
            loading={
              confirmVisitMutation.isPending ||
              rejectVisitMutation.isPending ||
              acceptQuoteMutation.isPending ||
              rejectQuoteMutation.isPending
            }
            onAcceptQuote={(quoteId) => {
              Alert.alert(
                'Aceptar presupuesto',
                'Aceptar todavia no genera un pago en esta fase.',
                [
                  { style: 'cancel', text: 'Volver' },
                  {
                    onPress: () => void acceptQuoteMutation.mutateAsync(quoteId).catch((submissionError) => {
                      setError(formatSubmissionError(submissionError, 'No pudimos aceptar el presupuesto.'));
                    }),
                    text: 'Aceptar presupuesto',
                  },
                ],
              );
            }}
            onConfirmVisit={() => void confirmVisitMutation.mutateAsync().catch((submissionError) => {
              setError(formatSubmissionError(submissionError, 'No pudimos confirmar la visita.'));
            })}
            onRejectQuote={(quoteId, rejectedReason) => void rejectQuoteMutation
              .mutateAsync({ quoteId, rejectedReason })
              .catch((submissionError) => {
                setError(formatSubmissionError(submissionError, 'No pudimos rechazar el presupuesto.'));
              })}
            onRejectVisit={() => void rejectVisitMutation.mutateAsync().catch((submissionError) => {
              setError(formatSubmissionError(submissionError, 'No pudimos rechazar la visita.'));
            })}
          />
        )}
        {quotes.length > 1 ? <QuoteHistory quotes={quotes.slice(1)} /> : null}
      </View>
    </Card>
  );
}

interface QuoteDraftState {
  description: string;
  estimatedDurationText: string;
  laborAmount: string;
  materialsAmount: string;
  platformFeeAmount: string;
  validUntil: string;
  visitAmount: string;
}

function ProfessionalJobActions({
  job,
  latestQuote,
  loading,
  onCreateQuote,
  onProposeVisit,
  onRecordDiagnosis,
  onSendQuote,
}: {
  job: Job;
  latestQuote: JobQuote | null;
  loading: boolean;
  onCreateQuote: (values: QuoteDraftState) => Promise<void>;
  onProposeVisit: (values: { scheduledDate: string | null; scheduledTimeText: string; schedulingNotes: string | null }) => Promise<void>;
  onRecordDiagnosis: (diagnosisText: string) => Promise<void>;
  onSendQuote: (quoteId: string) => void;
}) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTimeText, setScheduledTimeText] = useState('');
  const [schedulingNotes, setSchedulingNotes] = useState('');
  const [diagnosisText, setDiagnosisText] = useState('');
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraftState>({
    description: '',
    estimatedDurationText: '',
    laborAmount: '',
    materialsAmount: '0',
    platformFeeAmount: '0',
    validUntil: '',
    visitAmount: '0',
  });
  const draftQuote = latestQuote?.status === 'draft' ? latestQuote : null;

  if (job.status === 'coordination_pending' || job.status === 'visit_proposed') {
    return (
      <View style={styles.form}>
        <Text style={styles.subtitle}>Proponer visita</Text>
        <TextInput onChangeText={setScheduledDate} placeholder="Fecha YYYY-MM-DD" style={styles.input} value={scheduledDate} />
        <TextInput onChangeText={setScheduledTimeText} placeholder="Horario" style={styles.input} value={scheduledTimeText} />
        <TextInput multiline onChangeText={setSchedulingNotes} placeholder="Notas de coordinacion" style={styles.input} value={schedulingNotes} />
        <Button
          disabled={loading || scheduledTimeText.trim().length === 0}
          onPress={() => void onProposeVisit({
            scheduledDate: scheduledDate.trim() || null,
            scheduledTimeText,
            schedulingNotes: schedulingNotes.trim() || null,
          })}
        >
          Proponer visita
        </Button>
      </View>
    );
  }

  if (job.status === 'visit_confirmed') {
    return (
      <View style={styles.form}>
        <Text style={styles.subtitle}>Registrar diagnostico</Text>
        <TextInput multiline onChangeText={setDiagnosisText} placeholder="Diagnostico, trabajo necesario, materiales y observaciones" style={styles.textarea} value={diagnosisText} />
        <Button disabled={loading || diagnosisText.trim().length < 20} onPress={() => void onRecordDiagnosis(diagnosisText)}>
          Registrar diagnostico
        </Button>
      </View>
    );
  }

  if (draftQuote) {
    return (
      <Button disabled={loading} onPress={() => onSendQuote(draftQuote.id)}>
        Enviar presupuesto
      </Button>
    );
  }

  if (job.status === 'quote_pending' || job.status === 'quote_rejected' || job.status === 'quote_sent') {
    return (
      <View style={styles.form}>
        <Text style={styles.subtitle}>{job.status === 'quote_sent' ? 'Crear nueva version' : 'Crear presupuesto'}</Text>
        <TextInput keyboardType="numeric" onChangeText={(value) => setQuoteDraft((current) => ({ ...current, laborAmount: value }))} placeholder="Mano de obra" style={styles.input} value={quoteDraft.laborAmount} />
        <TextInput keyboardType="numeric" onChangeText={(value) => setQuoteDraft((current) => ({ ...current, materialsAmount: value }))} placeholder="Materiales" style={styles.input} value={quoteDraft.materialsAmount} />
        <TextInput keyboardType="numeric" onChangeText={(value) => setQuoteDraft((current) => ({ ...current, visitAmount: value }))} placeholder="Visita" style={styles.input} value={quoteDraft.visitAmount} />
        <TextInput keyboardType="numeric" onChangeText={(value) => setQuoteDraft((current) => ({ ...current, platformFeeAmount: value }))} placeholder="Comision plataforma" style={styles.input} value={quoteDraft.platformFeeAmount} />
        <TextInput multiline onChangeText={(value) => setQuoteDraft((current) => ({ ...current, description: value }))} placeholder="Descripcion formal del presupuesto" style={styles.textarea} value={quoteDraft.description} />
        <TextInput onChangeText={(value) => setQuoteDraft((current) => ({ ...current, estimatedDurationText: value }))} placeholder="Duracion estimada" style={styles.input} value={quoteDraft.estimatedDurationText} />
        <TextInput onChangeText={(value) => setQuoteDraft((current) => ({ ...current, validUntil: value }))} placeholder="Valido hasta YYYY-MM-DD" style={styles.input} value={quoteDraft.validUntil} />
        <Button disabled={loading || quoteDraft.description.trim().length < 20 || quoteDraft.laborAmount.trim().length === 0} onPress={() => void onCreateQuote(quoteDraft)}>
          Crear presupuesto
        </Button>
      </View>
    );
  }

  return null;
}

function CustomerJobActions({
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
        <Text style={styles.subtitle}>Confirmar coordinacion</Text>
        <Button disabled={loading} onPress={onConfirmVisit}>Confirmar visita</Button>
        <Button disabled={loading} onPress={onRejectVisit} variant="secondary">Rechazar propuesta</Button>
      </View>
    );
  }

  if (currentSentQuote) {
    return (
      <View style={styles.form}>
        <Text style={styles.subtitle}>Responder presupuesto</Text>
        <Text style={styles.meta}>Aceptar todavia no genera un pago en esta fase.</Text>
        <Button disabled={loading} onPress={() => onAcceptQuote(currentSentQuote.id)}>Aceptar presupuesto</Button>
        <TextInput multiline onChangeText={setRejectedReason} placeholder="Motivo opcional del rechazo" style={styles.input} value={rejectedReason} />
        <Button disabled={loading} onPress={() => onRejectQuote(currentSentQuote.id, rejectedReason.trim() || null)} variant="secondary">Rechazar</Button>
      </View>
    );
  }

  return null;
}

function VisitSummary({ job }: { job: Job }) {
  return (
    <View style={styles.box}>
      <Text style={styles.subtitle}>Coordinacion vigente</Text>
      <Text style={styles.meta}>Fecha: {job.scheduledDate ?? 'Sin propuesta'}</Text>
      <Text style={styles.meta}>Horario: {job.scheduledTimeText ?? 'Sin horario'}</Text>
      <Text style={styles.meta}>Notas: {job.schedulingNotes ?? 'Sin notas'}</Text>
    </View>
  );
}

function QuoteSummary({ quote }: { quote: JobQuote }) {
  const rows = useMemo(
    () => [
      ['Mano de obra', quote.laborAmount],
      ['Materiales', quote.materialsAmount],
      ['Visita', quote.visitAmount],
      ['Plataforma', quote.platformFeeAmount],
    ],
    [quote],
  );

  return (
    <View style={styles.box}>
      <Text style={styles.subtitle}>Presupuesto v{quote.version} · {getJobQuoteStatusLabel(quote.status)}</Text>
      <Text style={styles.body}>{quote.description}</Text>
      {rows.map(([label, amount]) => (
        <Text key={label} style={styles.meta}>{label}: {formatPrice(Number(amount))}</Text>
      ))}
      <Text style={styles.total}>Total: {formatPrice(quote.totalAmount)}</Text>
      <Text style={styles.meta}>Vigencia: {quote.validUntil ?? 'Sin vencimiento'}</Text>
      <Text style={styles.meta}>Duracion: {quote.estimatedDurationText ?? 'Sin estimacion'}</Text>
      {quote.rejectedReason ? <Text style={styles.meta}>Motivo rechazo: {quote.rejectedReason}</Text> : null}
    </View>
  );
}

function QuoteHistory({ quotes }: { quotes: JobQuote[] }) {
  return (
    <View style={styles.box}>
      <Text style={styles.subtitle}>Historial de versiones</Text>
      {quotes.map((quote) => (
        <Text key={quote.id} style={styles.meta}>
          v{quote.version}: {getJobQuoteStatusLabel(quote.status)} · {formatPrice(quote.totalAmount)}
        </Text>
      ))}
    </View>
  );
}

function formatSubmissionError(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  return getUserFacingErrorMessage(error, fallback);
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    currency: 'ARS',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  title: {
    color: '#1d1811',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#1d1811',
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: '#675a49',
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    color: '#1d1811',
    fontSize: 14,
    lineHeight: 20,
  },
  total: {
    color: '#1d1811',
    fontSize: 16,
    fontWeight: '800',
  },
  box: {
    gap: 6,
    borderRadius: 14,
    backgroundColor: '#f3eadc',
    padding: 12,
  },
  form: {
    gap: 10,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dccbb1',
    backgroundColor: '#ffffff',
    color: '#1d1811',
    fontSize: 15,
    padding: 12,
  },
  textarea: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dccbb1',
    backgroundColor: '#ffffff',
    color: '#1d1811',
    fontSize: 15,
    padding: 12,
    textAlignVertical: 'top',
  },
  error: {
    color: '#a33b2f',
    fontSize: 13,
    lineHeight: 19,
  },
});
