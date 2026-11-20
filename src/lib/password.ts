import type { SupabaseClient } from '@supabase/supabase-js';

type PasswordAuth = Pick<SupabaseClient['auth'], 'getUser' | 'signInWithPassword' | 'updateUser'>;
export async function changeSharedPassword(
  auth: PasswordAuth,
  expectedUserId: string,
  currentPassword: string,
  newPassword: string,
) {
  if (!currentPassword || newPassword.length < 8 || newPassword.length > 512)
    throw new Error('Nova lozinka mora imati najmanje 8 znakova.');
  if (currentPassword === newPassword) throw new Error('Odaberite drukčiju novu lozinku.');
  const checked = await auth.getUser();
  const user = checked.data.user;
  if (checked.error || !user || user.id !== expectedUserId || user.is_anonymous || !user.email)
    throw new Error('Prijavite se ponovno prije promjene lozinke.');
  const signed = await auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (signed.error || signed.data.user?.id !== expectedUserId)
    throw new Error('Trenutačna lozinka nije ispravna.');
  const updated = await auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  });
  if (updated.error || updated.data.user?.id !== expectedUserId)
    throw new Error(
      'Nova lozinka nije prihvaćena. Provjerite da ima najmanje 8 znakova i pokušajte ponovno.',
    );
}
