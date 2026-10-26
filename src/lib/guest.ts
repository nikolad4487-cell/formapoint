import { requireDb } from './supabase';

let pending: Promise<void> | undefined;
// Share one request if several purchase controls are clicked together.
export function ensureGuestSession() {
  return (pending ??= (async () => {
    const auth = requireDb().auth;
    const { data, error } = await auth.getSession();
    if (error) throw error;
    if (data.session) return;
    const result = await auth.signInAnonymously();
    if (result.error)
      throw new Error(
        'Kupnja kao gost trenutačno nije dostupna. Pokušajte ponovno ili se prijavite.',
      );
  })().finally(() => {
    pending = undefined;
  }));
}
