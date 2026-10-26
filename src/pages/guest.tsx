import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { configured, rpc } from '../lib/supabase';
import { Unavailable } from '../components/common';
import { ensureGuestSession } from '../lib/guest';

export function GuestPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!configured)
    return (
      <div className="container section">
        <Unavailable />
      </div>
    );
  return (
    <div className="container section">
      <form
        className="panel"
        style={{ maxWidth: 600, margin: '0 auto' }}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError('');
          try {
            await ensureGuestSession();
            await rpc('save_guest_contact', {
              p_first: String(form.get('first')).trim(),
              p_last: String(form.get('last')).trim(),
              p_email: String(form.get('email')).trim(),
              p_terms: form.get('terms') === 'on',
            });
            const service = params.get('service');
            if (service) {
              const quantity = Number(params.get('quantity') || 1);
              await rpc('cart_add', { p_service: service, p_quantity: quantity });
            }
            await cache.invalidateQueries();
            const from = location.state?.from;
            navigate(
              service
                ? '/app/kosarica'
                : typeof from === 'string' && from.startsWith('/app/')
                  ? from
                  : '/app/nova-narudzba',
              { replace: true },
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Nastavak kupnje nije uspio.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>Kupnja kao gost</h1>
        <p>Kupite bez registracije i lozinke. Unesite kontaktne podatke za svoju narudžbu.</p>
        <div className="form-row">
          <label>
            Ime
            <input name="first" autoComplete="given-name" required maxLength={150} />
          </label>
          <label>
            Prezime
            <input name="last" autoComplete="family-name" required maxLength={150} />
          </label>
        </div>
        <label>
          E-mail
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <label className="checkbox">
          <input name="terms" type="checkbox" required />
          Prihvaćam{' '}
          <Link to="/uvjeti-koristenja" target="_blank">
            uvjete korištenja
          </Link>{' '}
          i{' '}
          <Link to="/pravila-privatnosti" target="_blank">
            pravila privatnosti
          </Link>
          .
        </label>
        <p>
          Pristup narudžbama gosta sprema se u ovom pregledniku. Za nastavak koristite isti
          preglednik i sačuvajte njegove podatke.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="actions">
          <Button disabled={busy}>{busy ? 'Spremanje…' : 'Nastavi kao gost'}</Button>
          <Button asChild variant="outline">
            <Link to="/prijava">Imam račun</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
