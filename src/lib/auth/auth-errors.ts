export function formatAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email rate limit exceeded")) {
    return "Too many auth emails sent. Wait about an hour, or turn off email confirmation in Supabase (Authentication → Providers → Email).";
  }
  if (lower.includes("error sending confirmation email")) {
    return "Could not send confirmation email. Check Supabase SMTP and your verified Resend domain.";
  }
  return message;
}
