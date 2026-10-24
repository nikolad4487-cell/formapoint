import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { PageHeader, EmptyState, SearchInput } from '../../components/common';
import { AdminData } from '../../components/admin-data';
import { Button } from '../../components/ui/button';
import { ConfirmationDialog } from '../../components/ui/dialog';
import { requireDb, invoke } from '../../lib/supabase';
import type { AdminUser } from '../../lib/admin-tools';
import { action } from '../workspace';
import { localDate } from '../../lib/utils';
export function AdminUsers() {
  const [search, setSearch] = useState(''),
    [offset, setOffset] = useState(0),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ['admin-users', search, offset],
    queryFn: async () => {
      const { data, error } = await requireDb().rpc('admin_users', {
        p_search: search,
        p_offset: offset,
        p_limit: 25,
      });
      if (error) throw error;
      return data as AdminUser[];
    },
  });
  const health = useQuery({
    queryKey: ['admin-tools-health'],
    retry: false,
    queryFn: () => invoke<{ invites_available: boolean }>('admin-tools', { action: 'health' }),
  });
  return (
    <>
      <PageHeader
        title="Korisnici"
        description="Kontaktni podaci, uloge i broj narudžbi. Pozivnice dodaju korisnički račun s ulogom kupca."
        actions={
          <Button disabled={!health.data?.invites_available} onClick={() => setOpen(true)}>
            <UserPlus size={16} />
            Pozovi korisnika
          </Button>
        }
      />
      {!health.data?.invites_available && (
        <p className="muted">
          Pozivnice su dostupne nakon objave admin-tools funkcije i konfiguracije Auth e-pošte.
        </p>
      )}
      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setOffset(0);
        }}
        placeholder="Ime ili e-mail"
      />
      <AdminData query={q}>
        <section className="panel">
          {q.data?.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ime i prezime</th>
                    <th>E-mail</th>
                    <th>Uloga</th>
                    <th>Narudžbe</th>
                    <th>Registracija</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.first_name} {u.last_name}
                      </td>
                      <td>{u.email}</td>
                      <td>{u.roles.includes('ADMIN') ? 'Administrator' : 'Korisnik'}</td>
                      <td>{u.order_count}</td>
                      <td>{localDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Nema korisnika za odabranu pretragu" />
          )}
          <div className="actions pagination">
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset((v) => Math.max(0, v - 25))}
            >
              Prethodna
            </Button>
            <span>Stranica {offset / 25 + 1}</span>
            <Button
              variant="outline"
              disabled={(q.data?.length || 0) < 25}
              onClick={() => setOffset((v) => v + 25)}
            >
              Sljedeća
            </Button>
          </div>
        </section>
      </AdminData>
      <ConfirmationDialog open={open} onOpenChange={setOpen} title="Pozovi korisnika">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const email = String(new FormData(e.currentTarget).get('email')).trim();
            setBusy(true);
            const ok = await action(async () => {
              await invoke('admin-tools', { action: 'invite', email });
              await cache.invalidateQueries({ queryKey: ['admin-users'] });
            }, 'Pozivnica je predana Auth usluzi za slanje.');
            setBusy(false);
            if (ok) setOpen(false);
          }}
        >
          <label>
            E-mail korisnika
            <input type="email" name="email" required maxLength={254} />
          </label>
          <p>
            Korisnik dobiva poveznicu za pristup i postavljanje lozinke. Ovaj obrazac ne dodjeljuje
            administratorsku ulogu.
          </p>
          <Button disabled={busy}>Pošalji pozivnicu</Button>
        </form>
      </ConfirmationDialog>
    </>
  );
}
