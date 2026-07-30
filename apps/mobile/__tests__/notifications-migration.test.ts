import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20260730190000_notifications_and_push_tokens.sql'), 'utf8');

describe('notifications migration', () => {
  it('creates persisted notifications, push tokens, dedupe and RLS', () => {
    expect(sql).toContain('create table public.notifications');
    expect(sql).toContain('create table public.push_tokens');
    expect(sql).toContain('notifications_user_dedupe_key_unique');
    expect(sql).toContain('alter table public.notifications enable row level security');
    expect(sql).toContain('user_id = auth.uid()');
    expect(sql).not.toContain('grant insert on public.notifications to authenticated');
  });

  it('integrates the initial domain events with stable dedupe keys', () => {
    expect(sql).toContain("'application:' || new.id || ':created'");
    expect(sql).toContain("'message:' || new.id || ':received'");
    expect(sql).toContain("'quote:' || new.id || ':submitted'");
    expect(sql).toContain("'payment:' || new.id || ':secured'");
    expect(sql).toContain("'job:' || new.id || ':completed'");
  });

  it('supports individual and bulk read plus owner-scoped token registration', () => {
    expect(sql).toContain('function public.mark_notification_read');
    expect(sql).toContain('function public.mark_all_notifications_read');
    expect(sql).toContain('function public.register_push_token');
    expect(sql).toContain('values (auth.uid(), p_expo_push_token');
  });

  it('does not expose a service-role secret in mobile notification code', () => {
    const mobileSource = fs.readFileSync(path.resolve(__dirname, '../src/features/notifications/api.ts'), 'utf8')
      + fs.readFileSync(path.resolve(__dirname, '../src/features/notifications/notification-provider.tsx'), 'utf8');
    expect(mobileSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(mobileSource).not.toContain('service_role');
  });
});
