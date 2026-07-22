const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  acceptCustomerJobQuote,
  createProfessionalJobQuote,
  getCustomerJobByRequest,
  listJobQuotes,
  proposeProfessionalJobVisit,
  recordProfessionalJobDiagnosis,
  rejectCustomerJobQuote,
  sendProfessionalJobQuote,
} from '@/features/jobs/api';

function createJobRow(overrides: Record<string, unknown> = {}) {
  return {
    job_id: 'job-1',
    request_id: 'request-1',
    selected_application_id: 'application-1',
    customer_id: 'customer-1',
    professional_id: 'professional-1',
    status: 'coordination_pending',
    scheduled_date: null,
    scheduled_time_text: null,
    scheduling_notes: null,
    diagnosis_text: null,
    recommended_work_text: null,
    materials_notes: null,
    diagnosis_notes: null,
    diagnosed_at: null,
    created_at: '2026-07-21T10:00:00.000Z',
    updated_at: '2026-07-21T10:00:00.000Z',
    ...overrides,
  };
}

function createQuoteRow(overrides: Record<string, unknown> = {}) {
  return {
    quote_id: 'quote-1',
    job_id: 'job-1',
    version: 1,
    labor_amount: '10000',
    materials_amount: '2500',
    visit_amount: '1500',
    platform_fee_amount: '500',
    total_amount: '12000',
    currency: 'ARS',
    description: 'Presupuesto formal con tareas y materiales necesarios.',
    estimated_duration_text: 'Un dia',
    valid_until: null,
    status: 'draft',
    rejection_reason: null,
    rejected_reason: null,
    created_at: '2026-07-21T10:00:00.000Z',
    updated_at: '2026-07-21T10:00:00.000Z',
    accepted_at: null,
    rejected_at: null,
    ...overrides,
  };
}

describe('jobs api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets a job by request', async () => {
    mockRpc.mockResolvedValueOnce({ data: [createJobRow()], error: null });

    const job = await getCustomerJobByRequest('request-1');

    expect(mockRpc).toHaveBeenCalledWith('get_job_by_request', { p_request_id: 'request-1' });
    expect(job).toMatchObject({ id: 'job-1', status: 'coordination_pending' });
  });

  it('lists job quotes with backend totals', async () => {
    mockRpc.mockResolvedValueOnce({ data: [createQuoteRow()], error: null });

    const quotes = await listJobQuotes('job-1');

    expect(mockRpc).toHaveBeenCalledWith('list_job_quotes', { p_job_id: 'job-1' });
    expect(quotes[0]).toMatchObject({ platformFeeAmount: 500, totalAmount: 12000, version: 1 });
  });

  it('proposes visits through RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        createJobRow({
          scheduled_date: '2026-07-22',
          scheduled_time_text: '10 a 12',
          status: 'visit_proposed',
        }),
      ],
      error: null,
    });

    await proposeProfessionalJobVisit('job-1', {
      scheduledDate: '2026-07-22',
      scheduledTimeText: '10 a 12',
      schedulingNotes: null,
    });

    expect(mockRpc).toHaveBeenCalledWith('propose_job_visit', {
      p_job_id: 'job-1',
      p_scheduled_date: '2026-07-22',
      p_scheduled_time_text: '10 a 12',
      p_scheduling_notes: null,
    });
  });

  it('records diagnosis only with a valid diagnosis payload', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [createJobRow({ diagnosis_text: 'Diagnostico suficientemente detallado.', status: 'quote_pending' })],
      error: null,
    });

    await recordProfessionalJobDiagnosis('job-1', {
      diagnosisText: 'Diagnostico suficientemente detallado.',
      recommendedWorkText: 'Reemplazar piezas dañadas.',
      materialsNotes: 'Llevar repuestos.',
      diagnosisNotes: null,
    });

    expect(mockRpc).toHaveBeenCalledWith('record_job_diagnosis', {
      p_job_id: 'job-1',
      p_diagnosis_text: 'Diagnostico suficientemente detallado.',
      p_recommended_work_text: 'Reemplazar piezas dañadas.',
      p_materials_notes: 'Llevar repuestos.',
      p_diagnosis_notes: null,
    });
  });

  it('creates a quote without sending platform_fee_amount or total_amount from frontend', async () => {
    mockRpc.mockResolvedValueOnce({ data: [createQuoteRow()], error: null });

    await createProfessionalJobQuote('job-1', {
      description: 'Presupuesto formal con tareas y materiales necesarios.',
      estimatedDurationText: 'Un dia',
      laborAmount: 10000,
      materialsAmount: 2500,
      validUntil: null,
      visitAmount: 1500,
    });

    expect(mockRpc).toHaveBeenCalledWith('create_job_quote', {
      p_job_id: 'job-1',
      p_labor_amount: 10000,
      p_materials_amount: 2500,
      p_visit_amount: 1500,
      p_description: 'Presupuesto formal con tareas y materiales necesarios.',
      p_estimated_duration_text: 'Un dia',
      p_valid_until: null,
    });
    expect(JSON.stringify(mockRpc.mock.calls[0])).not.toContain('platform_fee');
    expect(JSON.stringify(mockRpc.mock.calls[0])).not.toContain('total');
  });

  it('sends and responds to quotes through RPCs', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: [createQuoteRow({ status: 'sent' })], error: null })
      .mockResolvedValueOnce({ data: [{ job_id: 'job-1' }], error: null })
      .mockResolvedValueOnce({ data: [{ job_id: 'job-1' }], error: null });

    await sendProfessionalJobQuote('quote-1');
    await acceptCustomerJobQuote('quote-1');
    await rejectCustomerJobQuote('quote-2', { rejectedReason: 'Necesito ajustar materiales.' });

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'send_job_quote', { p_quote_id: 'quote-1' });
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'accept_job_quote', { p_quote_id: 'quote-1' });
    expect(mockRpc).toHaveBeenNthCalledWith(3, 'reject_job_quote', {
      p_quote_id: 'quote-2',
      p_rejected_reason: 'Necesito ajustar materiales.',
    });
  });
});
