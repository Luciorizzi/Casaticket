import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getApplicationStatusLabel, getAvailabilityLabel } from '@casaticket/domain';
import type { CustomerRequestApplication } from '@casaticket/types';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { colors } from '@/components/ui/theme';
import { AttachmentGallery } from '@/features/attachments/components';
import { listAttachments } from '@/features/attachments/api';
import {
  getPublicProfessionalProfile,
  listProfessionalPortfolio,
  listPublicProfessionalReviews,
  type ProfessionalPortfolioItem,
} from '@/features/professional/public-profile-api';

interface PublicProfessionalProfileScreenProps {
  application?: CustomerRequestApplication | null;
  canSelect?: boolean;
  onOpenConversation?: (() => void) | undefined;
  onBack?: (() => void) | undefined;
  onSelect?: (() => void) | undefined;
  professionalId: string;
  title?: string;
}

function verificationPresentation(status: 'pending' | 'verified' | 'rejected') {
  switch (status) {
    case 'verified': return { label: 'Identidad verificada', tone: 'success' as const };
    case 'pending': return { label: 'Verificación pendiente', tone: 'warning' as const };
    case 'rejected': return { label: 'Verificación rechazada', tone: 'neutral' as const };
  }
}

export function PublicProfessionalProfileScreen({
  application = null,
  canSelect = false,
  onOpenConversation,
  onBack,
  onSelect,
  professionalId,
  title = 'Perfil profesional',
}: PublicProfessionalProfileScreenProps) {
  const profileQuery = useQuery({
    enabled: professionalId.length > 0,
    queryFn: () => getPublicProfessionalProfile(professionalId),
    queryKey: ['public-professional-profile', professionalId],
  });
  const portfolioQuery = useQuery({
    enabled: professionalId.length > 0,
    queryFn: () => listProfessionalPortfolio(professionalId),
    queryKey: ['professional-portfolio', professionalId],
  });
  const reviewsQuery = useQuery({
    enabled: professionalId.length > 0,
    queryFn: () => listPublicProfessionalReviews(professionalId),
    queryKey: ['public-professional-reviews', professionalId],
  });

  if (profileQuery.isPending) return <Screen title={title}><LoadingState message="Cargando perfil profesional..." /></Screen>;
  if (profileQuery.error || !profileQuery.data) return <Screen title={title}><ErrorState message="No pudimos abrir este perfil profesional." onRetry={() => void profileQuery.refetch()} /></Screen>;

  const profile = profileQuery.data;
  const verification = verificationPresentation(profile.verificationStatus);
  return (
    <Screen title={title}>
      {application ? (
        <Card>
          <Text style={styles.sectionTitle}>Propuesta para tu solicitud</Text>
          <StatusBadge value={getApplicationStatusLabel(application.status)} />
          <Text style={styles.body}>{application.message}</Text>
          <Text style={styles.meta}>Postulada: {new Date(application.createdAt).toLocaleDateString('es-AR')}</Text>
          {application.visitPrice !== null ? <Text style={styles.meta}>Visita: ${application.visitPrice.toLocaleString('es-AR')}</Text> : null}
          {application.estimatedPrice !== null ? <Text style={styles.meta}>Estimado: ${application.estimatedPrice.toLocaleString('es-AR')}</Text> : null}
          <View style={styles.actions}>
            {onOpenConversation ? <Button onPress={onOpenConversation} variant="secondary">Abrir conversación</Button> : null}
            {canSelect && onSelect ? <Button onPress={onSelect}>Seleccionar profesional</Button> : null}
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.header}>
          <Avatar name={`${profile.firstName} ${profile.lastName}`} size={76} uri={profile.avatarUrl} />
          <View style={styles.headerCopy}>
            <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>
            <Text style={styles.meta}>{profile.baseCity}</Text>
            <StatusBadge tone={verification.tone} value={verification.label} />
          </View>
        </View>
        <View style={styles.reputation}>
          <Text style={styles.reputationValue}>{profile.averageRating === null ? '—' : `★ ${profile.averageRating.toFixed(1)}`}</Text>
          <Text style={styles.meta}>{profile.reviewsCount} reseñas · {profile.completedJobsCount} trabajos completados</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Acerca del profesional</Text>
        <Text style={styles.body}>{profile.bio ?? 'Este profesional todavía no agregó una presentación.'}</Text>
        <Text style={styles.meta}>{profile.yearsExperience ?? 0} años de experiencia</Text>
        <Text style={styles.meta}>Trabaja hasta {profile.serviceRadiusKm} km desde {profile.baseCity}</Text>
        <Text style={styles.meta}>Disponibilidad: {getAvailabilityLabel(profile.availabilityStatus)}</Text>
        <View style={styles.chips}>{profile.categoryNames.map((category) => <Text key={category} style={styles.chip}>{category}</Text>)}</View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Portfolio</Text>
        {portfolioQuery.isPending ? <Text style={styles.meta}>Cargando trabajos...</Text> : null}
        {portfolioQuery.data?.length === 0 ? <Text style={styles.meta}>Este profesional todavía no agregó trabajos a su portfolio.</Text> : null}
        <ScrollView contentContainerStyle={styles.portfolio} horizontal showsHorizontalScrollIndicator={false}>
          {(portfolioQuery.data ?? []).filter((item) => item.isVisible).map((item) => <PortfolioCard item={item} key={item.id} />)}
        </ScrollView>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Reseñas</Text>
        {reviewsQuery.data?.length === 0 ? <Text style={styles.meta}>Este profesional todavía no tiene calificaciones.</Text> : null}
        {(reviewsQuery.data ?? []).map((review) => (
          <View key={review.id} style={styles.review}>
            <Text style={styles.reviewTitle}>{'★'.repeat(review.rating)} · {review.customerName}</Text>
            {review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}
            <Text style={styles.meta}>{new Date(review.createdAt).toLocaleDateString('es-AR')}</Text>
          </View>
        ))}
      </Card>
      <Button onPress={onBack ?? (() => router.back())} variant="secondary">Volver</Button>
    </Screen>
  );
}

function PortfolioCard({ item }: { item: ProfessionalPortfolioItem }) {
  const attachmentsQuery = useQuery({
    queryFn: () => listAttachments({ portfolioItemId: item.id }, 'portfolio'),
    queryKey: ['attachments', 'portfolio', item.id],
  });
  return <View style={styles.portfolioCard}>
    {attachmentsQuery.data ? <AttachmentGallery attachments={attachmentsQuery.data} emptyLabel="Sin imágenes" /> : null}
    <Text style={styles.portfolioTitle}>{item.title}</Text>
    <Text numberOfLines={3} style={styles.body}>{item.description}</Text>
    {item.categoryName ? <Text style={styles.meta}>{item.categoryName}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  actions: { gap: 8 }, body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  chip: { backgroundColor: colors.accentSoft, borderRadius: 999, color: colors.accent, fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, header: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  headerCopy: { flex: 1, gap: 5 }, meta: { color: colors.muted, fontSize: 13, lineHeight: 19 }, name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  portfolio: { gap: 12 }, portfolioCard: { backgroundColor: colors.background, borderRadius: 16, gap: 8, padding: 12, width: 260 },
  portfolioTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, reputation: { borderTopColor: colors.border, borderTopWidth: 1, gap: 4, paddingTop: 12 },
  reputationValue: { color: colors.text, fontSize: 20, fontWeight: '800' }, review: { borderTopColor: colors.border, borderTopWidth: 1, gap: 5, paddingTop: 10 },
  reviewTitle: { color: colors.text, fontSize: 14, fontWeight: '700' }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
});
