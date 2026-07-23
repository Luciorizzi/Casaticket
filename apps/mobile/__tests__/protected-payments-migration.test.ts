import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260723110000_protected_mock_payments.sql'),
  'utf8',
);

describe('protected payments migration', () => {
  it('creates protected payment states and avoids charging materials', () => {
    expect(migration).toContain('create table if not exists public.payments');
    expect(migration).toContain("'payment_pending'");
    expect(migration).toContain("'review_pending'");
    expect(migration).toContain('materials_reference_amount');
    expect(migration).toContain('calculated_customer_total_amount := quote_record.labor_amount + quote_record.visit_amount + calculated_platform_fee_amount');
    expect(migration).toContain('calculated_professional_amount := quote_record.labor_amount + quote_record.visit_amount');
  });

  it('uses RPCs for sensitive payment and job transitions', () => {
    expect(migration).toContain('public.accept_quote_and_create_payment');
    expect(migration).toContain('public.secure_mock_payment');
    expect(migration).toContain('public.retry_mock_payment');
    expect(migration).toContain('public.start_job');
    expect(migration).toContain('public.mark_job_completed_by_professional');
    expect(migration).toContain('public.complete_expired_jobs');
    expect(migration).toContain('public.release_eligible_payments');
    expect(migration).toContain('public.refund_mock_payment');
  });

  it('guards release, refund, idempotency and reviews after release', () => {
    expect(migration).toContain('on conflict (job_id) do nothing');
    expect(migration).toContain("p.status = 'release_pending'");
    expect(migration).toContain("p.status = 'released'");
    expect(migration).toContain("payment_record.status not in ('disputed', 'refund_pending')");
    expect(migration).toContain("p.status = 'released'");
    expect(migration).toContain('Reviews are only allowed after payment release.');
  });
});
