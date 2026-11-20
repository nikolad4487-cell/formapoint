import { useState } from 'react';
import { useAuth } from '../hooks/use-auth';
import { requireDb } from '../lib/supabase';
import { changeSharedPassword } from '../lib/password';
import { Button } from './ui/button';

export function ChangePassword() {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (!session || session.user.is_anonymous) return null;
  return (
    <form
      className="panel"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget,
          data = new FormData(form);
        setError('');
        setNotice('');
        const current = String(data.get('current') || ''),
          next = String(data.get('next') || '');
        if (next !== data.get('confirm')) {
          setError('Nove lozinke se ne podudaraju.');
          return;
        }
        setBusy(true);
        try {
          await changeSharedPassword(requireDb().auth, session.user.id, current, next);
          form.reset();
          setNotice(
            'Lozinka je promijenjena. Nova lozinka vrijedi za FormaPoint i povezani WebmailHR sandučić.',
          );
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Lozinku trenutačno nije moguće promijeniti.',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Promjena lozinke</h2>
      <p>
        Ista lozinka vrijedi za FormaPoint i povezani WebmailHR sandučić. Najmanje 8 znakova;
        dopuštene su i samo znamenke.
      </p>
      <label>
        Trenutačna lozinka
        <input
          name="current"
          type="password"
          autoComplete="current-password"
          required
          maxLength={512}
          disabled={busy}
        />
      </label>
      <label>
        Nova lozinka
        <input
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={512}
          disabled={busy}
        />
      </label>
      <label>
        Potvrdite novu lozinku
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={512}
          disabled={busy}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <Button disabled={busy}>{busy ? 'Spremanje…' : 'Promijeni lozinku'}</Button>
    </form>
  );
}
