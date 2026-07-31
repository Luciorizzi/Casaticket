import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('job location privacy migration', () => {
  const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20260731102000_participant_job_location.sql'), 'utf8');

  it('returns exact address only to the customer or selected professional', () => {
    expect(sql).toContain('j.customer_id = auth.uid() or pp.user_id = auth.uid()');
    expect(sql).toContain('sr.address_text');
  });
});
