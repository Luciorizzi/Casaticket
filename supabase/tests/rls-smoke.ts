import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const demoPassword = 'CasaTicket123!';
const bootstrapUserEmail = 'bootstrap.profile@casaticket.local';

interface ProfessionalOpportunitySmokeRow {
  request_id: string;
  address_text?: string;
  customer_id?: string;
}

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

  const serviceRequestCategoryId =
    categoryQuery.data?.find((category) => category.slug === 'plomeria')?.id ?? categoryQuery.data?.[0]?.id;
  const incompatibleServiceRequestCategoryId = categoryQuery.data?.find(
    (category) => category.id !== serviceRequestCategoryId,
  )?.id;

  if (!serviceRequestCategoryId || !incompatibleServiceRequestCategoryId) {
    throw new Error('No category available for service request smoke test.');
  }

  const ownServiceRequestInsert = await customerClient
    .from('service_requests')
    .insert({
      customer_id: customerId,
      category_id: serviceRequestCategoryId,
      title: 'Arreglo de perdida',
      description: 'Tengo una perdida debajo de la bacha de la cocina y necesito resolverla.',
      request_type: 'specific_task',
      urgency: 'soon',
      address_text: 'Calle 123',
      city: 'Lanus',
      province: 'Buenos Aires',
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .select('id, customer_id, status')
    .single();

  if (ownServiceRequestInsert.error || ownServiceRequestInsert.data.customer_id !== customerId) {
    throw new Error(
      `Customer could not create own service request: ${ownServiceRequestInsert.error?.message ?? 'unknown error'}`,
    );
  }

  const bootstrapProfessionalCompletion = await bootstrapProfessionalClient
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', createdBootstrapProfessionalUser.id)
    .select('id, onboarding_completed')
    .single();

  if (
    bootstrapProfessionalCompletion.error ||
    !bootstrapProfessionalCompletion.data.onboarding_completed
  ) {
    throw new Error(
      `Bootstrap professional onboarding completion failed: ${bootstrapProfessionalCompletion.error?.message ?? 'unknown error'}`,
    );
  }

  const bootstrapProfessionalProfile = await bootstrapProfessionalClient
    .from('professional_profiles')
    .insert({
      user_id: createdBootstrapProfessionalUser.id,
      bio: 'Perfil profesional de smoke test con rubro no compatible.',
      years_experience: 3,
      base_city: 'Lanus',
      service_radius_km: 20,
      availability_status: 'available',
    })
    .select('id')
    .single();

  if (bootstrapProfessionalProfile.error || !bootstrapProfessionalProfile.data) {
    throw new Error(
      `Bootstrap professional profile creation failed: ${bootstrapProfessionalProfile.error?.message ?? 'unknown error'}`,
    );
  }

  const bootstrapProfessionalCategory = await bootstrapProfessionalClient
    .from('professional_categories')
    .insert({
      professional_id: bootstrapProfessionalProfile.data.id,
      category_id: incompatibleServiceRequestCategoryId,
    });

  if (bootstrapProfessionalCategory.error) {
    throw new Error(
      `Bootstrap professional category creation failed: ${bootstrapProfessionalCategory.error.message}`,
    );
  }

  const compatibleOpportunityRead = await professionalClient.rpc('list_professional_opportunities');

  if (compatibleOpportunityRead.error) {
    throw new Error(`Professional could not read compatible opportunities: ${compatibleOpportunityRead.error.message}`);
  }

  const compatibleOpportunities = (compatibleOpportunityRead.data ?? []) as ProfessionalOpportunitySmokeRow[];
  const compatibleOpportunity = compatibleOpportunities.find(
    (opportunity) => opportunity.request_id === ownServiceRequestInsert.data.id,
  );

  if (!compatibleOpportunity) {
    throw new Error('Compatible professional did not see a matching published service request.');
  }

  if ('address_text' in compatibleOpportunity || 'customer_id' in compatibleOpportunity) {
    throw new Error('Professional opportunity unexpectedly exposed private customer data.');
  }

  const incompatibleOpportunityRead = await bootstrapProfessionalClient.rpc('list_professional_opportunities');

  if (incompatibleOpportunityRead.error) {
    throw new Error(
      `Incompatible professional opportunity read failed: ${incompatibleOpportunityRead.error.message}`,
    );
  }

  if (
    ((incompatibleOpportunityRead.data ?? []) as ProfessionalOpportunitySmokeRow[]).some(
      (opportunity) => opportunity.request_id === ownServiceRequestInsert.data.id,
    )
  ) {
    throw new Error('Incompatible professional unexpectedly saw a category-specific request.');
  }

  const uncategorizedServiceRequestInsert = await customerClient
    .from('service_requests')
    .insert({
      customer_id: customerId,
      category_id: null,
      title: 'No se que rubro necesito',
      description: 'Tengo un problema general en casa y no se a que rubro corresponde todavia.',
      request_type: 'unsure',
      urgency: 'flexible',
      address_text: 'Calle 789',
      city: 'Lanus',
      province: 'Buenos Aires',
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (uncategorizedServiceRequestInsert.error || !uncategorizedServiceRequestInsert.data) {
    throw new Error(
      `Customer could not create uncategorized service request: ${uncategorizedServiceRequestInsert.error?.message ?? 'unknown error'}`,
    );
  }

  const uncategorizedOpportunityRead = await bootstrapProfessionalClient.rpc('list_professional_opportunities');

  if (
    uncategorizedOpportunityRead.error ||
    !((uncategorizedOpportunityRead.data ?? []) as ProfessionalOpportunitySmokeRow[]).some(
      (opportunity) => opportunity.request_id === uncategorizedServiceRequestInsert.data.id,
    )
  ) {
    throw new Error(
      `Uncategorized service request was not visible to active professional: ${uncategorizedOpportunityRead.error?.message ?? 'not found'}`,
    );
  }

  const ownApplicationInsert = await professionalClient
    .from('applications')
    .insert({
      request_id: ownServiceRequestInsert.data.id,
      professional_id: professionalProfile.id,
      message: 'Puedo revisar la perdida esta semana y llevar las herramientas necesarias.',
      proposal_type: 'diagnostic_visit',
      visit_price: 5000,
      estimated_price: null,
      estimated_duration_text: 'Una visita breve',
      availability_text: 'Martes o jueves por la tarde',
      status: 'submitted',
    })
    .select('id, status')
    .single();

  if (ownApplicationInsert.error || ownApplicationInsert.data.status !== 'submitted') {
    throw new Error(
      `Professional could not create own application: ${ownApplicationInsert.error?.message ?? 'unknown error'}`,
    );
  }

  const duplicateApplicationInsert = await professionalClient
    .from('applications')
    .insert({
      request_id: ownServiceRequestInsert.data.id,
      professional_id: professionalProfile.id,
      message: 'Intento duplicado de postulacion para validar constraint unico.',
      proposal_type: 'diagnostic_visit',
      visit_price: 5000,
      estimated_price: null,
      estimated_duration_text: null,
      availability_text: 'Viernes por la tarde',
      status: 'submitted',
    })
    .select('id')
    .single();

  if (!duplicateApplicationInsert.error) {
    throw new Error('Professional unexpectedly created a duplicate application.');
  }

  const foreignProfessionalApplicationInsert = await professionalClient
    .from('applications')
    .insert({
      request_id: ownServiceRequestInsert.data.id,
      professional_id: bootstrapProfessionalProfile.data.id,
      message: 'Intento de postular a nombre de otro profesional.',
      proposal_type: 'ask_for_details',
      visit_price: null,
      estimated_price: null,
      estimated_duration_text: null,
      availability_text: 'Necesito mas detalles',
      status: 'submitted',
    })
    .select('id')
    .single();

  if (!foreignProfessionalApplicationInsert.error) {
    throw new Error('Professional unexpectedly applied on behalf of another professional.');
  }

  const foreignApplicationRead = await bootstrapProfessionalClient
    .from('applications')
    .select('id')
    .eq('id', ownApplicationInsert.data.id);

  if (foreignApplicationRead.error) {
    throw new Error(`Unexpected foreign application read error: ${foreignApplicationRead.error.message}`);
  }

  if ((foreignApplicationRead.data ?? []).length !== 0) {
    throw new Error('Professional unexpectedly read another professional application.');
  }

  const selectionServiceRequestInsert = await customerClient
    .from('service_requests')
    .insert({
      customer_id: customerId,
      category_id: null,
      title: 'Solicitud para seleccionar profesional',
      description: 'Solicitud de smoke test con dos postulaciones activas.',
      request_type: 'unsure',
      urgency: 'flexible',
      address_text: 'Calle seleccion 123',
      city: 'Lanus',
      province: 'Buenos Aires',
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .select('id, status')
    .single();

  if (selectionServiceRequestInsert.error || !selectionServiceRequestInsert.data) {
    throw new Error(
      `Customer could not create selection service request: ${selectionServiceRequestInsert.error?.message ?? 'unknown error'}`,
    );
  }

  const selectedCandidateApplication = await professionalClient
    .from('applications')
    .insert({
      request_id: selectionServiceRequestInsert.data.id,
      professional_id: professionalProfile.id,
      message: 'Puedo resolver esta solicitud y coordinar una visita.',
      proposal_type: 'diagnostic_visit',
      visit_price: 6000,
      estimated_price: null,
      estimated_duration_text: 'Una visita',
      availability_text: 'Miercoles por la tarde',
      status: 'submitted',
    })
    .select('id, status')
    .single();

  if (selectedCandidateApplication.error || selectedCandidateApplication.data.status !== 'submitted') {
    throw new Error(
      `Selected candidate application insert failed: ${selectedCandidateApplication.error?.message ?? 'unknown error'}`,
    );
  }

  const rejectedCandidateApplication = await bootstrapProfessionalClient
    .from('applications')
    .insert({
      request_id: selectionServiceRequestInsert.data.id,
      professional_id: bootstrapProfessionalProfile.data.id,
      message: 'Tambien puedo presentarme para validar rechazo automatico.',
      proposal_type: 'ask_for_details',
      visit_price: null,
      estimated_price: null,
      estimated_duration_text: null,
      availability_text: 'Viernes',
      status: 'submitted',
    })
    .select('id, status')
    .single();

  if (rejectedCandidateApplication.error || rejectedCandidateApplication.data.status !== 'submitted') {
    throw new Error(
      `Rejected candidate application insert failed: ${rejectedCandidateApplication.error?.message ?? 'unknown error'}`,
    );
  }

  const ownApplicationsRead = await customerClient.rpc('list_customer_request_applications', {
    p_request_id: selectionServiceRequestInsert.data.id,
  });

  if (ownApplicationsRead.error || (ownApplicationsRead.data ?? []).length !== 2) {
    throw new Error(
      `Customer could not read own request applications: ${ownApplicationsRead.error?.message ?? 'unexpected count'}`,
    );
  }

  if (
    ((ownApplicationsRead.data ?? []) as Record<string, unknown>[]).some(
      (application) => 'professional_phone' in application || 'email' in application,
    )
  ) {
    throw new Error('Customer applications RPC exposed private professional data.');
  }

  const foreignCustomerApplicationsRead = await bootstrapClient.rpc('list_customer_request_applications', {
    p_request_id: selectionServiceRequestInsert.data.id,
  });

  if (foreignCustomerApplicationsRead.error || (foreignCustomerApplicationsRead.data ?? []).length !== 0) {
    throw new Error(
      `Foreign customer unexpectedly read applications: ${foreignCustomerApplicationsRead.error?.message ?? 'unexpected rows'}`,
    );
  }

  const directApplicationSelectionAttempt = await customerClient
    .from('applications')
    .update({ status: 'selected' })
    .eq('id', selectedCandidateApplication.data.id)
    .select('id, status')
    .single();

  if (!directApplicationSelectionAttempt.error) {
    throw new Error('Customer unexpectedly selected an application with direct update.');
  }

  const viewedApplication = await customerClient.rpc('mark_customer_application_viewed', {
    p_application_id: selectedCandidateApplication.data.id,
  });

  if (
    viewedApplication.error ||
    viewedApplication.data?.[0]?.application_id !== selectedCandidateApplication.data.id ||
    viewedApplication.data?.[0]?.status !== 'viewed'
  ) {
    throw new Error(
      `Customer could not mark application as viewed: ${viewedApplication.error?.message ?? 'unexpected result'}`,
    );
  }

  const selectedConversationRead = await customerClient
    .from('conversations')
    .select('id, status')
    .eq('application_id', selectedCandidateApplication.data.id)
    .single();

  if (selectedConversationRead.error || selectedConversationRead.data.status !== 'active') {
    throw new Error(
      `Customer could not read own application conversation: ${selectedConversationRead.error?.message ?? 'unexpected status'}`,
    );
  }

  const professionalConversationRead = await professionalClient
    .from('conversations')
    .select('id')
    .eq('id', selectedConversationRead.data.id)
    .single();

  if (professionalConversationRead.error || professionalConversationRead.data.id !== selectedConversationRead.data.id) {
    throw new Error(
      `Professional could not read own conversation: ${professionalConversationRead.error?.message ?? 'unknown error'}`,
    );
  }

  const thirdPartyConversationRead = await bootstrapClient
    .from('conversations')
    .select('id')
    .eq('id', selectedConversationRead.data.id);

  if (thirdPartyConversationRead.error || (thirdPartyConversationRead.data ?? []).length !== 0) {
    throw new Error(
      `Third party unexpectedly read conversation: ${thirdPartyConversationRead.error?.message ?? 'unexpected rows'}`,
    );
  }

  const mismatchedSenderMessage = await customerClient
    .from('messages')
    .insert({
      conversation_id: selectedConversationRead.data.id,
      sender_user_id: professionalId,
      body: 'Intento de enviar con otro sender.',
    })
    .select('id')
    .single();

  if (!mismatchedSenderMessage.error) {
    throw new Error('Customer unexpectedly inserted a message with a mismatched sender.');
  }

  const emptyMessageAttempt = await customerClient
    .from('messages')
    .insert({
      conversation_id: selectedConversationRead.data.id,
      sender_user_id: customerId,
      body: '   ',
    })
    .select('id')
    .single();

  if (!emptyMessageAttempt.error) {
    throw new Error('Customer unexpectedly inserted an empty message.');
  }

  const customerMessageInsert = await customerClient
    .from('messages')
    .insert({
      conversation_id: selectedConversationRead.data.id,
      sender_user_id: customerId,
      body: 'Hola, queria consultar disponibilidad antes de elegir.',
    })
    .select('id, body')
    .single();

  if (customerMessageInsert.error || customerMessageInsert.data.body.trim().length === 0) {
    throw new Error(
      `Customer could not send message: ${customerMessageInsert.error?.message ?? 'unexpected result'}`,
    );
  }

  const professionalMessagesRead = await professionalClient
    .from('messages')
    .select('id')
    .eq('conversation_id', selectedConversationRead.data.id);

  if (professionalMessagesRead.error || (professionalMessagesRead.data ?? []).length !== 1) {
    throw new Error(
      `Professional could not read customer message: ${professionalMessagesRead.error?.message ?? 'unexpected count'}`,
    );
  }

  const thirdPartyMessagesRead = await bootstrapClient
    .from('messages')
    .select('id')
    .eq('conversation_id', selectedConversationRead.data.id);

  if (thirdPartyMessagesRead.error || (thirdPartyMessagesRead.data ?? []).length !== 0) {
    throw new Error(
      `Third party unexpectedly read messages: ${thirdPartyMessagesRead.error?.message ?? 'unexpected rows'}`,
    );
  }

  const thirdPartyMessageInsert = await bootstrapClient
    .from('messages')
    .insert({
      conversation_id: selectedConversationRead.data.id,
      sender_user_id: createdBootstrapUser.id,
      body: 'Intento de tercero.',
    })
    .select('id')
    .single();

  if (!thirdPartyMessageInsert.error) {
    throw new Error('Third party unexpectedly wrote a conversation message.');
  }

  const professionalUnreadConversation = await professionalClient.rpc('ensure_application_conversation', {
    p_application_id: selectedCandidateApplication.data.id,
  });

  if (
    professionalUnreadConversation.error ||
    professionalUnreadConversation.data?.[0]?.unread_count !== 1
  ) {
    throw new Error(
      `Professional unread count was not updated: ${professionalUnreadConversation.error?.message ?? 'unexpected count'}`,
    );
  }

  const professionalMarkRead = await professionalClient.rpc('mark_conversation_read', {
    p_conversation_id: selectedConversationRead.data.id,
  });

  if (professionalMarkRead.error || professionalMarkRead.data?.[0]?.unread_count !== 0) {
    throw new Error(
      `Professional could not mark conversation read: ${professionalMarkRead.error?.message ?? 'unexpected count'}`,
    );
  }

  const professionalReply = await professionalClient.rpc('send_conversation_message', {
    p_conversation_id: selectedConversationRead.data.id,
    p_body: 'Puedo pasar el miercoles por la tarde.',
  });

  if (professionalReply.error || professionalReply.data?.[0]?.sender_user_id !== professionalId) {
    throw new Error(
      `Professional could not reply in conversation: ${professionalReply.error?.message ?? 'unexpected result'}`,
    );
  }

  const customerUnreadConversation = await customerClient.rpc('ensure_application_conversation', {
    p_application_id: selectedCandidateApplication.data.id,
  });

  if (
    customerUnreadConversation.error ||
    customerUnreadConversation.data?.[0]?.unread_count !== 1
  ) {
    throw new Error(
      `Customer unread count was not updated: ${customerUnreadConversation.error?.message ?? 'unexpected count'}`,
    );
  }

  const customerMarkRead = await customerClient.rpc('mark_conversation_read', {
    p_conversation_id: selectedConversationRead.data.id,
  });

  if (customerMarkRead.error || customerMarkRead.data?.[0]?.unread_count !== 0) {
    throw new Error(
      `Customer could not mark conversation read: ${customerMarkRead.error?.message ?? 'unexpected count'}`,
    );
  }

  const thirdPartyConversationOpen = await bootstrapClient.rpc('get_conversation', {
    p_conversation_id: selectedConversationRead.data.id,
  });

  if (thirdPartyConversationOpen.error || (thirdPartyConversationOpen.data ?? []).length !== 0) {
    throw new Error(
      `Third party unexpectedly opened conversation: ${thirdPartyConversationOpen.error?.message ?? 'unexpected rows'}`,
    );
  }

  const duplicateConversationInsert = await adminClient
    .from('conversations')
    .insert({
      application_id: selectedCandidateApplication.data.id,
      request_id: selectionServiceRequestInsert.data.id,
      customer_id: customerId,
      professional_id: professionalProfile.id,
    })
    .select('id')
    .single();

  if (!duplicateConversationInsert.error) {
    throw new Error('Database unexpectedly allowed a duplicate conversation for one application.');
  }

  const otherCustomerSelectionAttempt = await bootstrapClient.rpc('select_professional_for_request', {
    p_request_id: selectionServiceRequestInsert.data.id,
    p_application_id: selectedCandidateApplication.data.id,
  });

  if (!otherCustomerSelectionAttempt.error) {
    throw new Error('Foreign customer unexpectedly selected a professional.');
  }

  const withdrawnSelectionServiceRequest = await customerClient
    .from('service_requests')
    .insert({
      customer_id: customerId,
      category_id: null,
      title: 'Solicitud con postulacion retirada',
      description: 'Solicitud para validar que no se pueda seleccionar una postulacion retirada.',
      request_type: 'unsure',
      urgency: 'flexible',
      address_text: 'Calle retirada 456',
      city: 'Lanus',
      province: 'Buenos Aires',
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (withdrawnSelectionServiceRequest.error || !withdrawnSelectionServiceRequest.data) {
    throw new Error(
      `Customer could not create withdrawn-selection request: ${withdrawnSelectionServiceRequest.error?.message ?? 'unknown error'}`,
    );
  }

  const withdrawnCandidateApplication = await professionalClient
    .from('applications')
    .insert({
      request_id: withdrawnSelectionServiceRequest.data.id,
      professional_id: professionalProfile.id,
      message: 'Postulacion que sera retirada antes de seleccionar.',
      proposal_type: 'diagnostic_visit',
      visit_price: 6000,
      estimated_price: null,
      estimated_duration_text: null,
      availability_text: 'Miercoles',
      status: 'submitted',
    })
    .select('id')
    .single();

  if (withdrawnCandidateApplication.error || !withdrawnCandidateApplication.data) {
    throw new Error(
      `Withdrawn candidate application insert failed: ${withdrawnCandidateApplication.error?.message ?? 'unknown error'}`,
    );
  }

  const withdrawnCandidateUpdate = await professionalClient
    .from('applications')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', withdrawnCandidateApplication.data.id)
    .select('id, status')
    .single();

  if (withdrawnCandidateUpdate.error || withdrawnCandidateUpdate.data.status !== 'withdrawn') {
    throw new Error(
      `Professional could not withdraw selection candidate: ${withdrawnCandidateUpdate.error?.message ?? 'unknown error'}`,
    );
  }

  const withdrawnConversationRead = await customerClient
    .from('conversations')
    .select('id, status')
    .eq('application_id', withdrawnCandidateApplication.data.id)
    .single();

  if (withdrawnConversationRead.error || withdrawnConversationRead.data.status !== 'read_only') {
    throw new Error(
      `Withdrawn application conversation did not become read-only: ${withdrawnConversationRead.error?.message ?? 'unexpected status'}`,
    );
  }

  const withdrawnConversationMessageAttempt = await customerClient.rpc('send_conversation_message', {
    p_conversation_id: withdrawnConversationRead.data.id,
    p_body: 'No deberia poder enviarse.',
  });

  if (!withdrawnConversationMessageAttempt.error) {
    throw new Error('Customer unexpectedly sent a message to a withdrawn application conversation.');
  }

  const withdrawnSelectionAttempt = await customerClient.rpc('select_professional_for_request', {
    p_request_id: withdrawnSelectionServiceRequest.data.id,
    p_application_id: withdrawnCandidateApplication.data.id,
  });

  if (!withdrawnSelectionAttempt.error) {
    throw new Error('Customer unexpectedly selected a withdrawn application.');
  }

  const validSelection = await customerClient.rpc('select_professional_for_request', {
    p_request_id: selectionServiceRequestInsert.data.id,
    p_application_id: selectedCandidateApplication.data.id,
  });

  if (
    validSelection.error ||
    validSelection.data?.[0]?.request_status !== 'professional_selected' ||
    validSelection.data?.[0]?.selected_professional_id !== professionalProfile.id ||
    !validSelection.data?.[0]?.job_id
  ) {
    throw new Error(`Valid professional selection failed: ${validSelection.error?.message ?? 'unexpected result'}`);
  }

  const selectedServiceRequestRead = await customerClient
    .from('service_requests')
    .select('id, status, selected_professional_id')
    .eq('id', selectionServiceRequestInsert.data.id)
    .single();

  if (
    selectedServiceRequestRead.error ||
    selectedServiceRequestRead.data.status !== 'professional_selected' ||
    selectedServiceRequestRead.data.selected_professional_id !== professionalProfile.id
  ) {
    throw new Error(
      `Selected service request was not persisted correctly: ${selectedServiceRequestRead.error?.message ?? 'unexpected result'}`,
    );
  }

  const selectedApplicationRead = await professionalClient
    .from('applications')
    .select('id, status')
    .eq('id', selectedCandidateApplication.data.id)
    .single();

  if (selectedApplicationRead.error || selectedApplicationRead.data.status !== 'selected') {
    throw new Error(
      `Chosen application was not selected: ${selectedApplicationRead.error?.message ?? 'unexpected status'}`,
    );
  }

  const rejectedApplicationRead = await bootstrapProfessionalClient
    .from('applications')
    .select('id, status')
    .eq('id', rejectedCandidateApplication.data.id)
    .single();

  if (rejectedApplicationRead.error || rejectedApplicationRead.data.status !== 'rejected') {
    throw new Error(
      `Other application was not rejected: ${rejectedApplicationRead.error?.message ?? 'unexpected status'}`,
    );
  }

  const selectedConversationAfterSelection = await customerClient
    .from('conversations')
    .select('id, status')
    .eq('application_id', selectedCandidateApplication.data.id)
    .single();

  if (
    selectedConversationAfterSelection.error ||
    selectedConversationAfterSelection.data.status !== 'active'
  ) {
    throw new Error(
      `Selected conversation did not remain active: ${selectedConversationAfterSelection.error?.message ?? 'unexpected status'}`,
    );
  }

  const selectedConversationMessageAfterSelection = await customerClient.rpc('send_conversation_message', {
    p_conversation_id: selectedConversationAfterSelection.data.id,
    p_body: 'Gracias, te selecciono para avanzar.',
  });

  if (selectedConversationMessageAfterSelection.error) {
    throw new Error(
      `Selected conversation did not accept messages: ${selectedConversationMessageAfterSelection.error.message}`,
    );
  }

  const rejectedConversationAfterSelection = await bootstrapProfessionalClient
    .from('conversations')
    .select('id, status')
    .eq('application_id', rejectedCandidateApplication.data.id)
    .single();

  if (
    rejectedConversationAfterSelection.error ||
    rejectedConversationAfterSelection.data.status !== 'read_only'
  ) {
    throw new Error(
      `Rejected conversation did not become read-only: ${rejectedConversationAfterSelection.error?.message ?? 'unexpected status'}`,
    );
  }

  const rejectedConversationMessageAttempt = await bootstrapProfessionalClient.rpc('send_conversation_message', {
    p_conversation_id: rejectedConversationAfterSelection.data.id,
    p_body: 'No deberia poder responder tras el rechazo.',
  });

  if (!rejectedConversationMessageAttempt.error) {
    throw new Error('Rejected application conversation unexpectedly accepted a message.');
  }

  const doubleSelectionAttempt = await customerClient.rpc('select_professional_for_request', {
    p_request_id: selectionServiceRequestInsert.data.id,
    p_application_id: rejectedCandidateApplication.data.id,
  });

  if (!doubleSelectionAttempt.error) {
    throw new Error('Customer unexpectedly selected a second professional.');
  }

  const selectedProfessionalJobs = await professionalClient.rpc('list_professional_selected_jobs');

  if (
    selectedProfessionalJobs.error ||
    !((selectedProfessionalJobs.data ?? []) as { job_id: string | null; job_status: string | null; request_id: string }[]).some(
      (job) =>
        job.request_id === selectionServiceRequestInsert.data.id &&
        job.job_id !== null &&
        job.job_status === 'coordination_pending',
    )
  ) {
    throw new Error(
      `Selected professional did not see selected job: ${selectedProfessionalJobs.error?.message ?? 'not found'}`,
    );
  }

  const selectedJobRead = await customerClient.rpc('get_job_by_request', {
    p_request_id: selectionServiceRequestInsert.data.id,
  });
  const selectedJob = selectedJobRead.data?.[0] as { job_id: string; status: string } | undefined;

  if (selectedJobRead.error || !selectedJob || selectedJob.status !== 'coordination_pending') {
    throw new Error(
      `Job was not created after professional selection: ${selectedJobRead.error?.message ?? 'not found'}`,
    );
  }

  if (selectedJob.job_id !== validSelection.data[0].job_id) {
    throw new Error('Selection RPC did not return the created job id.');
  }

  const selectedJobsCount = await adminClient
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('request_id', selectionServiceRequestInsert.data.id);

  if (selectedJobsCount.error || selectedJobsCount.count !== 1) {
    throw new Error(
      `Selection did not create exactly one job: ${selectedJobsCount.error?.message ?? selectedJobsCount.count}`,
    );
  }

  const duplicateJobInsert = await adminClient
    .from('jobs')
    .insert({
      request_id: selectionServiceRequestInsert.data.id,
      selected_application_id: selectedCandidateApplication.data.id,
      customer_id: customerId,
      professional_id: professionalProfile.id,
      status: 'coordination_pending',
    })
    .select('id')
    .single();

  if (!duplicateJobInsert.error) {
    throw new Error('Database unexpectedly allowed a second job for one request.');
  }

  const foreignCustomerJobRead = await bootstrapClient.rpc('get_job_by_request', {
    p_request_id: selectionServiceRequestInsert.data.id,
  });

  if (foreignCustomerJobRead.error || (foreignCustomerJobRead.data ?? []).length !== 0) {
    throw new Error(
      `Foreign customer unexpectedly accessed job: ${foreignCustomerJobRead.error?.message ?? 'unexpected rows'}`,
    );
  }

  const foreignProfessionalJobRead = await bootstrapProfessionalClient.rpc('get_job_by_request', {
    p_request_id: selectionServiceRequestInsert.data.id,
  });

  if (foreignProfessionalJobRead.error || (foreignProfessionalJobRead.data ?? []).length !== 0) {
    throw new Error(
      `Foreign professional unexpectedly accessed job: ${foreignProfessionalJobRead.error?.message ?? 'unexpected rows'}`,
    );
  }

  const foreignVisitProposal = await bootstrapProfessionalClient.rpc('propose_job_visit', {
    p_job_id: selectedJob.job_id,
    p_scheduled_date: '2026-08-01',
    p_scheduled_time_text: '10 a 12',
    p_scheduling_notes: 'Intento ajeno.',
  });

  if (!foreignVisitProposal.error) {
    throw new Error('Foreign professional unexpectedly proposed a visit.');
  }

  const prematureDiagnosis = await professionalClient.rpc('record_job_diagnosis', {
    p_job_id: selectedJob.job_id,
    p_diagnosis_text: 'Diagnostico con longitud suficiente pero antes de confirmar visita.',
    p_recommended_work_text: 'Trabajo recomendado suficiente.',
    p_materials_notes: null,
    p_diagnosis_notes: null,
  });

  if (!prematureDiagnosis.error) {
    throw new Error('Professional unexpectedly registered diagnosis before confirmed visit.');
  }

  const visitProposal = await professionalClient.rpc('propose_job_visit', {
    p_job_id: selectedJob.job_id,
    p_scheduled_date: '2026-08-01',
    p_scheduled_time_text: '10 a 12',
    p_scheduling_notes: 'Coordinar acceso por chat.',
  });

  if (visitProposal.error || visitProposal.data?.[0]?.status !== 'visit_proposed') {
    throw new Error(`Selected professional could not propose visit: ${visitProposal.error?.message ?? 'unexpected status'}`);
  }

  const confirmedVisit = await customerClient.rpc('confirm_job_visit', {
    p_job_id: selectedJob.job_id,
  });

  if (confirmedVisit.error || confirmedVisit.data?.[0]?.status !== 'visit_confirmed') {
    throw new Error(`Customer could not confirm visit: ${confirmedVisit.error?.message ?? 'unexpected status'}`);
  }

  const diagnosis = await professionalClient.rpc('record_job_diagnosis', {
    p_job_id: selectedJob.job_id,
    p_diagnosis_text: 'La instalacion requiere reemplazo de piezas y ajuste general con materiales menores.',
    p_recommended_work_text: 'Reemplazar piezas dañadas y ajustar la instalacion.',
    p_materials_notes: 'Materiales menores incluidos.',
    p_diagnosis_notes: 'Cliente presente durante la visita.',
  });

  if (
    diagnosis.error ||
    diagnosis.data?.[0]?.status !== 'quote_pending' ||
    diagnosis.data?.[0]?.recommended_work_text !== 'Reemplazar piezas dañadas y ajustar la instalacion.'
  ) {
    throw new Error(`Selected professional could not register diagnosis: ${diagnosis.error?.message ?? 'unexpected status'}`);
  }

  const firstQuote = await professionalClient.rpc('create_job_quote', {
    p_job_id: selectedJob.job_id,
    p_labor_amount: 10000,
    p_materials_amount: 2500,
    p_visit_amount: 1500,
    p_description: 'Presupuesto formal inicial con mano de obra y materiales necesarios.',
    p_estimated_duration_text: 'Un dia',
    p_valid_until: '2026-08-30',
  });
  const firstQuoteRow = firstQuote.data?.[0] as {
    id: string;
    platform_fee_amount: number | string;
    total_amount: number | string;
    version: number;
  } | undefined;

  if (
    firstQuote.error ||
    !firstQuoteRow ||
    Number(firstQuoteRow.platform_fee_amount) !== 500 ||
    Number(firstQuoteRow.total_amount) !== 12000
  ) {
    throw new Error(`Backend did not create quote with calculated total: ${firstQuote.error?.message ?? 'unexpected total'}`);
  }

  const retriedFirstQuote = await professionalClient.rpc('create_job_quote', {
    p_job_id: selectedJob.job_id,
    p_labor_amount: 11000,
    p_materials_amount: 2500,
    p_visit_amount: 1500,
    p_description: 'Presupuesto formal inicial actualizado sin duplicar version.',
    p_estimated_duration_text: 'Un dia',
    p_valid_until: '2026-08-30',
  });
  const retriedFirstQuoteRow = retriedFirstQuote.data?.[0] as {
    id: string;
    platform_fee_amount: number | string;
    total_amount: number | string;
    version: number;
  } | undefined;

  if (
    retriedFirstQuote.error ||
    !retriedFirstQuoteRow ||
    retriedFirstQuoteRow.id !== firstQuoteRow.id ||
    retriedFirstQuoteRow.version !== 1 ||
    Number(retriedFirstQuoteRow.platform_fee_amount) !== 550 ||
    Number(retriedFirstQuoteRow.total_amount) !== 13050
  ) {
    throw new Error(`Quote retry duplicated or failed to update draft: ${retriedFirstQuote.error?.message ?? 'unexpected row'}`);
  }

  const sentFirstQuote = await professionalClient.rpc('send_job_quote', {
    p_quote_id: firstQuoteRow.id,
  });

  if (sentFirstQuote.error || sentFirstQuote.data?.[0]?.status !== 'sent') {
    throw new Error(`Professional could not send quote: ${sentFirstQuote.error?.message ?? 'unexpected status'}`);
  }

  const sentJobRead = await customerClient
    .from('jobs')
    .select('status')
    .eq('id', selectedJob.job_id)
    .single();

  if (sentJobRead.error || sentJobRead.data.status !== 'quote_sent') {
    throw new Error(`Job was not marked quote_sent: ${sentJobRead.error?.message ?? 'unexpected status'}`);
  }

  const sentQuoteEditAttempt = await professionalClient
    .from('job_quotes')
    .update({ labor_amount: 1 })
    .eq('id', firstQuoteRow.id)
    .select('id')
    .single();

  if (!sentQuoteEditAttempt.error) {
    throw new Error('Professional unexpectedly edited a sent quote directly.');
  }

  const foreignCustomerAccept = await bootstrapClient.rpc('accept_job_quote', {
    p_quote_id: firstQuoteRow.id,
  });

  if (!foreignCustomerAccept.error) {
    throw new Error('Foreign customer unexpectedly accepted a quote.');
  }

  const professionalAccept = await professionalClient.rpc('accept_job_quote', {
    p_quote_id: firstQuoteRow.id,
  });

  if (!professionalAccept.error) {
    throw new Error('Professional unexpectedly accepted a quote.');
  }

  const rejectedQuote = await customerClient.rpc('reject_job_quote', {
    p_quote_id: firstQuoteRow.id,
    p_rejected_reason: 'Necesito ajustar materiales.',
  });

  if (rejectedQuote.error || rejectedQuote.data?.[0]?.job_status !== 'quote_rejected') {
    throw new Error(`Customer could not reject quote: ${rejectedQuote.error?.message ?? 'unexpected status'}`);
  }

  const rejectedQuoteRead = await customerClient
    .from('job_quotes')
    .select('rejection_reason')
    .eq('id', firstQuoteRow.id)
    .single();

  if (rejectedQuoteRead.error || rejectedQuoteRead.data.rejection_reason !== 'Necesito ajustar materiales.') {
    throw new Error(
      `Quote rejection reason was not persisted: ${rejectedQuoteRead.error?.message ?? 'unexpected reason'}`,
    );
  }

  const secondQuote = await professionalClient.rpc('create_job_quote', {
    p_job_id: selectedJob.job_id,
    p_labor_amount: 12000,
    p_materials_amount: 3000,
    p_visit_amount: 1500,
    p_description: 'Presupuesto version dos luego del rechazo del cliente.',
    p_estimated_duration_text: 'Un dia',
    p_valid_until: '2026-08-30',
  });
  const secondQuoteRow = secondQuote.data?.[0] as { id: string } | undefined;

  if (secondQuote.error || !secondQuoteRow) {
    throw new Error(`Professional could not create version after rejection: ${secondQuote.error?.message ?? 'not found'}`);
  }

  const sentSecondQuote = await professionalClient.rpc('send_job_quote', {
    p_quote_id: secondQuoteRow.id,
  });

  if (sentSecondQuote.error || sentSecondQuote.data?.[0]?.status !== 'sent') {
    throw new Error(`Professional could not send second quote: ${sentSecondQuote.error?.message ?? 'unexpected status'}`);
  }

  const sentQuoteReplacementAttempt = await professionalClient.rpc('create_job_quote', {
    p_job_id: selectedJob.job_id,
    p_labor_amount: 13000,
    p_materials_amount: 3000,
    p_visit_amount: 1500,
    p_description: 'Intento de crear version mientras hay un presupuesto enviado.',
    p_estimated_duration_text: 'Un dia',
    p_valid_until: '2026-08-30',
  });

  if (!sentQuoteReplacementAttempt.error) {
    throw new Error('Professional unexpectedly created a new quote while a sent quote is pending response.');
  }

  const acceptedQuote = await customerClient.rpc('accept_job_quote', {
    p_quote_id: secondQuoteRow.id,
  });

  if (acceptedQuote.error || acceptedQuote.data?.[0]?.job_status !== 'quote_accepted') {
    throw new Error(`Customer could not accept own quote: ${acceptedQuote.error?.message ?? 'unexpected status'}`);
  }

  const acceptedJobRead = await customerClient
    .from('jobs')
    .select('status')
    .eq('id', selectedJob.job_id)
    .single();

  if (acceptedJobRead.error || acceptedJobRead.data.status !== 'quote_accepted') {
    throw new Error(`Job was not marked quote_accepted: ${acceptedJobRead.error?.message ?? 'unexpected status'}`);
  }

  const ownApplicationWithdraw = await professionalClient
    .from('applications')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', ownApplicationInsert.data.id)
    .select('id, status')
    .single();

  if (ownApplicationWithdraw.error || ownApplicationWithdraw.data.status !== 'withdrawn') {
    throw new Error(
      `Professional could not withdraw own application: ${ownApplicationWithdraw.error?.message ?? 'unknown error'}`,
    );
  }

  const { data: selectedApplication, error: selectedApplicationError } = await adminClient
    .from('applications')
    .insert({
      request_id: uncategorizedServiceRequestInsert.data.id,
      professional_id: bootstrapProfessionalProfile.data.id,
      message: 'Postulacion seleccionada creada por service role para probar bloqueo de retiro.',
      proposal_type: 'ask_for_details',
      availability_text: 'Disponible',
      status: 'selected',
    })
    .select('id')
    .single();

  if (selectedApplicationError || !selectedApplication) {
    throw new Error(
      `Unable to create selected application for smoke test: ${selectedApplicationError?.message ?? 'unknown error'}`,
    );
  }

  const selectedApplicationWithdrawAttempt = await bootstrapProfessionalClient
    .from('applications')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', selectedApplication.id)
    .select('id, status')
    .single();

  if (!selectedApplicationWithdrawAttempt.error) {
    throw new Error('Professional unexpectedly withdrew a selected application.');
  }

  const foreignServiceRequestInsert = await bootstrapClient
    .from('service_requests')
    .insert({
      customer_id: customerId,
      category_id: serviceRequestCategoryId,
      title: 'Solicitud ajena',
      description: 'Intento de crear una solicitud para otro cliente desde RLS smoke.',
      request_type: 'quote',
      urgency: 'flexible',
      address_text: 'Calle 456',
      city: 'Lanus',
      province: 'Buenos Aires',
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (!foreignServiceRequestInsert.error) {
    throw new Error('Bootstrap user unexpectedly created a service request for another customer.');
  }

  const foreignServiceRequestRead = await bootstrapClient
    .from('service_requests')
    .select('id')
    .eq('id', ownServiceRequestInsert.data.id);

  if (foreignServiceRequestRead.error) {
    throw new Error(`Unexpected foreign service request read error: ${foreignServiceRequestRead.error.message}`);
  }

  if ((foreignServiceRequestRead.data ?? []).length !== 0) {
    throw new Error('Bootstrap user unexpectedly read another customer service request.');
  }

  const foreignServiceRequestCancel = await bootstrapClient
    .from('service_requests')
    .update({ status: 'cancelled' })
    .eq('id', ownServiceRequestInsert.data.id)
    .select('id, status')
    .single();

  if (!foreignServiceRequestCancel.error) {
    throw new Error('Bootstrap user unexpectedly cancelled another customer service request.');
  }

  const ownServiceRequestCancel = await customerClient
    .from('service_requests')
    .update({ status: 'cancelled' })
    .eq('id', ownServiceRequestInsert.data.id)
    .select('id, status')
    .single();

  if (ownServiceRequestCancel.error || ownServiceRequestCancel.data.status !== 'cancelled') {
    throw new Error(
      `Customer could not cancel own published service request: ${ownServiceRequestCancel.error?.message ?? 'unknown error'}`,
    );
  }

  const serviceRequestReactivationAttempt = await customerClient
    .from('service_requests')
    .update({ status: 'published' })
    .eq('id', ownServiceRequestInsert.data.id)
    .select('id, status')
    .single();

  if (!serviceRequestReactivationAttempt.error) {
    throw new Error('Customer unexpectedly reactivated a cancelled service request.');
  }

  const cancelledOnlyServiceRequest = await customerClient
    .from('service_requests')
    .insert({
      customer_id: customerId,
      category_id: serviceRequestCategoryId,
      title: 'Solicitud cancelada sin postulaciones',
      description: 'Solicitud publicada y cancelada para validar que no acepte postulaciones.',
      request_type: 'specific_task',
      urgency: 'soon',
      address_text: 'Calle 999',
      city: 'Lanus',
      province: 'Buenos Aires',
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (cancelledOnlyServiceRequest.error || !cancelledOnlyServiceRequest.data) {
    throw new Error(
      `Customer could not create cancellable service request: ${cancelledOnlyServiceRequest.error?.message ?? 'unknown error'}`,
    );
  }

  const cancelledOnlyServiceRequestCancel = await customerClient
    .from('service_requests')
    .update({ status: 'cancelled' })
    .eq('id', cancelledOnlyServiceRequest.data.id)
    .select('id, status')
    .single();

  if (
    cancelledOnlyServiceRequestCancel.error ||
    cancelledOnlyServiceRequestCancel.data.status !== 'cancelled'
  ) {
    throw new Error(
      `Customer could not cancel cancellable service request: ${cancelledOnlyServiceRequestCancel.error?.message ?? 'unknown error'}`,
    );
  }

  const cancelledApplicationInsert = await professionalClient
    .from('applications')
    .insert({
      request_id: cancelledOnlyServiceRequest.data.id,
      professional_id: professionalProfile.id,
      message: 'Intento de postular a una solicitud cancelada.',
      proposal_type: 'diagnostic_visit',
      visit_price: 5000,
      estimated_price: null,
      estimated_duration_text: null,
      availability_text: 'Esta semana',
      status: 'submitted',
    })
    .select('id')
    .single();

  if (!cancelledApplicationInsert.error) {
    throw new Error('Professional unexpectedly applied to a cancelled service request.');
  }

  console.log('RLS smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
