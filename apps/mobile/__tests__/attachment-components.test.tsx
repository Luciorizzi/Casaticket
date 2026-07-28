import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import type { PendingAttachment } from '@/features/attachments/api';
import { AttachmentGallery, AttachmentPicker } from '@/features/attachments/components';

function asset(index: number): PendingAttachment {
  return { height: 600, localId: `local-${index}`, mimeType: 'image/jpeg', uri: `file://image-${index}.jpg`, width: 800 };
}

describe('attachment components', () => {
  it('enforces the five-image limit', () => {
    jest.mocked(ImagePicker.launchCameraAsync).mockClear();
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockClear();
    render(<AttachmentPicker onChange={jest.fn()} value={[0, 1, 2, 3, 4].map(asset)} />);
    expect(screen.getByText('5 de 5')).toBeTruthy();
    fireEvent.press(screen.getByText('Cámara'));
    fireEvent.press(screen.getByText('Galería'));
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('rejects invalid files without adding them', async () => {
    const onChange = jest.fn();
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ height: 10, mimeType: 'application/pdf', uri: 'file://document.pdf', width: 10 }],
    });
    render(<AttachmentPicker onChange={onChange} value={[]} />);
    fireEvent.press(screen.getByText('Galería'));
    await waitFor(() => expect(screen.getByText('Solo se admiten imágenes JPG, PNG o WebP.')).toBeTruthy());
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('renders a private signed image in the gallery and opens its viewer', () => {
    render(<AttachmentGallery attachments={[{
      attachmentType: 'request_evidence', createdAt: '2026-07-28T00:00:00Z', fileSizeBytes: 4,
      id: 'attachment-1', jobId: null, mimeType: 'image/jpeg', ownerId: 'customer-1',
      serviceRequestId: 'request-1', signedUrl: 'https://signed.example/image', sortOrder: 0,
    }]} />);
    fireEvent.press(screen.getByLabelText('Ampliar imagen 1'));
    expect(screen.getByText('Cerrar imagen')).toBeTruthy();
  });
});
