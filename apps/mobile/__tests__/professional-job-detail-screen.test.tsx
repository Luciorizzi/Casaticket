import type { Job, JobQuote } from '@casaticket/types';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockCreateProfessionalJobQuote = jest.fn();
const mockGetProfessionalJobById = jest.fn();
const mockListJobQuotes = jest.fn();
const mockProposeProfessionalJobVisit = jest.fn();
const mockRecordProfessionalJobDiagnosis = jest.fn();
const mockSendProfessionalJobQuote = jest.fn();
let mockDatePickerDate = new Date(2099, 6, 22);

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
  },
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    __esModule: true,
    default: ({ onChange }: { onChange: (event: { type: string }, date?: Date) => void }) => (
      <Pressable onPress={() => onChange({ type: 'set' }, mockDatePickerDate)} testID="mock-date-time-picker">
        <Text>Mock calendar</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/features/jobs/api', () => ({
  createProfessionalJobQuote: (...args: unknown[]) => mockCreateProfessionalJobQuote(...args),
  getProfessionalJobById: (...args: unknown[]) => mockGetProfessionalJobById(...args),
  jobQuotesQueryKey: (jobId: string) => ['job-quotes', jobId],
  listJobQuotes: (...args: unknown[]) => mockListJobQuotes(...args),
  professionalJobQueryKey: (jobId: string) => ['professional-job', jobId],
  proposeProfessionalJobVisit: (...args: unknown[]) => mockProposeProfessionalJobVisit(...args),
  recordProfessionalJobDiagnosis: (...args: unknown[]) => mockRecordProfessionalJobDiagnosis(...args),
  sendProfessionalJobQuote: (...args: unknown[]) => mockSendProfessionalJobQuote(...args),
}));

import { ProfessionalJobDetailScreen } from '@/features/jobs/professional-job-detail-screen';

const activeQueryClients: QueryClient[] = [];

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    requestId: 'request-1',
    selectedApplicationId: 'application-1',
    customerId: 'customer-1',
    professionalId: 'professional-1',
    status: 'coordination_pending',
    scheduledDate: null,
    scheduledTimeText: null,
    schedulingNotes: null,
    diagnosisText: null,
    recommendedWorkText: null,
    materialsNotes: null,
    diagnosisNotes: null,
    diagnosedAt: null,
    createdAt: '2026-07-21T10:00:00.000Z',
    updatedAt: '2026-07-21T10:00:00.000Z',
    ...overrides,
  };
}

function createQuote(overrides: Partial<JobQuote> = {}): JobQuote {
  return {
    id: 'quote-1',
    jobId: 'job-1',
    version: 1,
    laborAmount: 10000,
    materialsAmount: 2500,
    visitAmount: 1500,
    platformFeeAmount: 500,
    totalAmount: 12000,
    currency: 'ARS',
    description: 'Presupuesto formal con detalle de tareas y materiales necesarios.',
    estimatedDurationText: 'Un día',
    validUntil: null,
    status: 'draft',
    rejectedReason: null,
    createdAt: '2026-07-21T10:00:00.000Z',
    updatedAt: '2026-07-21T10:00:00.000Z',
    acceptedAt: null,
    rejectedAt: null,
    ...overrides,
  };
}

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        gcTime: Number.POSITIVE_INFINITY,
      },
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    },
  });
  activeQueryClients.push(queryClient);

  render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);

  return queryClient;
}

describe('professional job detail screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatePickerDate = new Date(2099, 6, 22);
    mockGetProfessionalJobById.mockResolvedValue(createJob());
    mockListJobQuotes.mockResolvedValue([]);
    mockProposeProfessionalJobVisit.mockResolvedValue(
      createJob({
        scheduledDate: '2099-07-22',
        scheduledTimeText: '10 a 12',
        schedulingNotes: 'Tocar timbre.',
        status: 'visit_proposed',
      }),
    );
    mockRecordProfessionalJobDiagnosis.mockResolvedValue(
      createJob({
        diagnosisText: 'Diagnóstico técnico suficientemente detallado.',
        recommendedWorkText: 'Reemplazar piezas dañadas.',
        materialsNotes: 'Llevar repuestos.',
        status: 'quote_pending',
      }),
    );
    mockCreateProfessionalJobQuote.mockResolvedValue(createQuote());
    mockSendProfessionalJobQuote.mockResolvedValue(createQuote({ status: 'sent' }));
  });

  afterEach(() => {
    cleanup();
    activeQueryClients.splice(0).forEach((queryClient) => queryClient.clear());
  });

  it('loads a job accessible by the selected professional', async () => {
    renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('Proponer visita').length).toBeGreaterThan(0);
    });

    expect(mockGetProfessionalJobById).toHaveBeenCalledWith('job-1');
  });

  it('shows an access error when the professional is not selected', async () => {
    mockGetProfessionalJobById.mockRejectedValueOnce(new Error('permission denied'));

    renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByText('El trabajo no existe o no tenés permiso para verlo.')).toBeTruthy();
    });
  });

  it('proposes a visit using the calendar date and updates the job status', async () => {
    const queryClient = renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByText('📅 Seleccionar fecha')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('📅 Seleccionar fecha'));
    fireEvent.press(screen.getByTestId('mock-date-time-picker'));
    fireEvent.changeText(screen.getByPlaceholderText('Horario'), '10 a 12');
    fireEvent.changeText(screen.getByPlaceholderText('Notas de coordinación'), 'Tocar timbre.');
    fireEvent.press(screen.getAllByText('Proponer visita').at(-1)!);

    await waitFor(() => {
      expect(mockProposeProfessionalJobVisit).toHaveBeenCalledWith('job-1', {
        scheduledDate: '2099-07-22',
        scheduledTimeText: '10 a 12',
        schedulingNotes: 'Tocar timbre.',
      });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Visita propuesta').length).toBeGreaterThan(0);
    });

    expect(queryClient.getQueryData(['professional-job', 'job-1'])).toMatchObject({
      status: 'visit_proposed',
    });
  });

  it('rejects past dates before submitting', async () => {
    mockDatePickerDate = new Date(2000, 0, 1);
    renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByText('📅 Seleccionar fecha')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('📅 Seleccionar fecha'));
    fireEvent.press(screen.getByTestId('mock-date-time-picker'));
    fireEvent.changeText(screen.getByPlaceholderText('Horario'), '10 a 12');
    fireEvent.press(screen.getAllByText('Proponer visita').at(-1)!);

    expect(screen.getByText('La fecha debe ser futura.')).toBeTruthy();
    expect(mockProposeProfessionalJobVisit).not.toHaveBeenCalled();
  });

  it.each([
    ['visit_proposed', 'La propuesta está pendiente de confirmación del cliente.'],
    ['visit_confirmed', 'Registrar diagnóstico'],
    ['quote_pending', 'Crear presupuesto'],
    ['quote_sent', 'Esperando respuesta del cliente.'],
    ['quote_accepted', 'El cliente aceptó el presupuesto.'],
    ['quote_rejected', 'Crear nueva versión'],
  ] as const)('shows the expected action for %s', async (status, expectedText) => {
    mockGetProfessionalJobById.mockResolvedValueOnce(createJob({ status }));

    renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.queryAllByText(expectedText).length).toBeGreaterThan(0);
      expect(screen.queryByText(status)).toBeNull();
    });
  });

  it('records diagnosis and moves the job to quote pending', async () => {
    mockGetProfessionalJobById.mockResolvedValueOnce(createJob({ status: 'visit_confirmed' }));
    const queryClient = renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Qué encontraste durante la visita')).toBeTruthy();
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('Qué encontraste durante la visita'),
      'Diagnóstico técnico suficientemente detallado.',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Qué conviene hacer para resolverlo'),
      'Reemplazar piezas dañadas.',
    );
    fireEvent.changeText(screen.getByPlaceholderText('Materiales necesarios u observaciones'), 'Llevar repuestos.');
    fireEvent.press(screen.getByText('Guardar diagnóstico'));

    await waitFor(() => {
      expect(mockRecordProfessionalJobDiagnosis).toHaveBeenCalledWith('job-1', {
        diagnosisText: 'Diagnóstico técnico suficientemente detallado.',
        recommendedWorkText: 'Reemplazar piezas dañadas.',
        materialsNotes: 'Llevar repuestos.',
        diagnosisNotes: null,
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(['professional-job', 'job-1'])).toMatchObject({
        status: 'quote_pending',
      });
    });
  });

  it('creates a quote draft without editable platform fee and sends it as sent', async () => {
    mockGetProfessionalJobById.mockResolvedValueOnce(createJob({ status: 'quote_pending' }));
    const queryClient = renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Mano de obra')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Mano de obra'), '10000');
    expect(screen.queryByPlaceholderText('Comisión de plataforma')).toBeNull();
    expect(screen.getByText('Comisión CasaTicket (5%): $ 500')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Materiales aproximados'), '2500');
    fireEvent.changeText(screen.getByPlaceholderText('Visita'), '1500');
    expect(screen.getByText('Total del servicio: $ 12.000')).toBeTruthy();
    fireEvent.changeText(
      screen.getByPlaceholderText('Descripción formal del presupuesto'),
      'Presupuesto formal con detalle de tareas y materiales necesarios.',
    );
    fireEvent.changeText(screen.getByPlaceholderText('Duración estimada'), 'Un día');
    fireEvent.press(screen.getByText('📅 Seleccionar vigencia'));
    fireEvent.press(screen.getByTestId('mock-date-time-picker'));
    fireEvent.press(screen.getByText('Guardar borrador'));

    await waitFor(() => {
      expect(mockCreateProfessionalJobQuote).toHaveBeenCalledWith('job-1', {
        description: 'Presupuesto formal con detalle de tareas y materiales necesarios.',
        estimatedDurationText: 'Un día',
        laborAmount: 10000,
        materialsAmount: 2500,
        validUntil: '2099-07-22',
        visitAmount: 1500,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Enviar presupuesto')).toBeTruthy();
    });

    queryClient.setQueryData(['professional-job', 'job-1'], createJob({ status: 'quote_pending' }));
    fireEvent.press(screen.getByText('Enviar presupuesto'));

    await waitFor(() => {
      expect(mockSendProfessionalJobQuote.mock.calls[0]?.[0]).toBe('quote-1');
    });
    await waitFor(() => {
      expect(screen.queryAllByText('Presupuesto enviado').length).toBeGreaterThan(0);
      expect(screen.getByText('Total del servicio')).toBeTruthy();
      expect(screen.getByText('$ 12.000')).toBeTruthy();
    });
  });
});
