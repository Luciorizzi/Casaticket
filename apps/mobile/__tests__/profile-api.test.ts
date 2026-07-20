const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockUpdate = jest.fn((payload: Record<string, unknown>) => {
  void payload;
  return { eq: mockEq };
});
const mockFrom = jest.fn((table: string) => ({
  table,
  update: mockUpdate,
}));
const mockGetUser = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => mockFrom(table),
  },
}));

import { saveCustomerOnboarding, updateOwnRole } from '@/features/profile/api';

function createProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    first_name: '',
    last_name: '',
    phone: null,
    avatar_path: null,
    role: 'customer',
    province: 'Buenos Aires',
    city: 'Ciudad Autonoma de Buenos Aires',
    onboarding_completed: false,
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

describe('profile api updates', () => {
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    mockSingle.mockResolvedValue({
      data: createProfileRow(),
      error: null,
    });

    mockEq.mockReturnValue({
      select: mockSelect,
    });

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it('updates only the authenticated user profile row when selecting a role', async () => {
    await updateOwnRole('customer');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith({ role: 'customer' });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('updates only the authenticated user profile row when saving customer onboarding', async () => {
    await saveCustomerOnboarding({
      firstName: 'Ana',
      lastName: 'Cliente',
      phone: '1122334455',
      city: 'Lanus',
      province: 'Buenos Aires',
      initialAddress: '',
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('does not include role or internal fields in the customer onboarding payload', async () => {
    await saveCustomerOnboarding({
      firstName: 'Ana',
      lastName: 'Cliente',
      phone: '1122334455',
      city: 'Lanus',
      province: 'Buenos Aires',
      initialAddress: '',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      first_name: 'Ana',
      last_name: 'Cliente',
      phone: '1122334455',
      city: 'Lanus',
      province: 'Buenos Aires',
      onboarding_completed: true,
    });

    const payload = mockUpdate.mock.calls[0]?.[0];

    if (!payload) {
      throw new Error('Expected profile update payload.');
    }

    expect(payload.role).toBeUndefined();
    expect(payload.id).toBeUndefined();
    expect(payload.created_at).toBeUndefined();
  });

  it('returns the updated customer profile', async () => {
    mockSingle.mockResolvedValueOnce({
      data: createProfileRow({
        first_name: 'Ana',
        last_name: 'Cliente',
        phone: '1122334455',
        city: 'Lanus',
        onboarding_completed: true,
      }),
      error: null,
    });

    await expect(
      saveCustomerOnboarding({
        firstName: 'Ana',
        lastName: 'Cliente',
        phone: '1122334455',
        city: 'Lanus',
        province: 'Buenos Aires',
        initialAddress: '',
      }),
    ).resolves.toMatchObject({
      id: 'user-1',
      firstName: 'Ana',
      role: 'customer',
      onboardingCompleted: true,
    });
  });
});
