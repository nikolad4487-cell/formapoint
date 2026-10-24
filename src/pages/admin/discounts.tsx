import { EuroInput } from '../../components/euro-input';
import { eurosToCents } from '../../lib/currency';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useRows } from '../../hooks/use-data';
import { PageHeader, EmptyState, StatusBadge } from '../../components/common';
import { AdminData } from '../../components/admin-data';
import { Button } from '../../components/ui/button';
import { ConfirmationDialog } from '../../components/ui/dialog';
import { requireDb } from '../../lib/supabase';
import { field, type AdminUser } from '../../lib/admin-tools';
import { action } from '../workspace';
import { localDate, money } from '../../lib/utils';
interface Discount {
  id: string;
  name: string | null;
  code: string;
  kind: string;
  value: number;
  max_uses: number;
  expires_at: string;
  active: boolean;
  banner: boolean;
  customer_id: string | null;
  service_id: string | null;
  first_order_only?: boolean;
}
export function DiscountsAdmin() {
  const q = useRows<Discount>('promo_codes'),
    services = useRows<{ id: string; name: string }>('services');
  const cache = useQueryClient();
  const [open, setOpen] = useState(false),
    [deleting, setDeleting] = useState<Discount | null>(null),
    [search, setSearch] = useState(''),
    [customer, setCustomer] = useState(''),
    [audience, setAudience] = useState('all'),
    [busy, setBusy] = useState(false);
  const [discountKind, setDiscountKind] = useState('percent');
  const [updating, setUpdating] = useState('');
  async function changeFirstOrder(id: string, enabled: boolean) {
    setUpdating(id);
    void cache.cancelQueries({ queryKey: ['promo_codes'] });
    cache.setQueriesData<Discount[]>({ queryKey: ['promo_codes'] }, (rows) =>
      rows?.map((row) => (row.id === id ? { ...row, first_order_only: enabled } : row)),
    );
    await action(async () => {
      const { error } = await requireDb()
        .from('promo_codes')
        .update({ first_order_only: enabled })
        .eq('id', id);
      if (error) throw error;
    });
    await cache.invalidateQueries();
    setUpdating('');
  }
  const specific = audience === 'specific';
  const users = useQuery({
    queryKey: ['discount-users', search],
    enabled: specific,
    queryFn: async () => {
      const { data, error } = await requireDb().rpc('admin_users', {
        p_search: search,
        p_limit: 25,
      });
      if (error) throw error;
      return data as AdminUser[];
    },
  });
  return (
    <>
      <PageHeader
        title="Popusti i kuponi"
        description="Kodovi za sve kupce ili jednog korisnika, s rokom i ograničenjem korištenja."
        actions={
          <Button
            onClick={() => {
              setOpen(true);
              setAudience('all');
              setDiscountKind('percent');
              setCustomer('');
            }}
          >
            <Plus size={16} />
            Novi popust
          </Button>
        }
      />
      <AdminData query={q}>
        <div className="admin-template-grid">
          {q.data?.length ? (
            q.data.map((c) => (
              <section className="panel" key={c.id}>
                <div className="panel-heading">
                  <h2>{c.name || c.code}</h2>
                  <StatusBadge status={c.active ? 'active' : 'inactive'} />
                </div>
                <strong className="coupon-code">{c.code}</strong>
                <p>
                  {c.kind === 'percent' ? `${c.value} %` : money(c.value)} · do{' '}
                  {localDate(c.expires_at)} · najviše {c.max_uses} korištenja
                </p>
                <p>
                  {c.first_order_only
                    ? 'Samo novi korisnici — prva narudžba'
                    : c.customer_id
                      ? 'Namijenjeno jednom korisniku'
                      : 'Za sve korisnike'}
                  {c.service_id
                    ? ` · ${services.data?.find((s) => s.id === c.service_id)?.name || 'Odabrana usluga'}`
                    : ''}
                </p>
                {c.banner && <p className="badge">Glavni banner</p>}
                {c.first_order_only !== undefined && (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      aria-label={`Samo novi korisnici za kupon ${c.code}`}
                      checked={c.first_order_only}
                      disabled={Boolean(updating)}
                      onChange={(e) => void changeFirstOrder(c.id, e.target.checked)}
                    />
                    Samo korisnici bez prethodnih narudžbi
                  </label>
                )}
                <div className="actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void action(async () => {
                        const { error } = await requireDb()
                          .from('promo_codes')
                          .update({ active: !c.active, ...(!c.active ? { banner: false } : {}) })
                          .eq('id', c.id);
                        if (error) throw error;
                        await cache.invalidateQueries();
                      })
                    }
                  >
                    {c.active ? 'Deaktiviraj' : 'Aktiviraj'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!c.active}
                    onClick={() =>
                      void action(async () => {
                        const { error } = await requireDb().rpc('set_discount_banner', {
                          p_id: c.id,
                          p_enabled: !c.banner,
                        });
                        if (error) throw error;
                        await cache.invalidateQueries();
                      })
                    }
                  >
                    {c.banner ? 'Ukloni banner' : 'Postavi kao banner'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Izbriši kupon ${c.code}`}
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </section>
            ))
          ) : (
            <EmptyState title="Još nema popusta" />
          )}
        </div>
      </AdminData>
      <ConfirmationDialog open={open} onOpenChange={setOpen} title="Novi popust">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            const ok = await action(async () => {
              if (specific && !customer) throw new Error('Odaberite korisnika.');
              const kind = field(f, 'kind'),
                value =
                  kind === 'fixed' ? eurosToCents(field(f, 'value'), 1) : Number(field(f, 'value'));
              if (kind === 'percent' && value > 100)
                throw new Error('Popust ne može biti veći od 100 %.');
              const { error } = await requireDb()
                .from('promo_codes')
                .insert({
                  name: field(f, 'name'),
                  code: field(f, 'code').toUpperCase(),
                  kind,
                  value,
                  max_uses: Number(field(f, 'max')),
                  expires_at: new Date(field(f, 'expires')).toISOString(),
                  customer_id: specific ? customer : null,
                  ...(audience === 'new' ? { first_order_only: true } : {}),
                  service_id: field(f, 'service') || null,
                });
              if (error) throw error;
              await cache.invalidateQueries();
            });
            setBusy(false);
            if (ok) setOpen(false);
          }}
        >
          <label>
            Naziv predloška
            <input name="name" required maxLength={150} />
          </label>
          <label>
            Kod
            <input name="code" required pattern="[A-Za-z0-9_-]+" maxLength={40} />
          </label>
          <div className="form-row">
            <label>
              Vrsta
              <select
                name="kind"
                value={discountKind}
                onChange={(e) => setDiscountKind(e.target.value)}
              >
                <option value="percent">Postotak</option>
                <option value="fixed">Fiksni iznos (€)</option>
              </select>
            </label>
            <label>
              {discountKind === 'fixed' ? 'Iznos popusta (€)' : 'Vrijednost (%)'}
              {discountKind === 'fixed' ? (
                <EuroInput key="fixed" name="value" required />
              ) : (
                <input
                  key="percent"
                  name="value"
                  required
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                />
              )}
            </label>
          </div>
          <div className="form-row">
            <label>
              Najviše korištenja
              <input name="max" required type="number" min={1} />
            </label>
            <label>
              Vrijedi do
              <input name="expires" required type="datetime-local" />
            </label>
          </div>
          <label>
            Usluga
            <select name="service">
              <option value="">Sve usluge</option>
              {services.data?.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kome vrijedi popust?
            <select value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">Svi korisnici</option>
              <option value="new">Samo novi korisnici bez ijedne narudžbe</option>
              <option value="specific">Određeni korisnik</option>
            </select>
          </label>
          {audience === 'new' && (
            <p>
              Vrijedi samo za prvu narudžbu računa. Ranije narudžbe, uključujući otkazane i zahtjeve
              za ponudu, isključuju ovaj popust.
            </p>
          )}
          {specific && (
            <>
              <label>
                Pretraži ime ili e-mail
                <input value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <label>
                Korisnik
                <select required value={customer} onChange={(e) => setCustomer(e.target.value)}>
                  <option value="">Odaberite korisnika</option>
                  {users.data?.map((u) => (
                    <option value={u.id} key={u.id}>
                      {u.first_name} {u.last_name} — {u.email}
                    </option>
                  ))}
                </select>
              </label>
              {users.isError && (
                <p role="alert">Korisnike nije moguće učitati. Provjerite SQL nadogradnju.</p>
              )}
            </>
          )}
          <p>
            Jedan korisnik može iskoristiti kod jednom. Banner se uključuje zasebno nakon spremanja.
          </p>
          <Button disabled={busy}>Izradi popust</Button>
        </form>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Izbrisati kupon?"
      >
        <p>
          Kuponi koji su već korišteni čuvaju se uz narudžbe. Njih deaktivirajte umjesto brisanja.
        </p>
        <Button
          variant="destructive"
          onClick={() =>
            void action(async () => {
              const { error } = await requireDb()
                .from('promo_codes')
                .delete()
                .eq('id', deleting!.id);
              if (error) throw error;
              setDeleting(null);
              await cache.invalidateQueries();
            })
          }
        >
          Izbriši kupon
        </Button>
      </ConfirmationDialog>
    </>
  );
}
