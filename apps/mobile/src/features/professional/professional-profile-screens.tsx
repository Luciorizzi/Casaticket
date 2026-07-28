import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { getAvailabilityLabel, getProfileDisplayName } from '@casaticket/domain';
import type { AvailabilityStatus } from '@casaticket/types';
import {
  professionalOnboardingSchema,
  type ProfessionalOnboardingInput,
} from '@casaticket/validation';

import { AvailabilitySelector } from '@/components/ui/availability-selector';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CategorySelector } from '@/components/ui/category-selector';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { RadiusSelector } from '@/components/ui/radius-selector';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { TextInput } from '@/components/ui/text-input';
import { colors } from '@/components/ui/theme';
import { useAuthSession } from '@/features/auth/auth-provider';
import { listActiveCategories } from '@/features/categories/api';
import { saveProfessionalOnboarding } from '@/features/profile/api';
import { getUserFacingErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { ProfileMenuRow, ProfileSectionScreen } from '@/components/ui/profile-navigation';

function useProfessionalProfileEditor() {
  const queryClient = useQueryClient();
  const { sessionState, setProfileFromMutation } = useAuthSession();
  const profile = sessionState.status === 'authenticated' ? sessionState.profile : null;
  const professionalProfile =
    sessionState.status === 'authenticated' ? sessionState.professionalProfile : null;
  const categoryIds = useMemo(
    () => (sessionState.status === 'authenticated' ? sessionState.professionalCategoryIds : []),
    [sessionState],
  );

  const values = useMemo<ProfessionalOnboardingInput>(
    () => ({
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      phone: profile?.phone ?? '',
      city: profile?.city ?? '',
      province: profile?.province ?? '',
      bio: professionalProfile?.bio ?? '',
      yearsExperience: professionalProfile?.yearsExperience ?? 0,
      baseCity: professionalProfile?.baseCity ?? profile?.city ?? '',
      serviceRadiusKm: professionalProfile?.serviceRadiusKm ?? 10,
      availabilityStatus: professionalProfile?.availabilityStatus ?? 'available',
      categoryIds,
    }),
    [categoryIds, professionalProfile, profile],
  );

  const mutation = useMutation({
    mutationFn: saveProfessionalOnboarding,
    onSuccess: ({ categories, professionalProfile: updatedProfessionalProfile, profile: updatedProfile }) => {
      if (sessionState.status !== 'authenticated') {
        return;
      }

      queryClient.setQueryData(queryKeys.profile(sessionState.user.id), updatedProfile);
      queryClient.setQueryData(
        queryKeys.professionalProfile(sessionState.user.id),
        updatedProfessionalProfile,
      );
      queryClient.setQueryData(queryKeys.professionalCategories(sessionState.user.id), categories);
      setProfileFromMutation(updatedProfile);
    },
  });

  const save = async (nextValues: ProfessionalOnboardingInput) => {
    const parsed = professionalOnboardingSchema.parse(nextValues);
    await mutation.mutateAsync(parsed);
  };

  const saveAndGoBack = async (nextValues: ProfessionalOnboardingInput) => {
    try {
      await save(nextValues);
      router.back();
    } catch {
      // The mutation exposes the error to the section without leaving the screen.
    }
  };

  return { categoryIds, mutation, professionalProfile, profile, saveAndGoBack, values };
}

export function ProfessionalProfileHubScreen() {
  const { sessionState, signOut } = useAuthSession();
  const profile = sessionState.status === 'authenticated' ? sessionState.profile : null;
  const professionalProfile =
    sessionState.status === 'authenticated' ? sessionState.professionalProfile : null;
  const selectedIds =
    sessionState.status === 'authenticated' ? sessionState.professionalCategoryIds : [];
  const categoriesQuery = useQuery({ queryKey: queryKeys.categories, queryFn: listActiveCategories });
  const categoryNames = (categoriesQuery.data ?? [])
    .filter((category) => selectedIds.includes(category.id))
    .map((category) => category.name);

  if (!profile || !professionalProfile) {
    return (
      <Screen title="Perfil profesional">
        <ErrorState message="No encontramos tu perfil profesional todavía." />
      </Screen>
    );
  }

  return (
    <Screen subtitle="Administrá tu información profesional por secciones." title="Perfil">
      <Card>
        <View style={styles.profileHeader}>
          <Avatar name={getProfileDisplayName(profile)} />
          <View style={styles.profileHeaderCopy}>
            <Text style={styles.profileName}>{getProfileDisplayName(profile)}</Text>
            <Text style={styles.profileMeta}>
              {categoryNames.length > 0 ? categoryNames.join(' · ') : 'Sin rubros seleccionados'}
            </Text>
            <Text style={styles.profileMeta}>{professionalProfile.baseCity}</Text>
          </View>
          <StatusBadge value={getAvailabilityLabel(professionalProfile.availabilityStatus)} />
        </View>
      </Card>

      <View style={styles.sectionList}>
        <ProfileMenuRow
          description={`${profile.firstName} ${profile.lastName} · ${profile.city}`}
          icon="person-outline"
          label="Datos personales"
          path="/(professional)/profile/personal"
        />
        <ProfileMenuRow
          description={`${selectedIds.length} rubros seleccionados`}
          icon="construct-outline"
          label="Rubros y especialidades"
          path="/(professional)/profile/categories"
        />
        <ProfileMenuRow
          description={`${professionalProfile.baseCity} · ${professionalProfile.serviceRadiusKm} km`}
          icon="location-outline"
          label="Zona de trabajo"
          path="/(professional)/profile/work-area"
        />
        <ProfileMenuRow
          description={getAvailabilityLabel(professionalProfile.availabilityStatus)}
          icon="calendar-outline"
          label="Disponibilidad"
          path="/(professional)/profile/availability"
        />
        <ProfileMenuRow
          description="Bio y experiencia"
          icon="document-text-outline"
          label="Descripción profesional"
          path="/(professional)/profile/description"
        />
      </View>

      <Card>
        <Text style={styles.groupTitle}>Cuenta</Text>
        <Text style={styles.profileMeta}>Gestioná el acceso a tu cuenta.</Text>
        <Button onPress={() => void signOut()} variant="danger">Cerrar sesión</Button>
      </Card>
    </Screen>
  );
}

function SaveError({ error }: { error: unknown }) {
  if (!error) return null;
  return <ErrorState message={getUserFacingErrorMessage(error, 'No pudimos guardar los cambios.')} />;
}

export function ProfessionalPersonalDetailsScreen() {
  const editor = useProfessionalProfileEditor();
  const [firstName, setFirstName] = useState(editor.values.firstName);
  const [lastName, setLastName] = useState(editor.values.lastName);
  const [phone, setPhone] = useState(editor.values.phone);
  const [city, setCity] = useState(editor.values.city);
  const [province, setProvince] = useState(editor.values.province);

  return (
    <ProfileSectionScreen subtitle="Actualizá tus datos de contacto y ubicación." title="Datos personales">
      <Card>
        <FormField label="Nombre"><TextInput onChangeText={setFirstName} value={firstName} /></FormField>
        <FormField label="Apellido"><TextInput onChangeText={setLastName} value={lastName} /></FormField>
        <FormField label="Teléfono"><TextInput keyboardType="phone-pad" onChangeText={setPhone} value={phone} /></FormField>
        <FormField label="Ciudad"><TextInput onChangeText={setCity} value={city} /></FormField>
        <FormField label="Provincia"><TextInput onChangeText={setProvince} value={province} /></FormField>
        <SaveError error={editor.mutation.error} />
        <Button disabled={editor.mutation.isPending} onPress={() => void editor.saveAndGoBack({ ...editor.values, firstName, lastName, phone, city, province })}>
          {editor.mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </Card>
    </ProfileSectionScreen>
  );
}

export function ProfessionalCategoriesScreen() {
  const editor = useProfessionalProfileEditor();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(editor.values.categoryIds);
  const categoryQuery = useQuery({ queryKey: queryKeys.categories, queryFn: listActiveCategories });
  const normalizedSearch = search.trim().toLocaleLowerCase('es');
  const categories = (categoryQuery.data ?? []).filter((category) =>
    `${category.name} ${category.description ?? ''}`.toLocaleLowerCase('es').includes(normalizedSearch),
  );

  return (
    <ProfileSectionScreen subtitle="Elegí uno o varios rubros para recibir oportunidades relevantes." title="Rubros y especialidades">
      <TextInput onChangeText={setSearch} placeholder="Buscar rubros" value={search} />
      <Text style={styles.selectionSummary}>{selectedIds.length} rubros seleccionados</Text>
      <CategorySelector
        categories={categories}
        error={categoryQuery.error instanceof Error ? categoryQuery.error.message : undefined}
        loading={categoryQuery.isPending}
        onRetry={() => void categoryQuery.refetch()}
        onToggle={(categoryId) => setSelectedIds((current) => current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId])}
        selectedIds={selectedIds}
      />
      <SaveError error={editor.mutation.error} />
      <Button disabled={editor.mutation.isPending} onPress={() => void editor.saveAndGoBack({ ...editor.values, categoryIds: selectedIds })}>
        {editor.mutation.isPending ? 'Guardando...' : 'Guardar rubros'}
      </Button>
    </ProfileSectionScreen>
  );
}

export function ProfessionalWorkAreaScreen() {
  const editor = useProfessionalProfileEditor();
  const [baseCity, setBaseCity] = useState(editor.values.baseCity);
  const [serviceRadiusKm, setServiceRadiusKm] = useState(editor.values.serviceRadiusKm);
  return (
    <ProfileSectionScreen subtitle="Definí desde dónde trabajás y hasta qué distancia te trasladás." title="Zona de trabajo">
      <Card>
        <FormField label="Ciudad base"><TextInput onChangeText={setBaseCity} value={baseCity} /></FormField>
        <FormField label="Radio de servicio"><RadiusSelector onChange={setServiceRadiusKm} value={serviceRadiusKm} /></FormField>
        <SaveError error={editor.mutation.error} />
        <Button disabled={editor.mutation.isPending} onPress={() => void editor.saveAndGoBack({ ...editor.values, baseCity, serviceRadiusKm })}>Guardar zona</Button>
      </Card>
    </ProfileSectionScreen>
  );
}

export function ProfessionalAvailabilityScreen() {
  const editor = useProfessionalProfileEditor();
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(editor.values.availabilityStatus);
  return (
    <ProfileSectionScreen subtitle="Indicá si actualmente podés recibir nuevas oportunidades." title="Disponibilidad">
      <Card>
        <AvailabilitySelector onChange={setAvailabilityStatus} value={availabilityStatus} />
        <SaveError error={editor.mutation.error} />
        <Button disabled={editor.mutation.isPending} onPress={() => void editor.saveAndGoBack({ ...editor.values, availabilityStatus })}>Guardar disponibilidad</Button>
      </Card>
    </ProfileSectionScreen>
  );
}

export function ProfessionalDescriptionScreen() {
  const editor = useProfessionalProfileEditor();
  const [bio, setBio] = useState(editor.values.bio);
  const [yearsExperience, setYearsExperience] = useState(editor.values.yearsExperience);
  return (
    <ProfileSectionScreen subtitle="Contá tu experiencia y cómo trabajás." title="Descripción profesional">
      <Card>
        <FormField hint="Mínimo 40 caracteres." label="Presentación"><TextInput multiline onChangeText={setBio} value={bio} /></FormField>
        <FormField label="Años de experiencia"><TextInput keyboardType="number-pad" onChangeText={(value) => setYearsExperience(Number(value || 0))} value={String(yearsExperience)} /></FormField>
        <SaveError error={editor.mutation.error} />
        <Button disabled={editor.mutation.isPending} onPress={() => void editor.saveAndGoBack({ ...editor.values, bio, yearsExperience })}>Guardar descripción</Button>
      </Card>
    </ProfileSectionScreen>
  );
}

const styles = StyleSheet.create({
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileHeaderCopy: { flex: 1, gap: 3 },
  profileName: { fontSize: 20, fontWeight: '800', color: colors.text },
  profileMeta: { fontSize: 13, lineHeight: 19, color: colors.muted },
  sectionList: { gap: 10 },
  groupTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  selectionSummary: { fontSize: 14, fontWeight: '700', color: colors.muted },
});
