import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260730200000_enrich_professional_applications.sql'),
  'utf8',
);

describe('professional applications tracking migration', () => {
  it('returns only applications owned by the authenticated professional', () => {
    expect(migration).toContain('where pp.user_id = auth.uid()');
    expect(migration).toContain('join public.professional_profiles pp on pp.id = a.professional_id');
  });

  it('returns safe request summary and the selected job id without an exact address', () => {
    expect(migration).toContain('request_title text');
    expect(migration).toContain('category_name text');
    expect(migration).toContain('selected_professional_id uuid');
    expect(migration).toContain('job_id uuid');
    expect(migration).not.toContain('address_text');
  });

  it('keeps own application details readable after the opportunity closes', () => {
    expect(migration).toContain('or exists (');
    expect(migration).toContain('and pp.user_id = auth.uid()');
  });
});
