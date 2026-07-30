import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260730210000_public_professional_profiles.sql'), 'utf8');

describe('public professional profile migration', () => {
  it('creates portfolio limits and future job association', () => {
    expect(sql).toContain('create table public.professional_portfolio_items');
    expect(sql).toContain('job_id uuid references public.jobs');
    expect(sql).toContain("raise exception 'Portfolio item limit reached.'");
    expect(sql).toContain("raise exception 'Attachment limit reached.'");
  });
  it('protects ownership and hides non-visible items', () => {
    expect(sql).toContain('professional_portfolio_update_owner');
    expect(sql).toContain('pp.user_id = auth.uid()');
    expect(sql).toContain('is_visible');
  });
  it('uses private signed media without exposing contact fields', () => {
    expect(sql).toContain("values ('profile-media', 'profile-media', false");
    expect(sql).not.toContain('phone text');
    expect(sql).not.toContain('email text');
  });
});
