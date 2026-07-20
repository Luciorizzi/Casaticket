import type { Session } from '@supabase/supabase-js';

import { getSupabaseErrorMetadata } from '@/lib/errors';

export const INVALID_SESSION_MESSAGE = 'Tu sesión ya no es válida. Volvé a iniciar sesión.';

const invalidSessionCodes = new Set([
  'bad_jwt',
  'invalid_jwt',
  'jwt_expired',
  'refresh_token_not_found',
  'session_expired',
  'session_not_found',
  'user_not_found',
]);

const invalidSessionMessagePatterns = [
  'invalid jwt',
  'jwt expired',
  'jwt is expired',
  'jwt malformed',
  'session expired',
  'user from sub claim in jwt does not exist',
  'user does not exist',
  'refresh token not found',
  'session from session_id claim in jwt does not exist',
];

export function hasExpiredSession(session: Session): boolean {
  return typeof session.expires_at === 'number' && session.expires_at <= Math.floor(Date.now() / 1000);
}

export function isInvalidSessionError(error: unknown): boolean {
  const metadata = getSupabaseErrorMetadata(error);
  const normalizedCode = metadata.code?.toLowerCase();

  if (normalizedCode && invalidSessionCodes.has(normalizedCode)) {
    return true;
  }

  const normalizedMessage = (
    metadata.message ??
    (error instanceof Error ? error.message : '')
  ).toLowerCase();

  return invalidSessionMessagePatterns.some((pattern) => normalizedMessage.includes(pattern));
}

export function hasMissingAuthenticatedUser(
  session: Session,
  userId: string | null | undefined,
): boolean {
  return !userId || userId !== session.user.id;
}
