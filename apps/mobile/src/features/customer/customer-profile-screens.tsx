import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import { getProfileDisplayName } from '@casaticket/domain';
import { customerOnboardingSchema, type CustomerOnboardingInput } from '@casaticket/validation';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { ProfileMenuRow, ProfileSectionScreen } from '@/components/ui/profile-navigation';
import { Screen } from '@/components/ui/screen';
import { TextInput } from '@/components/ui/text-input';
import { colors } from '@/components/ui/theme';
import { useAuthSession } from '@/features/auth/auth-provider';
import { fetchOwnDefaultAddress, saveCustomerOnboarding } from '@/features/profile/api';
import { getUserFacingErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';

function useCustomerProfileEditor() {
  const queryClient = useQueryClient();
  const { sessionState, setProfileFromMutation } = useAuthSession();
  const profile = sessionState.status === 'authenticated' ? sessionState.profile : null;
  const addressQuery = useQuery({
    enabled: sessionState.status === 'authenticated',
    queryFn: fetchOwnDefaultAddress,
    queryKey: sessionState.status === 'authenticated' ? queryKeys.customerAddress(sessionState.user.id) : ['customer-address'],
  });
  const values = useMemo<CustomerOnboardingInput>(() => ({
    city: profile?.city ?? '',
    firstName: profile?.firstName ?? '',
    initialAddress: addressQuery.data?.addressLine ?? '',
    lastName: profile?.lastName ?? '',
    phone: profile?.phone ?? '',
    province: profile?.province ?? '',
  }), [addressQuery.data?.addressLine, profile]);
  const mutation = useMutation({
    mutationFn: async (nextValues: CustomerOnboardingInput) => {
      const updatedProfile = await saveCustomerOnboarding(customerOnboardingSchema.parse(nextValues));
      const updatedAddress = await fetchOwnDefaultAddress();
      return { address: updatedAddress, profile: updatedProfile };
    },
    onSuccess: ({ address, profile: updatedProfile }) => {
      if (sessionState.status !== 'authenticated') return;
      queryClient.setQueryData(queryKeys.profile(sessionState.user.id), updatedProfile);
      queryClient.setQueryData(queryKeys.customerAddress(sessionState.user.id), address);
      setProfileFromMutation(updatedProfile);
    },
  });
  return { addressQuery, mutation, profile, values };
}

export function CustomerProfileHubScreen() {
  const { sessionState, signOut } = useAuthSession();
  const profile = sessionState.status === 'authenticated' ? sessionState.profile : null;
  const addressQuery = useQuery({
    enabled: sessionState.status === 'authenticated',
    queryFn: fetchOwnDefaultAddress,
    queryKey: sessionState.status === 'authenticated' ? queryKeys.customerAddress(sessionState.user.id) : ['customer-address'],
  });
  if (!profile) return <Screen title="Perfil"><ErrorState message="No encontramos tu perfil todavía." /></Screen>;

  return (
    <Screen subtitle="Administrá tus datos y ubicación por secciones." title="Perfil">
      <Card>
        <View style={styles.profileHeader}>
          <Avatar name={getProfileDisplayName(profile)} />
          <View style={styles.headerCopy}>
            <Text style={styles.profileName}>{getProfileDisplayName(profile)}</Text>
            <Text style={styles.profileMeta}>{profile.city}, {profile.province}</Text>
          </View>
        </View>
      </Card>
      <View style={styles.sectionList}>
        <ProfileMenuRow description={`${profile.firstName} ${profile.lastName} · ${profile.phone ?? 'Sin teléfono'}`} icon="person-outline" label="Datos personales" path="/(customer)/profile/personal" />
        <ProfileMenuRow description={`${profile.city}, ${profile.province} · ${addressQuery.data?.addressLine ?? 'Sin dirección inicial'}`} icon="location-outline" label="Ubicación" path="/(customer)/profile/location" />
      </View>
      <Card>
        <Text style={styles.groupTitle}>Cuenta</Text>
        <Text style={styles.profileMeta}>Gestioná el acceso a tu cuenta.</Text>
        <Button onPress={() => void signOut()} variant="danger">Cerrar sesión</Button>
      </Card>
    </Screen>
  );
}

function SaveFeedback({ error, success }: { error: unknown; success: boolean }) {
  if (error) return <ErrorState message={getUserFacingErrorMessage(error, 'No pudimos guardar los cambios.')} />;
  return success ? <Text accessibilityRole="alert" style={styles.success}>Cambios guardados correctamente.</Text> : null;
}

export function CustomerPersonalDetailsScreen() {
  const editor = useCustomerProfileEditor();
  const [firstName, setFirstName] = useState(editor.values.firstName);
  const [lastName, setLastName] = useState(editor.values.lastName);
  const [phone, setPhone] = useState(editor.values.phone);
  const [success, setSuccess] = useState(false);
  return (
    <ProfileSectionScreen subtitle="Actualizá tus datos de contacto." title="Datos personales">
      <Card>
        <FormField label="Nombre"><TextInput onChangeText={setFirstName} value={firstName} /></FormField>
        <FormField label="Apellido"><TextInput onChangeText={setLastName} value={lastName} /></FormField>
        <FormField label="Teléfono"><TextInput keyboardType="phone-pad" onChangeText={setPhone} value={phone} /></FormField>
        <SaveFeedback error={editor.mutation.error} success={success} />
        <Button disabled={editor.mutation.isPending} onPress={() => void editor.mutation.mutateAsync({ ...editor.values, firstName, lastName, phone }).then(() => setSuccess(true)).catch(() => setSuccess(false))}>
          {editor.mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </Card>
    </ProfileSectionScreen>
  );
}

export function CustomerLocationScreen() {
  const editor = useCustomerProfileEditor();
  const [city, setCity] = useState(editor.values.city);
  const [province, setProvince] = useState(editor.values.province);
  const [initialAddress, setInitialAddress] = useState(editor.values.initialAddress);
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    setInitialAddress(editor.values.initialAddress);
  }, [editor.values.initialAddress]);
  return (
    <ProfileSectionScreen subtitle="Actualizá la ubicación y dirección inicial de tu hogar." title="Ubicación">
      <Card>
        <FormField label="Ciudad"><TextInput onChangeText={setCity} value={city} /></FormField>
        <FormField label="Provincia"><TextInput onChangeText={setProvince} value={province} /></FormField>
        <FormField hint="Opcional." label="Dirección inicial"><TextInput onChangeText={setInitialAddress} value={initialAddress} /></FormField>
        <SaveFeedback error={editor.mutation.error} success={success} />
        <Button disabled={editor.mutation.isPending} onPress={() => void editor.mutation.mutateAsync({ ...editor.values, city, province, initialAddress }).then(() => setSuccess(true)).catch(() => setSuccess(false))}>
          {editor.mutation.isPending ? 'Guardando...' : 'Guardar ubicación'}
        </Button>
      </Card>
    </ProfileSectionScreen>
  );
}

const styles = StyleSheet.create({
  groupTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  headerCopy: { flex: 1, gap: 3 },
  profileHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  profileMeta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  profileName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  sectionList: { gap: 10 },
  success: { color: colors.success, fontSize: 14, fontWeight: '700' },
});
