import type { AuthError } from "@supabase/supabase-js";

const STALE_AUTH_ERROR_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
  "session_expired",
]);

export function isStaleAuthError(
  error: AuthError | null | undefined
): boolean {
  return !!error?.code && STALE_AUTH_ERROR_CODES.has(error.code);
}
