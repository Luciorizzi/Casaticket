import type { Job, JobPayment, JobQuote, JobReview } from '@casaticket/types';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockAcceptCustomerJobQuote = jest.fn();
const mockConfirmCustomerJobCompletion = jest.fn();
const mockConfirmCustomerJobVisit = jest.fn();
const mockCreateJobReview = jest.fn();
const mockDisputeCustomerJobCompletion = jest.fn();
const mockGetCustomerJobById = jest.fn();
const mockGetCustomerJobByRequest = jest.fn();
const mockGetJobPayment = jest.fn();
const mockListJobReviews = jest.fn();
const mockListJobQuotes = jest.fn();
const mockProcessPayment = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockRejectCustomerJobQuote = jest.fn();
const mockRejectCustomerJobVisit = jest.fn();
const mockRetryMockPayment = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/features/jobs/api', () => ({
  acceptCustomerJobQuote: (...args: unknown[]) => mockAcceptCustomerJobQuote(...args),
  confirmCustomerJobCompletion: (...args: unknown[]) => mockConfirmCustomerJobCompletion(...args),
  confirmCustomerJobVisit: (...args: unknown[]) => mockConfirmCustomerJobVisit(...args),
  createJobReview: (...args: unknown[]) => mockCreateJobReview(...args),
  customerJobByIdQueryKey: (jobId: string) => ['customer-job-by-id', jobId],
  customerJobQueryKey: (requestId: string) => ['customer-job', requestId],
  disputeCustomerJobCompletion: (...args: unknown[]) => mockDisputeCustomerJobCompletion(...args),
  getCustomerJobById: (...args: unknown[]) => mockGetCustomerJobById(...args),
  getCustomerJobByRequest: (...args: unknown[]) => mockGetCustomerJobByRequest(...args),
  getJobPayment: (...args: unknown[]) => mockGetJobPayment(...args),
  jobPaymentQueryKey: (jobId: string) => ['job-payment', jobId],
  jobQuotesQueryKey: (jobId: string) => ['job-quotes', jobId],
  jobReviewsQueryKey: (jobId: string) => ['job-reviews', jobId],
  listJobReviews: (...args: unknown[]) => mockListJobReviews(...args),
  listJobQuotes: (...args: unknown[]) => mockListJobQuotes(...args),
  mockPaymentProvider: {
    processPayment: (...args: unknown[]) => mockProcessPayment(...args),
  },
  rejectCustomerJobQuote: (...args: unknown[]) => mockRejectCustomerJobQuote(...args),
  rejectCustomerJobVisit: (...args: unknown[]) => mockRejectCustomerJobVisit(...args),
  retryMockPayment: (...args: unknown[]) => mockRetryMockPayment(...args),
}));

import { CustomerJobDetailScreen, CustomerJobPanel, CustomerJobSummaryPanel } from '@/features/jobs/customer-job-panel';

const activeQueryClients: QueryClient[] = [];

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    requestId: 'request-1',
    selectedApplicationId: 'application-1',
    customerId: 'customer-1',
    professionalId: 'professional-1',
    status: 'visit_proposed',
    scheduledDate: '2099-07-22',
    scheduledTimeText: '10 a 12',
    schedulingNotes: 'Tocar timbre.',
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
    status: 'pending',
    provider: 'mock',
    providerPaymentId: null,
    currency: 'ARS',
    laborAmount: 10000,
    visitAmount: 1500,
    materialsReferenceAmount: 2500,
    platformFeeAmount: 500,
    customerTotalAmount: 12000,
    professionalAmount: 11500,
    releasedAmount: null,
    failureReason: null,
    paidAt: null,
    securedAt: null,
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
    status: 'sent',
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
    reviewerUserId: 'customer-1',
    reviewedUserId: 'professional-user-1',
    reviewerRole: 'customer',
    rating: 5,
    comment: 'Trabajo muy prolijo.',
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

describe('customer job panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text !== 'Volver')?.onPress?.();
    });
    mockCanGoBack.mockReturnValue(true);
    mockGetCustomerJobByRequest.mockResolvedValue(createJob());
    mockGetCustomerJobById.mockResolvedValue(createJob());
    mockGetJobPayment.mockResolvedValue(null);
    mockListJobReviews.mockResolvedValue([]);
    mockListJobQuotes.mockResolvedValue([]);
    mockConfirmCustomerJobVisit.mockResolvedValue(createJob({ status: 'visit_confirmed' }));
    mockRejectCustomerJobVisit.mockResolvedValue(createJob({ status: 'coordination_pending' }));
    mockAcceptCustomerJobQuote.mockResolvedValue({
      jobId: 'job-1',
      jobStatus: 'payment_pending',
      payment: createPayment(),
    });
    mockRetryMockPayment.mockResolvedValue(createPayment());
    mockProcessPayment.mockResolvedValue(createPayment({ securedAt: '2026-07-21T11:00:00.000Z', status: 'secured' }));
    mockRejectCustomerJobQuote.mockResolvedValue({ jobId: 'job-1', jobStatus: 'quote_rejected' });
    mockConfirmCustomerJobCompletion.mockResolvedValue(
      createJob({ customerConfirmedAt: '2026-07-21T13:00:00.000Z', status: 'completed' }),
    );
    mockDisputeCustomerJobCompletion.mockResolvedValue(
      createJob({
        disputeDetails: 'El trabajo informado no resolvió el problema principal.',
        disputeReason: 'No quedó resuelto',
        disputedAt: '2026-07-21T13:00:00.000Z',
        status: 'disputed',
      }),
    );
    mockCreateJobReview.mockResolvedValue(createReview());
  });

  afterEach(() => {
    cleanup();
    activeQueryClients.splice(0).forEach((queryClient) => queryClient.clear());
  });

  it('confirms a proposed visit and updates cache', async () => {
    const queryClient = renderWithQueryClient(<CustomerJobPanel requestId="request-1" />);

    await waitFor(() => {
      expect(screen.getByText('Confirmar visita')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Confirmar visita'));

    await waitFor(() => {
      expect(mockConfirmCustomerJobVisit).toHaveBeenCalledWith('job-1');
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(['customer-job', 'request-1'])).toMatchObject({
        status: 'visit_confirmed',
      });
    });
  });

  it('shows only a compact work process summary and navigates by real job id', async () => {
    mockGetCustomerJobByRequest.mockResolvedValueOnce(
      createJob({
        diagnosisText: 'Diagnóstico técnico suficientemente detallado.',
        recommendedWorkText: 'Reemplazar piezas dañadas.',
        status: 'quote_sent',
      }),
    );
    mockListJobQuotes.mockResolvedValueOnce([createQuote()]);

    renderWithQueryClient(<CustomerJobSummaryPanel requestId="request-1" />);

    await waitFor(() => {
      expect(screen.getByText('Presupuesto')).toBeTruthy();
    });

    expect(screen.getByText('Proceso del trabajo')).toBeTruthy();
    expect(screen.getByText('Profesional')).toBeTruthy();
    expect(screen.getByText('Presupuesto')).toBeTruthy();
    expect(screen.getByText(/v1 · Enviado/)).toBeTruthy();
    expect(screen.getAllByText('›').length).toBeGreaterThan(0);
    expect(screen.queryByText('Confirmar coordinación')).toBeNull();
    expect(screen.queryByText('Responder presupuesto')).toBeNull();
    expect(screen.queryByText('Ver progreso del trabajo')).toBeNull();

    fireEvent.press(screen.getByLabelText(/Presupuesto: v1/));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(customer)/jobs/[jobId]',
      params: { jobId: 'job-1' },
    });
  });

  it('loads the operational job detail from the dedicated customer job route', async () => {
    mockGetCustomerJobById.mockResolvedValueOnce(createJob({ status: 'visit_proposed' }));

    renderWithQueryClient(<CustomerJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(mockGetCustomerJobById).toHaveBeenCalledWith('job-1');
    });
    await waitFor(() => {
      expect(screen.getByText('Confirmar visita')).toBeTruthy();
    });
  });

  it('returns from work progress using navigation history', async () => {
    mockGetCustomerJobById.mockResolvedValueOnce(createJob({ requestId: 'request-1' }));

    renderWithQueryClient(<CustomerJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByText('Confirmar visita')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Volver').parent!);

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalledWith({
      pathname: '/(customer)/requests/[id]',
      params: { id: 'request-1' },
    });
  });

  it('falls back to the related request when work progress has no history', async () => {
    mockCanGoBack.mockReturnValue(false);
    mockGetCustomerJobById.mockResolvedValueOnce(createJob({ requestId: 'request-1' }));

    renderWithQueryClient(<CustomerJobDetailScreen jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByText('Confirmar visita')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Volver').parent!);

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(customer)/requests/[id]',
      params: { id: 'request-1' },
    });
  });

  it('shows sent quote and rejects it with optional reason', async () => {
    mockGetCustomerJobByRequest.mockResolvedValueOnce(
      createJob({
        diagnosisText: 'Diagnóstico técnico suficientemente detallado.',
        recommendedWorkText: 'Reemplazar piezas dañadas.',
        status: 'quote_sent',
      }),
    );
    mockListJobQuotes.mockResolvedValueOnce([createQuote()]);

    renderWithQueryClient(<CustomerJobPanel requestId="request-1" />);

    await waitFor(() => {
      expect(screen.getByText('Aceptar presupuesto')).toBeTruthy();
    });
    expect(screen.getByText('Presupuesto')).toBeTruthy();
    expect(screen.getByText(/v1 · Enviado/)).toBeTruthy();
    expect(screen.queryByText('Materiales no incluidos en el total final.')).toBeNull();
    expect(screen.queryByText('Total final')).toBeNull();

    fireEvent.changeText(screen.getByPlaceholderText('Motivo opcional del rechazo'), 'Necesito ajustar materiales.');
    fireEvent.press(screen.getByText('Rechazar presupuesto'));

    await waitFor(() => {
      expect(mockRejectCustomerJobQuote).toHaveBeenCalledWith('quote-1', {
        rejectedReason: 'Necesito ajustar materiales.',
      });
    });
  });

  it('accepts a quote, creates a pending payment and secures it with the mock provider', async () => {
    mockGetCustomerJobByRequest.mockResolvedValueOnce(
      createJob({
        diagnosisText: 'Diagnóstico técnico suficientemente detallado.',
        recommendedWorkText: 'Reemplazar piezas dañadas.',
        status: 'quote_sent',
      }),
    );
    mockListJobQuotes.mockResolvedValueOnce([createQuote()]);
    const queryClient = renderWithQueryClient(<CustomerJobPanel requestId="request-1" />);

    await waitFor(() => {
      expect(screen.getByText('Aceptar presupuesto')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Aceptar presupuesto'));

    await waitFor(() => {
      expect(mockAcceptCustomerJobQuote.mock.calls[0]?.[0]).toBe('quote-1');
      expect(queryClient.getQueryData(['customer-job', 'request-1'])).toMatchObject({
        status: 'payment_pending',
      });
      expect(queryClient.getQueryData(['job-payment', 'job-1'])).toMatchObject({
        status: 'pending',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Pagar y asegurar el trabajo')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Pagar y asegurar el trabajo'));

    await waitFor(() => {
      expect(mockProcessPayment).toHaveBeenCalledWith('payment-1', {
        approved: true,
        failureReason: null,
      });
      expect(queryClient.getQueryData(['customer-job', 'request-1'])).toMatchObject({
        status: 'ready_to_start',
      });
    });
  });

  it('confirms professional completion and updates cache', async () => {
    mockGetCustomerJobByRequest.mockResolvedValueOnce(
      createJob({
        completionSummary: 'Trabajo realizado y verificado con funcionamiento correcto.',
        finalMaterialsNotes: 'Repuesto y sellador.',
        professionalCompletedAt: '2026-07-21T12:00:00.000Z',
        status: 'completion_pending',
      }),
    );
    mockListJobQuotes.mockResolvedValueOnce([createQuote({ status: 'accepted' })]);
    const queryClient = renderWithQueryClient(<CustomerJobPanel requestId="request-1" />);

    await waitFor(() => {
      expect(screen.getByText('Confirmar trabajo terminado')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Confirmar trabajo terminado'));

    await waitFor(() => {
      expect(mockConfirmCustomerJobCompletion).toHaveBeenCalledWith('job-1');
    });
    expect(queryClient.getQueryData(['customer-job', 'request-1'])).toMatchObject({
      status: 'completed',
    });
  });

  it('requires a detailed reason before disputing completion', async () => {
    mockGetCustomerJobByRequest.mockResolvedValueOnce(
      createJob({
        completionSummary: 'Trabajo realizado y verificado con funcionamiento correcto.',
        status: 'completion_pending',
      }),
    );

    renderWithQueryClient(<CustomerJobPanel requestId="request-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Motivo')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Motivo'), 'Falla');
    fireEvent.changeText(screen.getByPlaceholderText('Detalle del problema'), 'Muy corto');
    fireEvent.press(screen.getAllByText('Reportar un problema').at(-1)!);

    expect(screen.getByText('El detalle debe tener al menos 20 caracteres.')).toBeTruthy();
    expect(mockDisputeCustomerJobCompletion).not.toHaveBeenCalled();
  });

  it('reports a completion problem with required details', async () => {
    mockGetCustomerJobByRequest.mockResolvedValueOnce(
      createJob({
        completionSummary: 'Trabajo realizado y verificado con funcionamiento correcto.',
        status: 'completion_pending',
      }),
    );
    const queryClient = renderWithQueryClient(<CustomerJobPanel requestId="request-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Motivo')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Motivo'), 'No quedó resuelto');
    fireEvent.changeText(
      screen.getByPlaceholderText('Detalle del problema'),
      'El trabajo informado no resolvió el problema principal.',
    );
    fireEvent.press(screen.getAllByText('Reportar un problema').at(-1)!);

    await waitFor(() => {
      expect(mockDisputeCustomerJobCompletion).toHaveBeenCalledWith('job-1', {
        disputeDetails: 'El trabajo informado no resolvió el problema principal.',
        disputeReason: 'No quedó resuelto',
      });
    });
    expect(queryClient.getQueryData(['customer-job', 'request-1'])).toMatchObject({
      status: 'disputed',
    });
  });

  it('creates a customer review after completion', async () => {
    mockGetCustomerJobByRequest.mockResolvedValueOnce(createJob({ status: 'completed' }));
    mockGetJobPayment.mockResolvedValueOnce(createPayment({ releasedAt: '2026-07-21T14:00:00.000Z', status: 'released' }));
    const queryClient = renderWithQueryClient(<CustomerJobPanel requestId="request-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('Calificar profesional').length).toBeGreaterThan(0);
    });

    fireEvent.changeText(screen.getByPlaceholderText('1 a 5'), '5');
    fireEvent.changeText(screen.getByPlaceholderText('Comentario opcional'), 'Trabajo muy prolijo.');
    fireEvent.press(screen.getAllByText('Calificar profesional').at(-1)!);

    await waitFor(() => {
      expect(mockCreateJobReview).toHaveBeenCalledWith('job-1', {
        comment: 'Trabajo muy prolijo.',
        rating: 5,
      });
    });
    expect(queryClient.getQueryData(['job-reviews', 'job-1'])).toMatchObject([
      { reviewerRole: 'customer', rating: 5 },
    ]);
  });
});
