/**
 * Canonical key for `users.phone_number` in Supabase — one identity per WhatsApp user,
 * shared across all businesses (not per salon).
 */
export function normalizePhoneForUserDb(raw: string): string {
  if (!raw) return '';
  let s = raw.replace(/^whatsapp:/i, '').trim();
  s = s.replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) {
    s = `+${s.slice(2)}`;
  }
  return s;
}
