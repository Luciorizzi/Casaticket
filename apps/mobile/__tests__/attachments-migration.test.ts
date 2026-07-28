import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20260728180000_private_service_attachments.sql'), 'utf8');

describe('private service attachments migration', () => {
  it('creates a private bucket and never exposes public URLs', () => {
    expect(sql).toContain("values ('service-attachments', 'service-attachments', false");
    expect(sql).not.toContain('getPublicUrl');
  });

  it('validates ownership, compatibility, selected job participants and the five-file limit', () => {
    expect(sql).toContain('public.is_professional_compatible_with_request');
    expect(sql).toContain('public.is_job_participant');
    expect(sql).toContain('a.owner_id = auth.uid()');
    expect(sql).toContain('>= 5');
    expect(sql).toContain('pg_advisory_xact_lock');
  });

  it('allows registration and deletion only through security-definer functions', () => {
    expect(sql).toContain('function public.register_attachment');
    expect(sql).toContain('function public.delete_own_attachment');
    expect(sql).not.toContain('grant insert on public.attachments to authenticated');
  });
});
