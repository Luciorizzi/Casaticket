import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Screen } from '@/components/ui/screen';
import { TextInput } from '@/components/ui/text-input';
import { colors } from '@/components/ui/theme';
import { AttachmentGallery, AttachmentPicker } from '@/features/attachments/components';
import { deleteAttachment, listAttachments, uploadAttachments, type PendingAttachment } from '@/features/attachments/api';
import { useAuthSession } from '@/features/auth/auth-provider';
import { listActiveCategories } from '@/features/categories/api';
import {
  createPortfolioItem,
  deletePortfolioItem,
  getPublicProfessionalProfile,
  listProfessionalPortfolio,
  removeOwnProfessionalAvatar,
  updatePortfolioItem,
  uploadOwnProfessionalAvatar,
  type ProfessionalPortfolioItem,
} from '@/features/professional/public-profile-api';

export function ProfessionalAvatarScreen() {
  const queryClient = useQueryClient();
  const { sessionState, refreshProfile } = useAuthSession();
  const profile = sessionState.status === 'authenticated' ? sessionState.profile : null;
  const professionalId = sessionState.status === 'authenticated' ? sessionState.professionalProfile?.id : null;
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const publicProfileQuery = useQuery({
    enabled: Boolean(professionalId),
    queryFn: () => getPublicProfessionalProfile(professionalId ?? ''),
    queryKey: ['public-professional-profile', professionalId],
  });
  const refresh = async () => {
    await refreshProfile();
    await queryClient.invalidateQueries({ queryKey: ['public-professional-profile', professionalId] });
  };
  const uploadMutation = useMutation({
    mutationFn: () => uploadOwnProfessionalAvatar(pending[0]!),
    onSuccess: async () => { setPending([]); await refresh(); },
  });
  const removeMutation = useMutation({ mutationFn: removeOwnProfessionalAvatar, onSuccess: refresh });

  if (!profile || !professionalId) return <Screen title="Foto de perfil"><ErrorState message="No encontramos tu perfil profesional." /></Screen>;
  return <Screen subtitle="Usá una foto clara y actual. Se mostrará a los clientes." title="Foto de perfil">
    <Card>
      <View style={styles.avatarPreview}><Avatar name={`${profile.firstName} ${profile.lastName}`} size={104} uri={publicProfileQuery.data?.avatarUrl ?? null} /></View>
      <AttachmentPicker existingCount={0} maxAttachments={1} onChange={setPending} value={pending} />
      {uploadMutation.error ? <ErrorState message="No pudimos guardar la foto." /> : null}
      <Button disabled={pending.length !== 1 || uploadMutation.isPending} onPress={() => uploadMutation.mutate()}>{uploadMutation.isPending ? 'Guardando...' : profile.avatarPath ? 'Reemplazar foto' : 'Guardar foto'}</Button>
      {profile.avatarPath ? <Button disabled={removeMutation.isPending} onPress={() => Alert.alert('Eliminar foto', 'Se volverán a mostrar tus iniciales.', [{ style: 'cancel', text: 'Cancelar' }, { style: 'destructive', text: 'Eliminar', onPress: () => removeMutation.mutate() }])} variant="danger">Eliminar foto</Button> : null}
    </Card>
  </Screen>;
}

export function ProfessionalPortfolioScreen() {
  const queryClient = useQueryClient();
  const { sessionState } = useAuthSession();
  const professionalId = sessionState.status === 'authenticated' ? sessionState.professionalProfile?.id : null;
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const queryKey = ['professional-portfolio', professionalId] as const;
  const portfolioQuery = useQuery({ enabled: Boolean(professionalId), queryFn: () => listProfessionalPortfolio(professionalId ?? ''), queryKey });
  const categoriesQuery = useQuery({ queryFn: listActiveCategories, queryKey: ['categories'] });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!professionalId) throw new Error('Perfil no disponible.');
      if (pending.length < 1) throw new Error('Agregá al menos una foto.');
      const item = await createPortfolioItem({ professionalId, categoryId, title, description, sortOrder: portfolioQuery.data?.length ?? 0 });
      try {
        const result = await uploadAttachments({ assets: pending, portfolioItemId: item.id, type: 'portfolio' });
        if (result.failed.length > 0) throw new Error('No se pudieron subir todas las fotos.');
        return item;
      } catch (error) {
        await deletePortfolioItem(item.id);
        throw error;
      }
    },
    onSuccess: async () => { setCreating(false); setTitle(''); setDescription(''); setCategoryId(null); setPending([]); await refresh(); },
  });
  const updateMutation = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: { isVisible?: boolean; sortOrder?: number } }) => updatePortfolioItem(id, patch), onSuccess: refresh });
  const reorderMutation = useMutation({
    mutationFn: (changes: Array<{ id: string; sortOrder: number }>) => Promise.all(changes.map((change) => updatePortfolioItem(change.id, { sortOrder: change.sortOrder }))),
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({ mutationFn: deletePortfolioItem, onSuccess: refresh });
  const items = portfolioQuery.data ?? [];
  if (!professionalId) return <Screen title="Portfolio"><ErrorState message="No encontramos tu perfil profesional." /></Screen>;

  return <Screen subtitle="Mostrá ejemplos reales de tu trabajo. Hasta 12 publicaciones." title="Portfolio">
    {items.map((item, index) => <EditablePortfolioItem
      item={item}
      key={item.id}
      onDelete={() => Alert.alert('Eliminar trabajo', 'También se eliminarán sus fotos.', [{ style: 'cancel', text: 'Cancelar' }, { style: 'destructive', text: 'Eliminar', onPress: () => deleteMutation.mutate(item.id) }])}
      onMove={(offset) => {
        const targetIndex = index + offset;
        const neighbor = items[targetIndex];
        if (!neighbor) return;
        reorderMutation.mutate([{ id: item.id, sortOrder: targetIndex }, { id: neighbor.id, sortOrder: index }]);
      }}
      onToggle={() => updateMutation.mutate({ id: item.id, patch: { isVisible: !item.isVisible } })}
    />)}
    {items.length === 0 ? <Text style={styles.help}>Todavía no agregaste trabajos al portfolio.</Text> : null}
    {!creating && items.length < 12 ? <Button onPress={() => setCreating(true)}>Agregar trabajo</Button> : null}
    {creating ? <Card>
      <Text style={styles.title}>Nuevo trabajo</Text>
      <FormField label="Título"><TextInput onChangeText={setTitle} value={title} /></FormField>
      <FormField label="Descripción breve"><TextInput multiline onChangeText={setDescription} value={description} /></FormField>
      <Text style={styles.label}>Categoría</Text>
      <View style={styles.categories}>{(categoriesQuery.data ?? []).map((category) => <Button key={category.id} onPress={() => setCategoryId(category.id)} variant={categoryId === category.id ? 'primary' : 'secondary'}>{category.name}</Button>)}</View>
      <AttachmentPicker maxAttachments={5} onChange={setPending} value={pending} />
      {createMutation.error ? <ErrorState message={createMutation.error instanceof Error ? createMutation.error.message : 'No pudimos crear el trabajo.'} /> : null}
      <View style={styles.actions}><Button onPress={() => { setCreating(false); setPending([]); }} variant="ghost">Cancelar</Button><Button disabled={title.trim().length < 3 || description.trim().length < 10 || pending.length < 1 || createMutation.isPending} onPress={() => createMutation.mutate()}>Guardar trabajo</Button></View>
    </Card> : null}
  </Screen>;
}

function EditablePortfolioItem({ item, onDelete, onMove, onToggle }: { item: ProfessionalPortfolioItem; onDelete: () => void; onMove: (offset: number) => void; onToggle: () => void }) {
  const query = useQuery({ queryFn: () => listAttachments({ portfolioItemId: item.id }, 'portfolio'), queryKey: ['attachments', 'portfolio', item.id] });
  return <Card>
    <Text style={styles.title}>{item.title}</Text><Text style={styles.help}>{item.description}</Text>
    {query.data ? <AttachmentGallery attachments={query.data} onDelete={(attachment) => Alert.alert('Eliminar foto', 'La foto dejará de mostrarse.', [{ style: 'cancel', text: 'Cancelar' }, { style: 'destructive', text: 'Eliminar', onPress: () => void deleteAttachment(attachment.id).then(() => query.refetch()) }])} /> : null}
    <Text style={styles.help}>{item.isVisible ? 'Visible para clientes' : 'Oculto'}</Text>
    <View style={styles.actions}><Button onPress={() => onMove(-1)} variant="ghost">Subir</Button><Button onPress={() => onMove(1)} variant="ghost">Bajar</Button></View>
    <Button onPress={onToggle} variant="secondary">{item.isVisible ? 'Ocultar' : 'Mostrar'}</Button><Button onPress={onDelete} variant="danger">Eliminar trabajo</Button>
  </Card>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 }, avatarPreview: { alignItems: 'center' }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  help: { color: colors.muted, fontSize: 14, lineHeight: 20 }, label: { color: colors.text, fontSize: 14, fontWeight: '700' }, title: { color: colors.text, fontSize: 18, fontWeight: '800' },
});
