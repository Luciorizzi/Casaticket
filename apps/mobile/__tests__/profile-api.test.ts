const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockUpdate = jest.fn(() => ({ eq: mockEq, select: mockSelect }));
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

import { updateOwnRole } from '@/features/profile/api';

describe('updateOwnRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSingle.mockResolvedValue({
      data: {
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
      },
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

  it('updates only the authenticated user profile row', async () => {
    await updateOwnRole('customer');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith({ role: 'customer' });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });
});
