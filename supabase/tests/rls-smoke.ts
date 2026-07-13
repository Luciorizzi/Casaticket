import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const demoPassword = 'CasaTicket123!';

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

  await signIn(customerClient, 'demo.customer@casaticket.local', demoPassword);
  await signIn(professionalClient, 'demo.pro@casaticket.local', demoPassword);

  const { data: customerUser } = await adminClient.auth.admin.listUsers();
  const customerId = customerUser.users.find((user) => user.email === 'demo.customer@casaticket.local')?.id;
  const professionalId = customerUser.users.find((user) => user.email === 'demo.pro@casaticket.local')?.id;

  if (!customerId || !professionalId) {
    throw new Error('Demo users were not found. Run `pnpm db:seed:users` first.');
  }

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

  console.log('RLS smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
