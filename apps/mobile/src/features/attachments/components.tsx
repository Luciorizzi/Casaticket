import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { colors } from '@/components/ui/theme';
import { canEditRequestEvidence, deleteAttachment, listAttachments, uploadAttachments, type Attachment, type AttachmentType, type PendingAttachment } from '@/features/attachments/api';

const MAX_ATTACHMENTS = 5;
const VALID_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function getRequestAttachmentActionLabel(count: number): string {
  if (count <= 0) return 'Agregar fotos · hasta 5';
  if (count >= MAX_ATTACHMENTS) return 'Límite alcanzado';
  return `Agregar más fotos · quedan ${MAX_ATTACHMENTS - count}`;
}

export function AttachmentThumbnail({ label, onPress, uri }: { label: string; onPress: () => void; uri: string }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="imagebutton" onPress={onPress} style={styles.thumbnail}>
      <Image source={{ uri }} style={styles.image} />
    </Pressable>
  );
}

export function AttachmentViewer({ onClose, onDelete, uri, visible }: { onClose: () => void; onDelete?: () => void; uri: string | null; visible: boolean }) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.viewerBackdrop}>
        {uri ? <Image resizeMode="contain" source={{ uri }} style={styles.viewerImage} /> : null}
        {onDelete ? <Button onPress={onDelete} variant="danger">Eliminar foto</Button> : null}
        <Button onPress={onClose} variant="secondary">Cerrar imagen</Button>
      </View>
    </Modal>
  );
}

export function AttachmentGallery({ attachments, emptyLabel = 'No hay fotos adjuntas.', onDelete }: { attachments: Attachment[]; emptyLabel?: string; onDelete?: (attachment: Attachment) => void }) {
  const [selected, setSelected] = useState<Attachment | null>(null);
  if (attachments.length === 0) return <Text style={styles.empty}>{emptyLabel}</Text>;
  return (
    <>
      <ScrollView contentContainerStyle={styles.gallery} horizontal showsHorizontalScrollIndicator={false}>
        {attachments.map((attachment, index) => (
          <AttachmentThumbnail key={attachment.id} label={`Ampliar imagen ${index + 1}`} onPress={() => setSelected(attachment)} uri={attachment.signedUrl} />
        ))}
      </ScrollView>
      <AttachmentViewer {...(selected && onDelete ? { onDelete: () => { onDelete(selected); setSelected(null); } } : {})} onClose={() => setSelected(null)} uri={selected?.signedUrl ?? null} visible={selected !== null} />
    </>
  );
}

export function AttachmentGallerySection({ jobId, serviceRequestId, title, type }: {
  jobId?: string;
  serviceRequestId?: string;
  title: string;
  type: AttachmentType;
}) {
  const query = useQuery({
    enabled: Boolean(jobId || serviceRequestId),
    queryFn: () => listAttachments(jobId ? { jobId } : { serviceRequestId: serviceRequestId ?? '' }, type),
    queryKey: ['attachments', type, jobId ?? serviceRequestId],
    staleTime: 12 * 60 * 1000,
  });
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {query.isPending ? <Text style={styles.help}>Cargando imágenes...</Text> : null}
      {query.error ? <Text style={styles.error}>No pudimos cargar las imágenes.</Text> : null}
      {query.data ? <AttachmentGallery attachments={query.data} /> : null}
    </View>
  );
}

export function AttachmentPicker({ disabled = false, existingCount = 0, maxAttachments = MAX_ATTACHMENTS, onChange, value }: {
  disabled?: boolean;
  existingCount?: number;
  maxAttachments?: number;
  onChange: (attachments: PendingAttachment[]) => void;
  value: PendingAttachment[];
}) {
  const [error, setError] = useState<string | null>(null);

  const addAssets = async (source: 'camera' | 'library') => {
    setError(null);
    const remaining = maxAttachments - existingCount - value.length;
    if (remaining <= 0) return;
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Necesitamos permiso para acceder a tus fotos.');
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ['images'], selectionLimit: remaining, quality: 1 });
    if (result.canceled) return;
    const valid = result.assets.slice(0, remaining).filter((asset) => VALID_MIME_TYPES.has(asset.mimeType ?? 'image/jpeg'));
    if (valid.length !== result.assets.slice(0, remaining).length) setError('Solo se admiten imágenes JPG, PNG o WebP.');
    const compressed = await Promise.all(valid.map(async (asset) => {
      const image = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 1600 } }], { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG });
      return { ...asset, height: image.height, localId: `${Date.now()}-${Math.random()}`, mimeType: 'image/jpeg', uri: image.uri, width: image.width } satisfies PendingAttachment;
    }));
    onChange([...value, ...compressed]);
  };

  return (
    <View style={styles.picker}>
      <View style={styles.pickerHeader}><Text style={styles.title}>Fotos para agregar</Text><Text style={styles.count}>{existingCount + value.length} de {maxAttachments}</Text></View>
      <Text style={styles.help}>Opcional. Podés agregar hasta cinco imágenes.</Text>
      <ScrollView contentContainerStyle={styles.gallery} horizontal showsHorizontalScrollIndicator={false}>
        {value.map((asset, index) => (
          <View key={asset.localId}>
            <Image source={{ uri: asset.uri }} style={styles.thumbnail} />
            <Pressable accessibilityLabel={`Eliminar imagen ${index + 1}`} accessibilityRole="button" onPress={() => onChange(value.filter((item) => item.localId !== asset.localId))} style={styles.remove}>
              <Ionicons color="#fff" name="close" size={16} />
            </Pressable>
            {asset.error ? <Text style={styles.assetError}>Error</Text> : null}
          </View>
        ))}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button disabled={disabled || existingCount + value.length >= maxAttachments} onPress={() => void addAssets('camera')} variant="secondary">Cámara</Button>
        <Button disabled={disabled || existingCount + value.length >= maxAttachments} onPress={() => void addAssets('library')} variant="secondary">Galería</Button>
      </View>
    </View>
  );
}

export function EditableRequestAttachmentSection({ canEdit, onChanged, serviceRequestId }: {
  canEdit: boolean;
  onChanged?: () => void;
  serviceRequestId: string;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const queryKey = ['attachments', 'request_evidence', serviceRequestId] as const;
  const query = useQuery({ queryFn: () => listAttachments({ serviceRequestId }, 'request_evidence'), queryKey, staleTime: 12 * 60 * 1000 });
  const editPermissionQuery = useQuery({ enabled: canEdit, queryFn: () => canEditRequestEvidence(serviceRequestId), queryKey: ['request-evidence-editable', serviceRequestId] });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
    onChanged?.();
  };
  const uploadMutation = useMutation({
    mutationFn: () => uploadAttachments({ assets: pending, serviceRequestId, sortOrderOffset: query.data?.length ?? 0, type: 'request_evidence' }),
    onSuccess: async (result) => {
      setPending(result.failed);
      if (result.uploaded.length > 0) await refresh();
      if (result.failed.length === 0) setEditing(false);
    },
  });
  const deleteMutation = useMutation({ mutationFn: deleteAttachment, onSuccess: refresh });
  const attachments = query.data ?? [];
  const editingAllowed = canEdit && editPermissionQuery.data === true;
  const remaining = MAX_ATTACHMENTS - attachments.length;
  const confirmDelete = (attachment: Attachment) => Alert.alert('Eliminar foto', 'La foto dejará de estar disponible para los profesionales.', [
    { style: 'cancel', text: 'Cancelar' },
    { onPress: () => deleteMutation.mutate(attachment.id), style: 'destructive', text: 'Eliminar' },
  ]);

  return <View style={styles.section}>
    <Text style={styles.title}>Fotos del problema</Text>
    {query.isPending ? <Text style={styles.help}>Cargando imágenes...</Text> : null}
    {query.error ? <Text style={styles.error}>No pudimos cargar las imágenes.</Text> : null}
    {query.data ? <AttachmentGallery {...(editingAllowed ? { onDelete: confirmDelete } : {})} attachments={attachments} /> : null}
    {editingAllowed && remaining > 0 && !editing ? <Button onPress={() => setEditing(true)} variant="secondary">{getRequestAttachmentActionLabel(attachments.length)}</Button> : null}
    {editingAllowed && remaining === 0 ? <Text style={styles.help}>Límite alcanzado</Text> : null}
    {editing ? <><AttachmentPicker disabled={uploadMutation.isPending} existingCount={attachments.length} onChange={setPending} value={pending} /><View style={styles.actions}><Button onPress={() => { setEditing(false); setPending([]); }} variant="ghost">Cancelar</Button><Button disabled={pending.length === 0 || uploadMutation.isPending} onPress={() => uploadMutation.mutate()} variant="secondary">{uploadMutation.isPending ? 'Subiendo...' : 'Confirmar carga'}</Button></View></> : null}
  </View>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  assetError: { color: colors.danger, fontSize: 11 },
  count: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  empty: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13 },
  gallery: { gap: 10 },
  help: { color: colors.muted, fontSize: 13 },
  image: { height: '100%', width: '100%' },
  picker: { gap: 10 },
  pickerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  remove: { alignItems: 'center', backgroundColor: '#1d1811', borderRadius: 14, height: 28, justifyContent: 'center', position: 'absolute', right: -5, top: -5, width: 28 },
  section: { gap: 10 },
  thumbnail: { backgroundColor: colors.accentSoft, borderRadius: 14, height: 96, overflow: 'hidden', width: 96 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  viewerBackdrop: { alignItems: 'center', backgroundColor: 'rgba(29,24,17,0.92)', flex: 1, gap: 20, justifyContent: 'center', padding: 20 },
  viewerImage: { height: '75%', width: '100%' },
});
