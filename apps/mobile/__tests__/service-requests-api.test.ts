const mockInsertSingle = jest.fn();
const mockInsertSelect = jest.fn(() => ({ single: mockInsertSingle }));
const mockInsert = jest.fn((payload: Record<string, unknown>) => {
  void payload;
  return { select: mockInsertSelect };
});
const mockListOrder = jest.fn();
const mockGetSingle = jest.fn();
const mockSelectEq = jest.fn(() => ({ single: mockGetSingle }));
const mockSelect = jest.fn(() => ({
  eq: mockSelectEq,
  order: mockListOrder,
}));
const mockCancelSingle = jest.fn();
const mockCancelSelect = jest.fn(() => ({ single: mockCancelSingle }));
const mockCancelEqStatus = jest.fn(() => ({ select: mockCancelSelect }));
const mockCancelEqId = jest.fn(() => ({ eq: mockCancelEqStatus }));
const mockUpdate = jest.fn((payload: Record<string, unknown>) => {
  void payload;
  return { eq: mockCancelEqId };
});
const mockRpc = jest.fn();
const mockFrom = jest.fn((table: string) => {
  void table;

  return {
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
  };
});
const mockGetUser = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => mockFrom(table),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  cancelOwnServiceRequest,
  createServiceRequest,
  listCustomerRequestApplications,
  listOwnServiceRequests,
  selectProfessionalForRequest,
} from '@/features/customer/service-requests-api';

function createServiceRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'request-1',
    customer_id: 'user-1',
    category_id: 'category-1',
    title: 'Arreglo de pérdida',
    description: 'Tengo una pérdida debajo de la bacha de la cocina y necesito resolverla.',
    request_type: 'specific_task',
    urgency: 'soon',
    address_text: 'Calle 123',
    city: 'Lanus',
    province: 'Buenos Aires',
    preferred_date: null,
    preferred_time_text: null,
    availability_notes: null,
    status: 'published',
    selected_professional_id: null,
    selected_at: null,
    published_at: '2026-07-20T12:00:00.000Z',
    created_at: '2026-07-20T12:00:00.000Z',
    updated_at: '2026-07-20T12:00:00.000Z',
    deleted_at: null,
    category: {
      id: 'category-1',
      name: 'Plomeria',
      slug: 'plomeria',
      description: null,
      active: true,
      created_at: '2026-07-16T00:00:00.000Z',
      updated_at: '2026-07-16T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('service request api', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
      error: null,
    });
    mockInsertSingle.mockResolvedValue({ data: createServiceRequestRow(), error: null });
    mockListOrder.mockResolvedValue({ data: [createServiceRequestRow()], error: null });
    mockCancelSingle.mockResolvedValue({
      data: createServiceRequestRow({ status: 'cancelled' }),
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('takes customer_id from the authenticated session when creating', async () => {
    await createServiceRequest({
      title: 'Arreglo de pérdida',
      description: 'Tengo una pérdida debajo de la bacha de la cocina y necesito resolverla.',
      categoryId: '11111111-1111-4111-8111-111111111111',
      unsureCategory: false,
      requestType: 'specific_task',
      urgency: 'soon',
      addressText: 'Calle 123',
      city: 'Lanus',
      province: 'Buenos Aires',
      preferredDate: null,
      preferredTimeText: null,
      availabilityNotes: null,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: 'user-1',
      }),
    );
  });

  it('creates requests as published with published_at', async () => {
    await createServiceRequest({
      title: 'Arreglo de pérdida',
      description: 'Tengo una pérdida debajo de la bacha de la cocina y necesito resolverla.',
      categoryId: null,
      unsureCategory: true,
      requestType: 'unsure',
      urgency: 'flexible',
      addressText: 'Calle 123',
      city: 'Lanus',
      province: 'Buenos Aires',
      preferredDate: null,
      preferredTimeText: null,
      availabilityNotes: null,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: null,
        status: 'published',
        published_at: expect.any(String),
      }),
    );
  });

  it('lists requests ordered from newest to oldest', async () => {
    await listOwnServiceRequests();

    expect(mockListOrder).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('cancels only published requests by id', async () => {
    await cancelOwnServiceRequest('request-1');

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(mockCancelEqId).toHaveBeenCalledWith('id', 'request-1');
    expect(mockCancelEqStatus).toHaveBeenCalledWith('status', 'published');
  });

  it('lists customer applications through the safe RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          application_id: 'application-1',
          request_id: 'request-1',
          professional_id: 'professional-1',
          status: 'submitted',
          message: 'Puedo ir esta semana.',
          proposal_type: 'diagnostic_visit',
          visit_price: '5000',
          estimated_price: null,
          estimated_duration_text: 'Una visita',
          availability_text: 'Martes',
          created_at: '2026-07-20T12:00:00.000Z',
          conversation_id: 'conversation-1',
          unread_count: 2,
          last_message_body: 'Hola',
          last_message_at: '2026-07-20T13:00:00.000Z',
          professional_first_name: 'Pro',
          professional_last_name: 'Demo',
          professional_bio: 'Bio publica',
          professional_years_experience: 8,
          professional_base_city: 'Lanus',
          professional_service_radius_km: 20,
          professional_verification_status: 'pending',
          professional_category_names: ['Plomeria'],
          professional_phone: 'no debe mapearse',
        },
      ],
      error: null,
    });

    const applications = await listCustomerRequestApplications('request-1');

    expect(mockRpc).toHaveBeenCalledWith('list_customer_request_applications', {
      p_request_id: 'request-1',
    });
    expect(applications[0]).toMatchObject({
      id: 'application-1',
      professionalId: 'professional-1',
      professionalFirstName: 'Pro',
      lastMessageBody: 'Hola',
      unreadCount: 2,
      visitPrice: 5000,
    });
    expect(applications[0]).not.toHaveProperty('professionalPhone');
  });

  it('selects a professional through the atomic RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          request_id: 'request-1',
          request_status: 'professional_selected',
          selected_professional_id: 'professional-1',
          selected_application_id: 'application-1',
          selected_at: '2026-07-20T13:00:00.000Z',
        },
      ],
      error: null,
    });

    const selection = await selectProfessionalForRequest('request-1', 'application-1');

    expect(mockRpc).toHaveBeenCalledWith('select_professional_for_request', {
      p_request_id: 'request-1',
      p_application_id: 'application-1',
    });
    expect(selection).toMatchObject({
      requestId: 'request-1',
      requestStatus: 'professional_selected',
      selectedProfessionalId: 'professional-1',
      selectedApplicationId: 'application-1',
    });
  });
});
