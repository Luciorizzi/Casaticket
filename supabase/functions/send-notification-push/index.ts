import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json' };

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return new Response(JSON.stringify({ error: 'Server configuration missing' }), { headers, status: 500 });
  const authorization = request.headers.get('Authorization');
  if (authorization !== `Bearer ${serviceRoleKey}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers, status: 401 });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const body = await request.json() as { notificationId?: string; processReceipts?: boolean };

  if (body.processReceipts) {
    const { data: attempts } = await admin.from('push_delivery_attempts').select('id, expo_ticket_id, push_token_id').eq('status', 'sent').not('expo_ticket_id', 'is', null).limit(300) as { data: Array<{ id: string; expo_ticket_id: string; push_token_id: string }> | null };
    if (!attempts?.length) return new Response(JSON.stringify({ processed: 0 }), { headers });
    const receiptResponse = await fetch('https://exp.host/--/api/v2/push/getReceipts', { body: JSON.stringify({ ids: attempts.map((attempt) => attempt.expo_ticket_id) }), headers, method: 'POST' });
    const receipts = (await receiptResponse.json()) as { data?: Record<string, { status: string; details?: { error?: string }; message?: string }> };
    for (const attempt of attempts) {
      const receipt = receipts.data?.[attempt.expo_ticket_id as string];
      if (!receipt) continue;
      const failed = receipt.status === 'error';
      await admin.from('push_delivery_attempts').update({ error: receipt.message ?? receipt.details?.error ?? null, status: failed ? 'failed' : 'delivered' }).eq('id', attempt.id);
      if (receipt.details?.error === 'DeviceNotRegistered') await admin.from('push_tokens').update({ enabled: false }).eq('id', attempt.push_token_id);
    }
    return new Response(JSON.stringify({ processed: attempts.length }), { headers });
  }

  if (!body.notificationId) return new Response(JSON.stringify({ error: 'notificationId required' }), { headers, status: 400 });
  const { data: notification } = await admin.from('notifications').select('*').eq('id', body.notificationId).single();
  if (!notification) return new Response(JSON.stringify({ error: 'Notification not found' }), { headers, status: 404 });
  const { data: tokens } = await admin.from('push_tokens').select('id, expo_push_token').eq('user_id', notification.user_id).eq('enabled', true) as { data: Array<{ id: string; expo_push_token: string }> | null };
  if (!tokens?.length) return new Response(JSON.stringify({ sent: 0 }), { headers });
  const messages = tokens.map((token) => ({ body: notification.body, data: { notificationId: notification.id, route: notification.route, routeParams: notification.route_params }, sound: 'default', title: notification.title, to: token.expo_push_token }));
  const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', { body: JSON.stringify(messages), headers, method: 'POST' });
  const tickets = (await pushResponse.json()) as { data?: Array<{ id?: string; status: string; details?: { error?: string }; message?: string }> };
  for (const [index, token] of tokens.entries()) {
    const ticket = tickets.data?.[index];
    const failed = !ticket || ticket.status === 'error';
    await admin.from('push_delivery_attempts').upsert({ error: ticket?.message ?? ticket?.details?.error ?? null, expo_ticket_id: ticket?.id ?? null, notification_id: notification.id, push_token_id: token.id, status: failed ? 'failed' : 'sent' }, { onConflict: 'notification_id,push_token_id' });
    if (ticket?.details?.error === 'DeviceNotRegistered') await admin.from('push_tokens').update({ enabled: false }).eq('id', token.id);
  }
  return new Response(JSON.stringify({ sent: tokens.length }), { headers });
});
