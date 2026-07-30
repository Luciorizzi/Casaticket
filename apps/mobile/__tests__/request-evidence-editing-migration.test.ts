import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20260730170000_edit_published_request_evidence.sql'), 'utf8');

describe('published request evidence editing migration', () => {
  it('restricts editing to the owner and mutable request and job states', () => {
    expect(sql).toContain('sr.customer_id = auth.uid()');
    expect(sql).toContain("sr.status in ('published', 'receiving_applications', 'professional_selected')");
    expect(sql).toContain("j.status in ('review_pending', 'completion_pending', 'completed', 'disputed', 'cancelled')");
    expect(sql).toContain('public.can_edit_request_evidence(p_service_request_id)');
  });

  it('keeps server-side file and total-count validation', () => {
    expect(sql).toContain("p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')");
    expect(sql).toContain('>= 5');
    expect(sql).toContain("raise exception 'Attachment limit reached.'");
  });

  it('prevents deleting immutable request evidence through RPC or storage', () => {
    expect(sql).toContain("target.attachment_type = 'request_evidence'");
    expect(sql).toContain("raise exception 'Request evidence can no longer be edited.'");
    expect(sql).toContain("a.attachment_type <> 'request_evidence' or public.can_edit_request_evidence(a.service_request_id)");
  });
});
