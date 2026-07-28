import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { colors } from '@/components/ui/theme';
import { listAttachments, type Attachment, type AttachmentType, type PendingAttachment } from '@/features/attachments/api';

const MAX_ATTACHMENTS = 5;
const VALID_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function AttachmentThumbnail({ label, onPress, uri }: { label: string; onPress: () => void; uri: string }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="imagebutton" onPress={onPress} style={styles.thumbnail}>
      <Image source={{ uri }} style={styles.image} />
    </Pressable>
  );
}

export function AttachmentViewer({ onClose, uri, visible }: { onClose: () => void; uri: string | null; visible: boolean }) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.viewerBackdrop}>
        {uri ? <Image resizeMode="contain" source={{ uri }} style={styles.viewerImage} /> : null}
        <Button onPress={onClose} variant="secondary">Cerrar imagen</Button>
      </View>
    </Modal>
  );
}

export function AttachmentGallery({ attachments, emptyLabel = 'No hay fotos adjuntas.' }: { attachments: Attachment[]; emptyLabel?: string }) {
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  if (attachments.length === 0) return <Text style={styles.empty}>{emptyLabel}</Text>;
  return (
    <>
      <ScrollView contentContainerStyle={styles.gallery} horizontal showsHorizontalScrollIndicator={false}>
        {attachments.map((attachment, index) => (
          <AttachmentThumbnail key={attachment.id} label={`Ampliar imagen ${index + 1}`} onPress={() => setSelectedUri(attachment.signedUrl)} uri={attachment.signedUrl} />
        ))}
      </ScrollView>
      <AttachmentViewer onClose={() => setSelectedUri(null)} uri={selectedUri} visible={selectedUri !== null} />
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

export function AttachmentPicker({ disabled = false, onChange, value }: {
  disabled?: boolean;
  onChange: (attachments: PendingAttachment[]) => void;
  value: PendingAttachment[];
}) {
  const [error, setError] = useState<string | null>(null);

  const addAssets = async (source: 'camera' | 'library') => {
    setError(null);
    const remaining = MAX_ATTACHMENTS - value.length;
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
      <View style={styles.pickerHeader}><Text style={styles.title}>Fotos del problema</Text><Text style={styles.count}>{value.length} de {MAX_ATTACHMENTS}</Text></View>
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
        <Button disabled={disabled || value.length >= MAX_ATTACHMENTS} onPress={() => void addAssets('camera')} variant="secondary">Cámara</Button>
        <Button disabled={disabled || value.length >= MAX_ATTACHMENTS} onPress={() => void addAssets('library')} variant="secondary">Galería</Button>
      </View>
    </View>
  );
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
