import { createClient } from '@supabase/supabase-js';

const demoPassword = 'CasaTicket123!';

const requiredEnv = {
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const supabaseUrl = requireEnv(requiredEnv.supabaseUrl, 'SUPABASE_URL');
  const serviceRoleKey = requireEnv(requiredEnv.serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY');

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const demoUsers = [
    {
      email: 'demo.customer@casaticket.local',
      password: demoPassword,
      role: 'customer' as const,
      firstName: 'Camila',
      lastName: 'Prueba',
      city: 'Lanus',
      province: 'Buenos Aires',
    },
    {
      email: 'demo.pro@casaticket.local',
      password: demoPassword,
      role: 'professional' as const,
      firstName: 'Joaquin',
      lastName: 'Demo',
      city: 'Avellaneda',
      province: 'Buenos Aires',
    },
  ];

  const { data: listedUsers, error: listUsersError } = await adminClient.auth.admin.listUsers();

  if (listUsersError) {
    throw listUsersError;
  }

  for (const demoUser of demoUsers) {
    const existing = listedUsers.users.find((user) => user.email === demoUser.email);

    if (existing) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(existing.id);

      if (deleteError) {
        throw deleteError;
      }
    }
  }

  const createdUsers: Record<string, string> = {};

  for (const demoUser of demoUsers) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: demoUser.email,
      password: demoUser.password,
      email_confirm: true,
      user_metadata: {
        source: 'local-demo-seed',
      },
    });

    if (error || !data.user) {
      throw error ?? new Error(`Unable to create demo user: ${demoUser.email}`);
    }

    createdUsers[demoUser.email] = data.user.id;

    const { error: profileError } = await adminClient.from('profiles').insert({
      id: data.user.id,
      first_name: demoUser.firstName,
      last_name: demoUser.lastName,
      phone: null,
      avatar_path: null,
      role: demoUser.role,
      province: demoUser.province,
      city: demoUser.city,
      onboarding_completed: true,
    });

    if (profileError) {
      throw profileError;
    }
  }

  const professionalUserId = createdUsers['demo.pro@casaticket.local'];
  const customerUserId = createdUsers['demo.customer@casaticket.local'];

  const { data: categories, error: categoryError } = await adminClient
    .from('categories')
    .select('id, slug')
    .in('slug', ['plomeria', 'electricidad', 'mantenimiento-general-colocaciones']);

  if (categoryError) {
    throw categoryError;
  }

  const { data: professionalProfile, error: professionalProfileError } = await adminClient
    .from('professional_profiles')
    .insert({
      user_id: professionalUserId,
      bio: 'Perfil de demostracion para validar la arquitectura inicial.',
      years_experience: 8,
      base_city: 'Avellaneda',
      base_latitude: -34.6618,
      base_longitude: -58.3659,
      service_radius_km: 35,
      availability_status: 'available',
      verification_status: 'pending',
    })
    .select('id')
    .single();

  if (professionalProfileError || !professionalProfile) {
    throw professionalProfileError ?? new Error('Unable to create the demo professional profile.');
  }

  const { error: professionalCategoriesError } = await adminClient.from('professional_categories').insert(
    categories.map((category) => ({
      professional_id: professionalProfile.id,
      category_id: category.id,
    })),
  );

  if (professionalCategoriesError) {
    throw professionalCategoriesError;
  }

  const { error: addressError } = await adminClient.from('customer_addresses').insert({
    customer_id: customerUserId,
    label: 'Casa',
    address_line: 'Calle Demo 123',
    city: 'Lanus',
    province: 'Buenos Aires',
    postal_code: '1824',
    latitude: -34.7024,
    longitude: -58.3938,
    is_default: true,
  });

  if (addressError) {
    throw addressError;
  }

  console.log('Demo users created successfully.');
  console.log(`Customer email: demo.customer@casaticket.local / password: ${demoPassword}`);
  console.log(`Professional email: demo.pro@casaticket.local / password: ${demoPassword}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

