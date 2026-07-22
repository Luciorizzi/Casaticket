import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('selected jobs migration', () => {
  const migration = readFileSync(
    resolve(__dirname, '../../../supabase/migrations/20260721114000_finalize_selected_jobs.sql'),
    'utf8',
  );

  it('creates a job when a professional is selected', () => {
    expect(migration).toContain('create function public.select_professional_for_request');
    expect(migration).toContain('insert into public.jobs');
    expect(migration).toContain('job_id uuid');
    expect(migration).toContain("'coordination_pending'");
  });

  it('backfills selected requests without duplicating jobs', () => {
    expect(migration).toContain("where sr.status = 'professional_selected'");
    expect(migration).toContain('not exists');
    expect(migration).toContain('on conflict on constraint jobs_request_id_key do nothing');
  });
});
