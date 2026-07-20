import type { Category } from '@casaticket/types';

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TextInput as NativeTextInput } from 'react-native';

import { ServiceRequestForm } from '@/features/customer/service-request-form';

const categories: Category[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Plomeria',
    slug: 'plomeria',
    description: null,
    active: true,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
  },
];

const initialValues = {
  title: '',
  description: '',
  categoryId: null,
  unsureCategory: false,
  requestType: 'quote' as const,
  urgency: 'flexible' as const,
  addressText: '',
  city: '',
  province: '',
  preferredDate: null,
  preferredTimeText: null,
  availabilityNotes: null,
};

function renderForm(onSubmit = jest.fn().mockResolvedValue(undefined)) {
  render(
    <ServiceRequestForm
      categories={categories}
      initialValues={initialValues}
      onSubmit={onSubmit}
    />,
  );

  return onSubmit;
}

function fillValidRequestForm() {
  const inputs = screen.UNSAFE_getAllByType(NativeTextInput);

  fireEvent.changeText(inputs[0], 'Arreglo de pérdida');
  fireEvent.changeText(
    inputs[1],
    'Tengo una pérdida debajo de la bacha de la cocina y necesito resolverla.',
  );
  fireEvent.press(screen.getByText('Plomeria'));
  fireEvent.changeText(inputs[2], 'Calle 123');
  fireEvent.changeText(inputs[3], 'Lanus');
  fireEvent.changeText(inputs[4], 'Buenos Aires');
}

describe('ServiceRequestForm', () => {
  it('prevents submit and shows validation errors when required fields are missing', async () => {
    const onSubmit = renderForm();

    fireEvent.press(screen.getByText('Publicar solicitud'));

    await waitFor(() => {
      expect(screen.getByText('El título es obligatorio.')).toBeTruthy();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects preferred dates in the past', async () => {
    const onSubmit = renderForm();
    fillValidRequestForm();
    const inputs = screen.UNSAFE_getAllByType(NativeTextInput);
    fireEvent.changeText(inputs[5], '2020-01-01');

    fireEvent.press(screen.getByText('Publicar solicitud'));

    await waitFor(() => {
      expect(screen.getByText('La fecha preferida no puede estar en el pasado.')).toBeTruthy();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks duplicate submit while the first submit is pending', async () => {
    const onSubmit = jest.fn(
      () =>
        new Promise<void>(() => {
          // Keep the submit pending to assert the disabled state.
        }),
    );
    renderForm(onSubmit);
    fillValidRequestForm();

    fireEvent.press(screen.getByText('Publicar solicitud'));

    await waitFor(() => {
      expect(screen.getByText('Publicando...')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Publicando...'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
