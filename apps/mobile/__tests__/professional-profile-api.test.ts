const mockProfilesSingle = jest.fn();
const mockProfilesSelect = jest.fn(() => ({ single: mockProfilesSingle }));
const mockProfilesEq = jest.fn(() => ({ select: mockProfilesSelect }));
const mockProfilesUpdate = jest.fn((payload: Record<string, unknown>) => {
  void payload;
  return { eq: mockProfilesEq };
});

const mockProfessionalSingle = jest.fn();
const mockProfessionalSelect = jest.fn(() => ({ single: mockProfessionalSingle }));
const mockProfessionalUpsert = jest.fn((payload: Record<string, unknown>) => {
  void payload;
  return { select: mockProfessionalSelect };
});

const mockCategoriesDeleteEq = jest.fn();
const mockCategoriesDelete = jest.fn(() => ({ eq: mockCategoriesDeleteEq }));
const mockCategoriesInsert = jest.fn();
const mockFrom = jest.fn((table: string) => {
  if (table === 'profiles') {
    return {
      update: mockProfilesUpdate,
    };
  }

  if (table === 'professional_profiles') {
    return {
      upsert: mockProfessionalUpsert,
    };
  }

  if (table === 'professional_categories') {
    return {
      delete: mockCategoriesDelete,
      insert: mockCategoriesInsert,
    };
  }

  throw new Error(`Unexpected table ${table}`);
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

import { saveProfessionalOnboarding } from '@/features/profile/api';

const categoryIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
];

function createProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    first_name: 'Pro',
    last_name: 'Demo',
    phone: '1122334455',
    avatar_path: null,
    role: 'professional',
    province: 'Buenos Aires',
    city: 'Lanus',
    onboarding_completed: false,
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function createProfessionalProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'professional-profile-1',
    user_id: 'user-1',
    bio: 'Trabajo en instalaciones y reparaciones del hogar con experiencia comprobable.',
    years_experience: 8,
    base_city: 'Lanus',
    base_latitude: null,
    base_longitude: null,
    service_radius_km: 25,
    availability_status: 'available',
    verification_status: 'pending',
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function createProfessionalValues() {
  return {
    firstName: 'Pro',
    lastName: 'Demo',
    phone: '1122334455',
    city: 'Lanus',
    province: 'Buenos Aires',
    bio: 'Trabajo en instalaciones y reparaciones del hogar con experiencia comprobable.',
    yearsExperience: 8,
    baseCity: 'Lanus',
    serviceRadiusKm: 25,
    availabilityStatus: 'available' as const,
    categoryIds,
  };
}

describe('professional onboarding api', () => {
  let consoleInfoSpy: jest.SpyInstance;
  let profileSingleCalls = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    profileSingleCalls = 0;
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
        },
      },
      error: null,
    });
    mockProfilesSingle.mockImplementation(async () => {
      profileSingleCalls += 1;

      return {
        data: createProfileRow({
          onboarding_completed: profileSingleCalls % 2 === 0,
        }),
        error: null,
      };
    });
    mockProfessionalSingle.mockResolvedValue({
      data: createProfessionalProfileRow(),
      error: null,
    });
    mockCategoriesDeleteEq.mockResolvedValue({ error: null });
    mockCategoriesInsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it('updates profiles with eq(id, userId)', async () => {
    await saveProfessionalOnboarding(createProfessionalValues());

    expect(mockProfilesUpdate).toHaveBeenNthCalledWith(1, {
      first_name: 'Pro',
      last_name: 'Demo',
      phone: '1122334455',
      city: 'Lanus',
      province: 'Buenos Aires',
    });
    expect(mockProfilesEq).toHaveBeenNthCalledWith(1, 'id', 'user-1');
  });

  it('uses user_id when upserting professional_profiles', async () => {
    await saveProfessionalOnboarding(createProfessionalValues());

    expect(mockProfessionalUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        bio: 'Trabajo en instalaciones y reparaciones del hogar con experiencia comprobable.',
        years_experience: 8,
        base_city: 'Lanus',
        service_radius_km: 25,
        availability_status: 'available',
      },
      {
        onConflict: 'user_id',
      },
    );

    expect(mockProfessionalUpsert.mock.calls[0]?.[0].verification_status).toBeUndefined();
  });

  it('uses the returned professional profile id for categories', async () => {
    await saveProfessionalOnboarding(createProfessionalValues());

    expect(mockCategoriesDeleteEq).toHaveBeenCalledWith(
      'professional_id',
      'professional-profile-1',
    );
    expect(mockCategoriesInsert).toHaveBeenCalledWith([
      {
        professional_id: 'professional-profile-1',
        category_id: categoryIds[0],
      },
      {
        professional_id: 'professional-profile-1',
        category_id: categoryIds[1],
      },
    ]);
  });

  it('marks onboarding_completed true only after professional data succeeds', async () => {
    await saveProfessionalOnboarding(createProfessionalValues());

    expect(mockProfilesUpdate).toHaveBeenNthCalledWith(2, {
      onboarding_completed: true,
    });
    expect(mockProfilesEq).toHaveBeenNthCalledWith(2, 'id', 'user-1');
  });

  it('does not complete onboarding when category replacement fails', async () => {
    mockCategoriesInsert.mockResolvedValueOnce({
      error: {
        code: '23503',
        message: 'insert or update on table violates foreign key constraint',
        details: null,
        hint: null,
      },
    });

    await expect(saveProfessionalOnboarding(createProfessionalValues())).rejects.toMatchObject({
      code: '23503',
    });

    expect(mockProfilesUpdate).toHaveBeenCalledTimes(1);
  });

  it('replaces categories idempotently on retry without duplicate inserts', async () => {
    await saveProfessionalOnboarding(createProfessionalValues());
    await saveProfessionalOnboarding(createProfessionalValues());

    expect(mockCategoriesDeleteEq).toHaveBeenCalledTimes(2);
    expect(mockCategoriesInsert).toHaveBeenCalledTimes(2);
    expect(mockCategoriesInsert.mock.calls[0]?.[0]).toEqual(mockCategoriesInsert.mock.calls[1]?.[0]);
  });
});
