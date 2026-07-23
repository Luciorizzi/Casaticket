import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Supabase seed', () => {
  it('does not insert persistent service request fixtures', () => {
    const seedSql = readFileSync(resolve(__dirname, '../../../supabase/seed.sql'), 'utf8');

    expect(seedSql).not.toMatch(/insert\s+into\s+public\.service_requests/i);
  });
});
