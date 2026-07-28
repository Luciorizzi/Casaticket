import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
  getProfessionalJobById,
  jobPaymentQueryKey,
  jobQuotesQueryKey,
  listJobQuotes,
  professionalJobQueryKey,
} from '@/features/jobs/api';
import type { ProfessionalJobStage } from '@/features/jobs/professional-job-detail-screen';
import { getMobileJobStatusLabel } from '@/features/jobs/status-labels';

const stageTitles: Record<ProfessionalJobStage, string> = {
  completion: 'Finalización', diagnosis: 'Diagnóstico', execution: 'Ejecución', payment: 'Pago protegido',
  professional: 'Profesional seleccionado', quote: 'Presupuesto', visit: 'Visita',
};

function value(value: string | number | null | undefined, fallback = 'Todavía sin información'): string {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

export function ProfessionalJobStageScreen({ jobId, stage }: { jobId: string; stage: ProfessionalJobStage }) {
  const jobQuery = useQuery({ enabled: Boolean(jobId), queryFn: () => getProfessionalJobById(jobId), queryKey: professionalJobQueryKey(jobId) });
  const quotesQuery = useQuery({ enabled: Boolean(jobId), queryFn: () => listJobQuotes(jobId), queryKey: jobQuotesQueryKey(jobId) });
  const paymentQuery = useQuery({ enabled: Boolean(jobId), queryFn: () => getJobPayment(jobId), queryKey: jobPaymentQueryKey(jobId) });

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(`/(professional)/jobs/${jobId}`);
  };

  if (jobQuery.isPending) return <Screen title={stageTitles[stage]}><LoadingState message="Cargando etapa..." /></Screen>;
  if (jobQuery.error || !jobQuery.data) return <Screen title={stageTitles[stage]}><ErrorState message="No pudimos cargar esta etapa." /></Screen>;

  const job = jobQuery.data;
  const quotes = quotesQuery.data ?? [];
  const payment = paymentQuery.data ?? null;

  return (
    <Screen subtitle={`Estado del trabajo: ${getMobileJobStatusLabel(job.status)}`} title={stageTitles[stage]}>
      <Pressable accessibilityLabel="Volver a gestionar trabajo" accessibilityRole="button" onPress={handleBack} style={styles.backButton}>
        <Ionicons color={colors.accent} name="chevron-back" size={22} />
        <Text style={styles.backLabel}>Volver</Text>
      </Pressable>
      <Card>
        <View style={styles.stack}>
          {stage === 'professional' ? <><Detail label="Professional ID" value={job.professionalId} /><Detail label="Postulación seleccionada" value={job.selectedApplicationId} /></> : null}
          {stage === 'visit' ? <><Detail label="Fecha" value={value(job.scheduledDate)} /><Detail label="Horario" value={value(job.scheduledTimeText)} /><Detail label="Notas" value={value(job.schedulingNotes)} /></> : null}
          {stage === 'diagnosis' ? <><Detail label="Diagnóstico" value={value(job.diagnosisText)} /><Detail label="Trabajo recomendado" value={value(job.recommendedWorkText)} /><Detail label="Materiales" value={value(job.materialsNotes)} /></> : null}
          {stage === 'quote' ? (quotes.length ? quotes.map((quote) => <Detail key={quote.id} label={`Versión ${quote.version} · ${getJobQuoteStatusLabel(quote.status)}`} value={`${quote.currency} ${quote.totalAmount}`} />) : <Detail label="Presupuesto" value="Todavía no generado" />) : null}
          {stage === 'payment' ? <><Detail label="Estado" value={payment ? getPaymentStatusLabel(payment.status) : 'Todavía sin pago'} /><Detail label="Payment ID" value={value(payment?.id)} /></> : null}
          {stage === 'execution' ? <><Detail label="Estado" value={getMobileJobStatusLabel(job.status)} /><Detail label="Inicio" value={value(job.startedAt)} /></> : null}
          {stage === 'completion' ? <><Detail label="Resumen" value={value(job.completionSummary)} /><Detail label="Notas finales" value={value(job.finalNotes)} /><Detail label="Disputa" value={value(job.disputeReason, 'Sin disputa')} /></> : null}
        </View>
      </Card>
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
  stack: { gap: 14 },
  value: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
