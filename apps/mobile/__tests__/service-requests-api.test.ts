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
  },
}));

import {
  cancelOwnServiceRequest,
  createServiceRequest,
  listOwnServiceRequests,
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
});
