export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}
interface SupabaseEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_DISABLED?: string;
}
function isPublicKey(key: string) {
  if (key.startsWith('sb_secret_')) return false;
  try {
    const payload = key.split('.')[1];
    if (payload) {
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      if (claims.role === 'service_role') return false;
    }
  } catch {
    /* SDK provjerava valjanost javnog ključa pri zahtjevu. */
  }
  return key.length > 0;
}
export function resolveSupabaseConfig(env: SupabaseEnvironment, fallback: SupabasePublicConfig) {
  // Izričite env postavke čine par: djelomična konfiguracija ne smije povezati pogrešan projekt.
  const explicit = Boolean(
    env.VITE_SUPABASE_URL?.trim() ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.VITE_SUPABASE_ANON_KEY?.trim(),
  );
  const url = (explicit ? env.VITE_SUPABASE_URL || '' : fallback.url).trim();
  const key = (
    explicit
      ? env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || ''
      : fallback.publishableKey
  ).trim();
  let validUrl = false;
  try {
    const parsed = new URL(url);
    validUrl =
      ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    /* Nepotpuna konfiguracija prikazuje nedostupnost. */
  }
  return {
    url,
    key,
    configured: env.VITE_SUPABASE_DISABLED !== 'true' && validUrl && isPublicKey(key),
    source: explicit ? 'environment' : 'project',
  };
}
