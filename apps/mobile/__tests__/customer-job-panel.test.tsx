import type { Job, JobQuote } from '@casaticket/types';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockAcceptCustomerJobQuote = jest.fn();
const mockConfirmCustomerJobVisit = jest.fn();
const mockGetCustomerJobById = jest.fn();
const mockGetCustomerJobByRequest = jest.fn();
const mockListJobQuotes = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockRejectCustomerJobQuote = jest.fn();
const mockRejectCustomerJobVisit = jest.fn();

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
  confirmCustomerJobVisit: (...args: unknown[]) => mockConfirmCustomerJobVisit(...args),
  customerJobByIdQueryKey: (jobId: string) => ['customer-job-by-id', jobId],
  customerJobQueryKey: (requestId: string) => ['customer-job', requestId],
  getCustomerJobById: (...args: unknown[]) => mockGetCustomerJobById(...args),
  getCustomerJobByRequest: (...args: unknown[]) => mockGetCustomerJobByRequest(...args),
  jobQuotesQueryKey: (jobId: string) => ['job-quotes', jobId],
  listJobQuotes: (...args: unknown[]) => mockListJobQuotes(...args),
  rejectCustomerJobQuote: (...args: unknown[]) => mockRejectCustomerJobQuote(...args),
  rejectCustomerJobVisit: (...args: unknown[]) => mockRejectCustomerJobVisit(...args),
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
    mockCanGoBack.mockReturnValue(true);
    mockGetCustomerJobByRequest.mockResolvedValue(createJob());
    mockGetCustomerJobById.mockResolvedValue(createJob());
    mockListJobQuotes.mockResolvedValue([]);
    mockConfirmCustomerJobVisit.mockResolvedValue(createJob({ status: 'visit_confirmed' }));
    mockRejectCustomerJobVisit.mockResolvedValue(createJob({ status: 'coordination_pending' }));
    mockAcceptCustomerJobQuote.mockResolvedValue({ jobId: 'job-1', jobStatus: 'quote_accepted' });
    mockRejectCustomerJobQuote.mockResolvedValue({ jobId: 'job-1', jobStatus: 'quote_rejected' });
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
      expect(screen.getByText('Ver progreso del trabajo')).toBeTruthy();
    });

    expect(screen.getByText('Proceso del trabajo')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('$ 12.000')).toBeTruthy();
    expect(screen.queryByText('Confirmar coordinación')).toBeNull();
    expect(screen.queryByText('Responder presupuesto')).toBeNull();

    fireEvent.press(screen.getByText('Ver progreso del trabajo'));

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
    expect(screen.getByText('Materiales no incluidos en el total final.')).toBeTruthy();
    expect(screen.getByText('Total final')).toBeTruthy();
    expect(screen.getByText('$ 12.000')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Motivo opcional del rechazo'), 'Necesito ajustar materiales.');
    fireEvent.press(screen.getByText('Rechazar presupuesto'));

    await waitFor(() => {
      expect(mockRejectCustomerJobQuote).toHaveBeenCalledWith('quote-1', {
        rejectedReason: 'Necesito ajustar materiales.',
      });
    });
  });
});
