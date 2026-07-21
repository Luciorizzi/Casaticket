const mockRpc = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({
  eq: mockEqRequest,
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
}));
const mockEqProfessional = jest.fn(() => ({
  maybeSingle: mockMaybeSingle,
  order: mockOrder,
}));
const mockEqRequest = jest.fn(() => ({
  eq: mockEqProfessional,
}));
const mockOrder = jest.fn();
const mockInsert = jest.fn((payload: Record<string, unknown>) => {
  void payload;
  return { select: mockSelect };
});
const mockUpdateIn = jest.fn(() => ({ select: mockSelect }));
const mockUpdateEqProfessional = jest.fn(() => ({ in: mockUpdateIn }));
const mockUpdateEqId = jest.fn(() => ({ eq: mockUpdateEqProfessional }));
const mockUpdate = jest.fn((payload: Record<string, unknown>) => {
  void payload;
  return { eq: mockUpdateEqId };
});
const mockFrom = jest.fn((table: string) => {
  void table;

  return {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  };
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  createApplication,
  getOwnApplication,
  listProfessionalSelectedJobs,
  listProfessionalOpportunities,
  withdrawApplication,
} from '@/features/professional/opportunities-api';

function createApplicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'application-1',
    request_id: 'request-1',
    professional_id: 'professional-1',
    message: 'Puedo revisar el problema esta semana con herramientas propias.',
    proposal_type: 'diagnostic_visit',
    visit_price: '5000',
    estimated_price: null,
    estimated_duration_text: 'Una visita breve',
    availability_text: 'Martes por la tarde',
    status: 'submitted',
    conversation_id: 'conversation-1',
    unread_count: 0,
    last_message_body: null,
    last_message_at: null,
    created_at: '2026-07-20T12:00:00.000Z',
    updated_at: '2026-07-20T12:00:00.000Z',
    withdrawn_at: null,
    ...overrides,
  };
}

describe('professional opportunities api', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRpc.mockResolvedValue({
      data: [
        {
          request_id: 'request-1',
          title: 'Arreglo de pérdida',
          description: 'Necesito arreglar una pérdida de agua.',
          category_id: 'category-1',
          category_name: 'Plomeria',
          request_type: 'specific_task',
          urgency: 'soon',
          city: 'Lanus',
          province: 'Buenos Aires',
          preferred_date: null,
          preferred_time_text: null,
          availability_notes: null,
          published_at: '2026-07-20T12:00:00.000Z',
          address_text: 'Calle privada 123',
        },
      ],
      error: null,
    });
    mockSingle.mockResolvedValue({ data: createApplicationRow(), error: null });
    mockMaybeSingle.mockResolvedValue({ data: createApplicationRow(), error: null });
    mockOrder.mockResolvedValue({ data: [createApplicationRow()], error: null });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('maps professional opportunities without exposing exact address', async () => {
    const opportunities = await listProfessionalOpportunities('professional-1');

    expect(mockRpc).toHaveBeenCalledWith('list_professional_opportunities');
    expect(opportunities[0]).toMatchObject({
      requestId: 'request-1',
      categoryName: 'Plomeria',
      city: 'Lanus',
    });
    expect(opportunities[0]).not.toHaveProperty('addressText');
    expect(opportunities[0]).not.toHaveProperty('customerId');
  });

  it('creates an application for the provided professional and request', async () => {
    await createApplication('professional-1', 'request-1', {
      message: 'Puedo revisar el problema esta semana con herramientas propias.',
      proposalType: 'diagnostic_visit',
      visitPrice: 5000,
      estimatedPrice: null,
      estimatedDurationText: 'Una visita breve',
      availabilityText: 'Martes por la tarde',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        professional_id: 'professional-1',
        request_id: 'request-1',
        status: 'submitted',
      }),
    );
  });

  it('gets only the current professional application for a request', async () => {
    mockRpc.mockResolvedValueOnce({ data: [createApplicationRow()], error: null });

    await getOwnApplication('request-1', 'professional-1');

    expect(mockRpc).toHaveBeenCalledWith('get_professional_application', {
      p_request_id: 'request-1',
    });
  });

  it('withdraws only submitted or viewed own applications', async () => {
    await withdrawApplication('application-1', 'professional-1');

    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'withdrawn',
      withdrawn_at: expect.any(String),
    });
    expect(mockUpdateEqId).toHaveBeenCalledWith('id', 'application-1');
    expect(mockUpdateEqProfessional).toHaveBeenCalledWith('professional_id', 'professional-1');
    expect(mockUpdateIn).toHaveBeenCalledWith('status', ['submitted', 'viewed']);
  });

  it('lists selected jobs through the safe RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          application_id: 'application-1',
          request_id: 'request-1',
          title: 'Arreglo de pérdida',
          category_name: 'Plomeria',
          city: 'Lanus',
          request_status: 'professional_selected',
          selected_at: '2026-07-20T13:00:00.000Z',
          conversation_id: 'conversation-1',
          unread_count: 1,
          last_message_body: 'Hola',
          last_message_at: '2026-07-20T13:05:00.000Z',
        },
      ],
      error: null,
    });

    const jobs = await listProfessionalSelectedJobs('professional-1');

    expect(mockRpc).toHaveBeenCalledWith('list_professional_selected_jobs');
    expect(jobs[0]).toMatchObject({
      applicationId: 'application-1',
      requestId: 'request-1',
      requestStatus: 'professional_selected',
      selectedAt: '2026-07-20T13:00:00.000Z',
      lastMessageBody: 'Hola',
      unreadCount: 1,
    });
  });
});
