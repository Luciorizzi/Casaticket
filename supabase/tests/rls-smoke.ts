import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const demoPassword = 'CasaTicket123!';
const bootstrapUserEmail = 'bootstrap.profile@casaticket.local';

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function signIn(client: SupabaseClient, email: string, password: string) {
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }
}

async function createBootstrapUser(
  adminClient: SupabaseClient,
  email: string,
): Promise<{ id: string }> {
  const { data: listedUsers, error: listUsersError } = await adminClient.auth.admin.listUsers();

  if (listUsersError) {
    throw listUsersError;
  }

  const existingUser = listedUsers.users.find((user) => user.email === email);
  if (existingUser) {
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingUser.id);

    if (deleteError) {
      throw deleteError;
    }
  }

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: demoPassword,
    email_confirm: true,
  });

  if (createError || !createdUser.user) {
    throw createError ?? new Error(`Unable to create bootstrap user ${email}.`);
  }

  return { id: createdUser.user.id };
}

async function main() {
  const supabaseUrl = requireEnv(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    'SUPABASE_URL',
  );
  const serviceRoleKey = requireEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = requireEnv(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  );

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const customerClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const professionalClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const bootstrapClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const bootstrapProfessionalClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await signIn(customerClient, 'demo.customer@casaticket.local', demoPassword);
  await signIn(professionalClient, 'demo.pro@casaticket.local', demoPassword);

  const { data: customerUser } = await adminClient.auth.admin.listUsers();
  const customerId = customerUser.users.find((user) => user.email === 'demo.customer@casaticket.local')?.id;
  const professionalId = customerUser.users.find((user) => user.email === 'demo.pro@casaticket.local')?.id;

  if (!customerId || !professionalId) {
    throw new Error('Demo users were not found. Run `pnpm db:seed:users` first.');
  }

  const createdBootstrapUser = await createBootstrapUser(adminClient, bootstrapUserEmail);
  const createdBootstrapProfessionalUser = await createBootstrapUser(
    adminClient,
    'bootstrap.professional@casaticket.local',
  );

  await signIn(bootstrapClient, bootstrapUserEmail, demoPassword);
  await signIn(bootstrapProfessionalClient, 'bootstrap.professional@casaticket.local', demoPassword);

  const ownProfileQuery = await customerClient.from('profiles').select('id, role').eq('id', customerId).single();
  if (ownProfileQuery.error || ownProfileQuery.data.id !== customerId) {
    throw new Error(`Customer cannot read own profile: ${ownProfileQuery.error?.message ?? 'unknown error'}`);
  }

  const foreignProfileQuery = await customerClient
    .from('profiles')
    .select('id')
    .eq('id', professionalId);

  if (foreignProfileQuery.error) {
    throw new Error(`Unexpected error when reading a foreign profile: ${foreignProfileQuery.error.message}`);
  }

  if ((foreignProfileQuery.data ?? []).length !== 0) {
    throw new Error('Customer unexpectedly read another user profile.');
  }

  const roleEscalationAttempt = await customerClient
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', customerId)
    .select('id');

  if (!roleEscalationAttempt.error) {
    throw new Error('Customer unexpectedly escalated to admin.');
  }

  const { data: professionalProfile, error: professionalProfileError } = await adminClient
    .from('professional_profiles')
    .select('id')
    .eq('user_id', professionalId)
    .single();

  if (professionalProfileError || !professionalProfile) {
    throw new Error(
      `Professional profile missing for smoke test: ${professionalProfileError?.message ?? 'not found'}`,
    );
  }

  const verificationUpdateAttempt = await professionalClient
    .from('professional_profiles')
    .update({ verification_status: 'verified' })
    .eq('id', professionalProfile.id)
    .select('id');

  if (!verificationUpdateAttempt.error) {
    throw new Error('Professional unexpectedly changed verification status.');
  }

  const categoryQuery = await customerClient.from('categories').select('id, slug');
  if (categoryQuery.error || (categoryQuery.data ?? []).length < 8) {
    throw new Error(`Active category read failed: ${categoryQuery.error?.message ?? 'unexpected count'}`);
  }

  const missingBootstrapProfileQuery = await bootstrapClient
    .from('profiles')
    .select('id, role')
    .eq('id', createdBootstrapUser.id)
    .maybeSingle();

  if (missingBootstrapProfileQuery.error) {
    throw new Error(
      `Bootstrap user could not verify missing profile: ${missingBootstrapProfileQuery.error.message}`,
    );
  }

  if (missingBootstrapProfileQuery.data) {
    throw new Error('Bootstrap smoke-test user unexpectedly started with a profile row.');
  }

  const bootstrapProfileInsert = await bootstrapClient
    .from('profiles')
    .insert({
      id: createdBootstrapUser.id,
      role: null,
    })
    .select('id, role')
    .single();

  if (bootstrapProfileInsert.error || bootstrapProfileInsert.data.id !== createdBootstrapUser.id) {
    throw new Error(`Bootstrap profile insert failed: ${bootstrapProfileInsert.error?.message ?? 'unknown error'}`);
  }

  const bootstrapRoleSelection = await bootstrapClient
    .from('profiles')
    .update({ role: 'customer' })
    .eq('id', createdBootstrapUser.id)
    .select('id, role')
    .single();

  if (bootstrapRoleSelection.error || bootstrapRoleSelection.data.role !== 'customer') {
    throw new Error(
      `Bootstrap role selection failed: ${bootstrapRoleSelection.error?.message ?? 'unknown error'}`,
    );
  }

  const bootstrapRoleChangeAttempt = await bootstrapClient
    .from('profiles')
    .update({ role: 'professional' })
    .eq('id', createdBootstrapUser.id)
    .select('id, role')
    .single();

  if (!bootstrapRoleChangeAttempt.error) {
    throw new Error('Bootstrap user unexpectedly changed role after the initial selection.');
  }

  const bootstrapProfessionalProfileInsert = await bootstrapProfessionalClient
    .from('profiles')
    .insert({
      id: createdBootstrapProfessionalUser.id,
      role: null,
    })
    .select('id, role')
    .single();

  if (
    bootstrapProfessionalProfileInsert.error ||
    bootstrapProfessionalProfileInsert.data.id !== createdBootstrapProfessionalUser.id
  ) {
    throw new Error(
      `Bootstrap professional profile insert failed: ${bootstrapProfessionalProfileInsert.error?.message ?? 'unknown error'}`,
    );
  }

  const bootstrapProfessionalRoleSelection = await bootstrapProfessionalClient
    .from('profiles')
    .update({ role: 'professional' })
    .eq('id', createdBootstrapProfessionalUser.id)
    .select('id, role')
    .single();

  if (
    bootstrapProfessionalRoleSelection.error ||
    bootstrapProfessionalRoleSelection.data.role !== 'professional'
  ) {
    throw new Error(
      `Bootstrap professional role selection failed: ${bootstrapProfessionalRoleSelection.error?.message ?? 'unknown error'}`,
    );
  }

  const bootstrapProfessionalRoleChangeAttempt = await bootstrapProfessionalClient
    .from('profiles')
    .update({ role: 'customer' })
    .eq('id', createdBootstrapProfessionalUser.id)
    .select('id, role')
    .single();

  if (!bootstrapProfessionalRoleChangeAttempt.error) {
    throw new Error('Bootstrap professional user unexpectedly changed role after the initial selection.');
  }

  const foreignRoleUpdateAttempt = await bootstrapClient
    .from('profiles')
    .update({ role: 'customer' })
    .eq('id', createdBootstrapProfessionalUser.id)
    .select('id, role')
    .single();

  if (!foreignRoleUpdateAttempt.error) {
    throw new Error('Bootstrap user unexpectedly modified another user role.');
  }

  console.log('RLS smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
