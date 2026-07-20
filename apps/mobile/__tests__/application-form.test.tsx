import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TextInput as NativeTextInput } from 'react-native';

import { ApplicationForm } from '@/features/professional/application-form';

function renderForm(onSubmit = jest.fn().mockResolvedValue(undefined)) {
  render(<ApplicationForm onSubmit={onSubmit} />);

  return onSubmit;
}

function fillValidDiagnosticVisitForm() {
  const inputs = screen.UNSAFE_getAllByType(NativeTextInput);

  fireEvent.changeText(
    inputs[0],
    'Puedo revisar el problema esta semana y llevar las herramientas necesarias.',
  );
  fireEvent.changeText(inputs[1], 'Martes o jueves por la tarde.');
  fireEvent.changeText(inputs[2], '5000');
}

describe('ApplicationForm', () => {
  it('prevents submit and shows validation errors when required fields are missing', async () => {
    const onSubmit = renderForm();

    fireEvent.press(screen.getByText('Enviar postulación'));

    await waitFor(() => {
      expect(screen.getByText('El mensaje es obligatorio.')).toBeTruthy();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires visit price for diagnostic visit proposals', async () => {
    const onSubmit = renderForm();
    const inputs = screen.UNSAFE_getAllByType(NativeTextInput);
    fireEvent.changeText(
      inputs[0],
      'Puedo revisar el problema esta semana y llevar las herramientas necesarias.',
    );
    fireEvent.changeText(inputs[1], 'Martes o jueves por la tarde.');

    fireEvent.press(screen.getByText('Enviar postulación'));

    await waitFor(() => {
      expect(screen.getByText('Indicá el precio de la visita diagnóstica.')).toBeTruthy();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects negative prices', async () => {
    const onSubmit = renderForm();
    const inputs = screen.UNSAFE_getAllByType(NativeTextInput);
    fireEvent.changeText(
      inputs[0],
      'Puedo revisar el problema esta semana y llevar las herramientas necesarias.',
    );
    fireEvent.changeText(inputs[1], 'Martes o jueves por la tarde.');
    fireEvent.changeText(inputs[2], '-1');

    fireEvent.press(screen.getByText('Enviar postulación'));

    await waitFor(() => {
      expect(screen.getByText('El precio no puede ser negativo.')).toBeTruthy();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks duplicate submit while pending', async () => {
    const onSubmit = jest.fn(
      () =>
        new Promise<void>(() => {
          // Keep pending.
        }),
    );
    renderForm(onSubmit);
    fillValidDiagnosticVisitForm();

    fireEvent.press(screen.getByText('Enviar postulación'));

    await waitFor(() => {
      expect(screen.getByText('Enviando...')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Enviando...'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
