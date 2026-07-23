import type { Job, JobPayment, JobQuote, JobReview } from '@casaticket/types';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockBack = jest.fn();
const mockCompleteProfessionalJob = jest.fn();
const mockCreateJobReview = jest.fn();
const mockCreateProfessionalJobQuote = jest.fn();
const mockGetJobPayment = jest.fn();
const mockGetProfessionalJobById = jest.fn();
const mockListJobReviews = jest.fn();
const mockListJobQuotes = jest.fn();
const mockProposeProfessionalJobVisit = jest.fn();
const mockRecordProfessionalJobDiagnosis = jest.fn();
const mockSendProfessionalJobQuote = jest.fn();
const mockStartProfessionalJob = jest.fn();
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
  completeProfessionalJob: (...args: unknown[]) => mockCompleteProfessionalJob(...args),
  createJobReview: (...args: unknown[]) => mockCreateJobReview(...args),
  createProfessionalJobQuote: (...args: unknown[]) => mockCreateProfessionalJobQuote(...args),
  getJobPayment: (...args: unknown[]) => mockGetJobPayment(...args),
  getProfessionalJobById: (...args: unknown[]) => mockGetProfessionalJobById(...args),
  jobPaymentQueryKey: (jobId: string) => ['job-payment', jobId],
  jobQuotesQueryKey: (jobId: string) => ['job-quotes', jobId],
  jobReviewsQueryKey: (jobId: string) => ['job-reviews', jobId],
  listJobReviews: (...args: unknown[]) => mockListJobReviews(...args),
  listJobQuotes: (...args: unknown[]) => mockListJobQuotes(...args),
  professionalJobQueryKey: (jobId: string) => ['professional-job', jobId],
  proposeProfessionalJobVisit: (...args: unknown[]) => mockProposeProfessionalJobVisit(...args),
  recordProfessionalJobDiagnosis: (...args: unknown[]) => mockRecordProfessionalJobDiagnosis(...args),
  sendProfessionalJobQuote: (...args: unknown[]) => mockSendProfessionalJobQuote(...args),
  startProfessionalJob: (...args: unknown[]) => mockStartProfessionalJob(...args),
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
    startedAt: null,
    completionSummary: null,
    finalNotes: null,
    finalMaterialsNotes: null,
    finalMaterialsAmount: null,
    professionalCompletedAt: null,
    customerConfirmedAt: null,
    disputeReason: null,
    disputeDetails: null,
    disputedAt: null,
    reviewDeadlineAt: null,
    completionMode: null,
    createdAt: '2026-07-21T10:00:00.000Z',
    updatedAt: '2026-07-21T10:00:00.000Z',
    ...overrides,
  };
}

function createPayment(overrides: Partial<JobPayment> = {}): JobPayment {
  return {
    id: 'payment-1',
    jobId: 'job-1',
    quoteId: 'quote-1',
    customerId: 'customer-1',
    professionalId: 'professional-1',
    status: 'secured',
    provider: 'mock',
    providerPaymentId: 'mock-payment-1',
    currency: 'ARS',
    laborAmount: 10000,
    visitAmount: 1500,
    materialsReferenceAmount: 2500,
    platformFeeAmount: 500,
    customerTotalAmount: 12000,
    professionalAmount: 11500,
    releasedAmount: null,
    failureReason: null,
    paidAt: '2026-07-21T10:30:00.000Z',
    securedAt: '2026-07-21T10:30:00.000Z',
    releasePendingAt: null,
    releasedAt: null,
    refundedAt: null,
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

function createReview(overrides: Partial<JobReview> = {}): JobReview {
  return {
    id: 'review-1',
    jobId: 'job-1',
    reviewerUserId: 'professional-user-1',
    reviewedUserId: 'customer-1',
    reviewerRole: 'professional',
    rating: 5,
    comment: 'Excelente cliente.',
    createdAt: '2026-07-21T10:00:00.000Z',
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
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text !== 'Volver')?.onPress?.();
    });
    mockDatePickerDate = new Date(2099, 6, 22);
    mockGetProfessionalJobById.mockResolvedValue(createJob());
    mockGetJobPayment.mockResolvedValue(null);
    mockListJobReviews.mockResolvedValue([]);
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
    mockStartProfessionalJob.mockResolvedValue(
      createJob({ startedAt: '2026-07-21T11:00:00.000Z', status: 'in_progress' }),
    );
    mockCompleteProfessionalJob.mockResolvedValue(
      createJob({
        completionSummary: 'Trabajo realizado y verificado con funcionamiento correcto.',
        finalMaterialsAmount: 2500,
        finalMaterialsNotes: 'Repuesto y sellador.',
        finalNotes: 'Se recomienda revisar en 30 días.',
        professionalCompletedAt: '2026-07-21T12:00:00.000Z',
        reviewDeadlineAt: '2026-07-23T12:00:00.000Z',
        status: 'review_pending',
      }),
    );
    mockCreateJobReview.mockResolvedValue(createReview());
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
    ['payment_pending', 'Esperando pago protegido del cliente.'],
    ['ready_to_start', 'Iniciar trabajo'],
    ['in_progress', 'Marcar trabajo como terminado'],
    ['review_pending', 'El pago sigue protegido hasta que el cliente confirme o venza la ventana de reclamo.'],
    ['quote_rejected', 'Crear nueva versión'],
  ] as const)('shows the expected action for %s', async (status, expectedText) => {
    mockGetProfessionalJobById.mockResolvedValueOnce(createJob({ status }));
    if (status === 'ready_to_start') {
      mockGetJobPayment.mockResolvedValueOnce(createPayment({ status: 'secured' }));
    }

    renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.queryAllByText(expectedText).length).toBeGreaterThan(0);
      expect(screen.queryByText(status)).toBeNull();
    });
  });

  it('starts a job only after protected payment is secured', async () => {
    mockGetProfessionalJobById.mockResolvedValueOnce(createJob({ status: 'ready_to_start' }));
    mockGetJobPayment.mockResolvedValueOnce(createPayment({ status: 'secured' }));
    const queryClient = renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByText('Iniciar trabajo')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Iniciar trabajo'));

    await waitFor(() => {
      expect(mockStartProfessionalJob).toHaveBeenCalledWith('job-1');
    });
    expect(queryClient.getQueryData(['professional-job', 'job-1'])).toMatchObject({
      status: 'in_progress',
    });
  });

  it('marks an in-progress job as pending customer review', async () => {
    mockGetProfessionalJobById.mockResolvedValueOnce(createJob({ status: 'in_progress' }));
    const queryClient = renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Contá qué trabajo realizaste')).toBeTruthy();
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('Contá qué trabajo realizaste'),
      'Trabajo realizado y verificado con funcionamiento correcto.',
    );
    fireEvent.changeText(screen.getByPlaceholderText('Observaciones opcionales'), 'Se recomienda revisar en 30 días.');
    fireEvent.changeText(screen.getByPlaceholderText('Materiales utilizados'), 'Repuesto y sellador.');
    fireEvent.changeText(screen.getByPlaceholderText('Importe informativo'), '2500');
    fireEvent.press(screen.getAllByText('Marcar trabajo como terminado').at(-1)!);

    await waitFor(() => {
      expect(mockCompleteProfessionalJob).toHaveBeenCalledWith('job-1', {
        completionSummary: 'Trabajo realizado y verificado con funcionamiento correcto.',
        finalMaterialsAmount: 2500,
        finalMaterialsNotes: 'Repuesto y sellador.',
        finalNotes: 'Se recomienda revisar en 30 días.',
      });
    });
    expect(queryClient.getQueryData(['professional-job', 'job-1'])).toMatchObject({
      status: 'review_pending',
    });
  });

  it('validates completion summary before submitting', async () => {
    mockGetProfessionalJobById.mockResolvedValueOnce(createJob({ status: 'in_progress' }));
    renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Contá qué trabajo realizaste')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Contá qué trabajo realizaste'), 'Corto');
    fireEvent.press(screen.getAllByText('Marcar trabajo como terminado').at(-1)!);

    expect(screen.getByText('El resumen debe tener al menos 20 caracteres.')).toBeTruthy();
    expect(mockCompleteProfessionalJob).not.toHaveBeenCalled();
  });

  it('creates a professional review after completion', async () => {
    mockGetProfessionalJobById.mockResolvedValueOnce(createJob({ status: 'completed' }));
    mockGetJobPayment.mockResolvedValueOnce(createPayment({ releasedAt: '2026-07-21T14:00:00.000Z', status: 'released' }));
    const queryClient = renderWithQueryClient(<ProfessionalJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('Calificar cliente').length).toBeGreaterThan(0);
    });

    fireEvent.changeText(screen.getByPlaceholderText('1 a 5'), '5');
    fireEvent.changeText(screen.getByPlaceholderText('Comentario opcional'), 'Excelente cliente.');
    fireEvent.press(screen.getAllByText('Calificar cliente').at(-1)!);

    await waitFor(() => {
      expect(mockCreateJobReview).toHaveBeenCalledWith('job-1', {
        comment: 'Excelente cliente.',
        rating: 5,
      });
    });
    expect(queryClient.getQueryData(['job-reviews', 'job-1'])).toMatchObject([
      { reviewerRole: 'professional', rating: 5 },
    ]);
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
      expect(screen.getByText(/v1 · Enviado/)).toBeTruthy();
      expect(screen.queryByText('Total del servicio')).toBeNull();
    });
  });
});
