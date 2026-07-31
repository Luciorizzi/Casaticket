import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
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
import { profileAvatarQueryKey, resolveProfileAvatarUrl } from '@/features/profile/avatar-api';
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
  const [success, setSuccess] = useState(false);
  const publicProfileQuery = useQuery({
    enabled: Boolean(professionalId),
    queryFn: () => getPublicProfessionalProfile(professionalId ?? ''),
    queryKey: ['public-professional-profile', professionalId],
  });
  const avatarQuery = useQuery({ enabled: Boolean(profile?.avatarPath), queryFn: () => resolveProfileAvatarUrl(profile?.avatarPath ?? null), queryKey: profileAvatarQueryKey(profile?.avatarPath ?? null) });
  const refresh = async () => {
    await refreshProfile();
    await queryClient.invalidateQueries({ queryKey: ['profile-avatar'] });
    await queryClient.invalidateQueries({ queryKey: ['public-professional-profile', professionalId] });
  };
  const uploadMutation = useMutation({
    mutationFn: () => uploadOwnProfessionalAvatar(pending[0]!, profile?.avatarPath ?? null),
    onSuccess: async () => { setPending([]); setSuccess(true); await refresh(); },
  });
  const removeMutation = useMutation({ mutationFn: removeOwnProfessionalAvatar, onSuccess: refresh });

  if (!profile || !professionalId) return <Screen title="Foto de perfil"><ErrorState message="No encontramos tu perfil profesional." /></Screen>;
  return <Screen subtitle="Usá una foto clara y actual. Se mostrará a los clientes." title="Foto de perfil">
    <Card>
      <View style={styles.avatarPreview}><Avatar name={`${profile.firstName} ${profile.lastName}`} size={104} uri={avatarQuery.data ?? publicProfileQuery.data?.avatarUrl ?? null} /></View>
      <AttachmentPicker existingCount={0} maxAttachments={1} onChange={setPending} value={pending} />
      {uploadMutation.error ? <ErrorState message={uploadMutation.error instanceof Error ? uploadMutation.error.message : 'No pudimos guardar la foto.'} /> : null}
      {success ? <Text style={styles.success}>Foto actualizada</Text> : null}
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
  const updateMutation = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: { description?: string; isVisible?: boolean; sortOrder?: number; title?: string } }) => updatePortfolioItem(id, patch), onSuccess: refresh });
  const reorderMutation = useMutation({
    mutationFn: (changes: Array<{ id: string; sortOrder: number }>) => Promise.all(changes.map((change) => updatePortfolioItem(change.id, { sortOrder: change.sortOrder }))),
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({ mutationFn: deletePortfolioItem, onSuccess: refresh });
  const items = portfolioQuery.data ?? [];
  if (!professionalId) return <Screen title="Portfolio"><ErrorState message="No encontramos tu perfil profesional." /></Screen>;

  return <Screen subtitle="Mostrá ejemplos reales de tu trabajo. Hasta 12 publicaciones." title="Portfolio">
    {items.map((item, index) => <EditablePortfolioItem
      canMoveDown={index < items.length - 1}
      canMoveUp={index > 0}
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
      onUpdate={(patch) => updateMutation.mutate({ id: item.id, patch })}
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

function EditablePortfolioItem({ canMoveDown, canMoveUp, item, onDelete, onMove, onToggle, onUpdate }: { canMoveDown: boolean; canMoveUp: boolean; item: ProfessionalPortfolioItem; onDelete: () => void; onMove: (offset: number) => void; onToggle: () => void; onUpdate: (patch: { description: string; title: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(item.title);
  const [draftDescription, setDraftDescription] = useState(item.description);
  const query = useQuery({ queryFn: () => listAttachments({ portfolioItemId: item.id }, 'portfolio'), queryKey: ['attachments', 'portfolio', item.id] });
  return <Card>
    {query.data ? <AttachmentGallery attachments={query.data} onDelete={(attachment) => Alert.alert('Eliminar foto', 'La foto dejará de mostrarse.', [{ style: 'cancel', text: 'Cancelar' }, { style: 'destructive', text: 'Eliminar', onPress: () => void deleteAttachment(attachment.id).then(() => query.refetch()) }])} /> : null}
    {editing ? <View><TextInput onChangeText={setDraftTitle} value={draftTitle} /><TextInput multiline onChangeText={setDraftDescription} value={draftDescription} /><Button onPress={() => { onUpdate({ description: draftDescription, title: draftTitle }); setEditing(false); }}>Guardar</Button></View> : <><Text style={styles.title}>{item.title}</Text><Text style={styles.help}>{item.description}</Text></>}
    <Text style={styles.help}>Categoría: {item.categoryName ?? 'Sin categoría'}</Text>
    <Text style={styles.help}>Estado: {item.isVisible ? 'Visible para clientes' : 'Oculto'}</Text>
    <View style={styles.orderBlock}><Text style={styles.label}>Orden de aparición</Text><View style={styles.orderActions}><Button disabled={!canMoveUp} onPress={() => onMove(-1)} variant="secondary"><Ionicons color={colors.text} name="chevron-up" size={20} /></Button><Button disabled={!canMoveDown} onPress={() => onMove(1)} variant="secondary"><Ionicons color={colors.text} name="chevron-down" size={20} /></Button></View></View>
    <View style={styles.actions}><Button onPress={() => setEditing(true)} variant="ghost">Editar</Button><Button onPress={onToggle} variant="secondary">{item.isVisible ? 'Ocultar' : 'Mostrar'}</Button></View>
    <View style={styles.deleteSection}><Button onPress={onDelete} variant="ghost">Eliminar trabajo</Button></View>
  </Card>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 }, avatarPreview: { alignItems: 'center' }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, deleteSection: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 4, paddingTop: 8 }, orderActions: { flexDirection: 'row', gap: 8 }, orderBlock: { backgroundColor: colors.surfaceStrong, borderRadius: 14, gap: 8, padding: 12 },
  help: { color: colors.muted, fontSize: 14, lineHeight: 20 }, label: { color: colors.text, fontSize: 14, fontWeight: '700' }, success: { color: colors.success, fontWeight: '700' }, title: { color: colors.text, fontSize: 18, fontWeight: '800' },
});
