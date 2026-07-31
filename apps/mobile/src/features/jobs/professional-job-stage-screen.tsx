import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getJobQuoteStatusLabel, getPaymentStatusLabel } from '@casaticket/domain';

import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Screen } from '@/components/ui/screen';
import { colors } from '@/components/ui/theme';
import { AttachmentGallerySection } from '@/features/attachments/components';
import {
  getJobPayment,
  getJobLocation,
  getProfessionalJobById,
  jobPaymentQueryKey,
  jobLocationQueryKey,
  jobQuotesQueryKey,
  listJobQuotes,
  professionalJobQueryKey,
} from '@/features/jobs/api';
import type { ProfessionalJobStage } from '@/features/jobs/professional-job-detail-screen';
import { goBackToProfessionalJob } from '@/features/jobs/professional-job-navigation';
import { getMobileJobStatusLabel } from '@/features/jobs/status-labels';
import { formatLocation } from '@/features/location/location';

const stageTitles: Record<ProfessionalJobStage, string> = {
  completion: 'Finalización', diagnosis: 'Diagnóstico', execution: 'Ejecución', payment: 'Pago protegido',
  quote: 'Presupuesto', visit: 'Visita',
};

function value(value: string | number | null | undefined, fallback = 'Todavía sin información'): string {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function formatDate(value: string | null, fallback: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string | null, fallback: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

function formatMoney(value: number | null, currency = 'ARS'): string {
  if (value === null) return 'No informado';
  return new Intl.NumberFormat('es-AR', { currency, maximumFractionDigits: 0, style: 'currency' }).format(value);
}

function getExecutionNextStep(status: string): string {
  if (status === 'in_progress') return 'Completá el trabajo y registrá el resultado cuando esté listo.';
  if (status === 'review_pending' || status === 'completion_pending') return 'Esperando la confirmación del cliente.';
  if (status === 'completed') return 'El trabajo fue confirmado y el flujo está finalizado.';
  if (status === 'disputed') return 'Revisá el problema reportado y seguí el proceso de resolución.';
  return 'La ejecución estará disponible cuando se completen las etapas anteriores.';
}

export function ProfessionalJobStageScreen({ jobId, stage }: { jobId: string; stage: ProfessionalJobStage }) {
  const jobQuery = useQuery({ enabled: Boolean(jobId), queryFn: () => getProfessionalJobById(jobId), queryKey: professionalJobQueryKey(jobId) });
  const quotesQuery = useQuery({ enabled: Boolean(jobId), queryFn: () => listJobQuotes(jobId), queryKey: jobQuotesQueryKey(jobId) });
  const paymentQuery = useQuery({ enabled: Boolean(jobId), queryFn: () => getJobPayment(jobId), queryKey: jobPaymentQueryKey(jobId) });
  const locationQuery = useQuery({ enabled: Boolean(jobId), queryFn: () => getJobLocation(jobId), queryKey: jobLocationQueryKey(jobId) });

  if (jobQuery.isPending) return <Screen title={stageTitles[stage]}><LoadingState message="Cargando etapa..." /></Screen>;
  if (jobQuery.error || !jobQuery.data) return <Screen title={stageTitles[stage]}><ErrorState message="No pudimos cargar esta etapa." /></Screen>;

  const job = jobQuery.data;
  const quotes = quotesQuery.data ?? [];
  const payment = paymentQuery.data ?? null;

  return (
    <Screen subtitle={`Estado del trabajo: ${getMobileJobStatusLabel(job.status)}`} title={stageTitles[stage]}>
      <Pressable accessibilityLabel="Volver a gestionar trabajo" accessibilityRole="button" onPress={() => goBackToProfessionalJob(jobId)} style={styles.backButton}>
        <Ionicons color={colors.accent} name="chevron-back" size={22} />
        <Text style={styles.backLabel}>Volver</Text>
      </Pressable>
      <Card>
        <View style={styles.stack}>
          {stage === 'visit' ? <><Detail label="Fecha" value={formatDate(job.scheduledDate, 'Pendiente de definir')} /><Detail label="Horario" value={value(job.scheduledTimeText, 'Pendiente de definir')} /><Detail label="Dirección" value={locationQuery.data ? `${locationQuery.data.addressText} · ${formatLocation(locationQuery.data.city, locationQuery.data.province)}` : 'Cargando ubicación...'} /><Detail label="Notas" value={value(job.schedulingNotes, 'Sin observaciones')} /></> : null}
          {stage === 'diagnosis' ? <><Detail label="Diagnóstico" value={value(job.diagnosisText)} /><Detail label="Trabajo recomendado" value={value(job.recommendedWorkText)} /><Detail label="Materiales" value={value(job.materialsNotes)} /></> : null}
          {stage === 'quote' ? (quotes.length ? quotes.map((quote) => <Detail key={quote.id} label={`Versión ${quote.version} · ${getJobQuoteStatusLabel(quote.status)}`} value={formatMoney(quote.totalAmount, quote.currency)} />) : <Detail label="Presupuesto" value="Todavía no generado" />) : null}
          {stage === 'payment' ? <Detail label="Estado" value={payment ? getPaymentStatusLabel(payment.status) : 'Todavía sin pago'} /> : null}
          {stage === 'execution' ? <><Detail label="Estado actual" value={getMobileJobStatusLabel(job.status)} /><Detail label="Fecha de inicio" value={formatDateTime(job.startedAt, 'No se registró una fecha de inicio')} /></> : null}
          {stage === 'completion' ? <><Detail label="Resumen" value={value(job.completionSummary)} /><Detail label="Notas finales" value={value(job.finalNotes)} /><Detail label="Disputa" value={value(job.disputeReason, 'Sin disputa')} /></> : null}
        </View>
      </Card>
      {stage === 'execution' ? (
        <>
          <Card><View style={styles.stack}><Text style={styles.sectionTitle}>Trabajo realizado</Text><Detail label="Resumen" value={value(job.completionSummary, 'Aún no se registró el trabajo realizado')} /><Detail label="Observaciones finales" value={value(job.finalNotes, 'Sin observaciones')} /><Detail label="Materiales utilizados" value={value(job.finalMaterialsNotes, 'Sin materiales registrados')} /><Detail label="Importe final de materiales" value={formatMoney(job.finalMaterialsAmount)} /></View></Card>
          <Card><View style={styles.stack}><Text style={styles.sectionTitle}>Evidencias</Text><AttachmentGallerySection jobId={job.id} title="Fotos de ejecución y finalización" type="completion_evidence" /></View></Card>
          <Card><View style={styles.stack}><Text style={styles.sectionTitle}>Estado final</Text><Detail label="Situación" value={getMobileJobStatusLabel(job.status)} /><Detail label="Siguiente paso" value={getExecutionNextStep(job.status)} /></View></Card>
        </>
      ) : null}
      {stage === 'diagnosis' ? <Card><AttachmentGallerySection jobId={job.id} title="Evidencias" type="diagnosis_evidence" /></Card> : null}
      {stage === 'completion' ? <Card><AttachmentGallerySection jobId={job.id} title="Evidencias" type="completion_evidence" /></Card> : null}
    </Screen>
  );
}

function Detail({ label, value: detailValue }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{detailValue}</Text></View>;
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', minHeight: 44, minWidth: 44, paddingRight: 8 },
  backLabel: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  detail: { gap: 3 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  stack: { gap: 14 },
  value: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
