import { eurosToCents } from '../lib/currency';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { ConfirmationDialog } from '../components/ui/dialog';
import { EmptyState, PageHeader, SearchInput, StatCard } from '../components/common';
import { useRows } from '../hooks/use-data';
import { requireDb } from '../lib/supabase';
import { localDate, money } from '../lib/utils';
import type { Service, Quote, Payment } from '../lib/domain';
import { action, QueryState, ServiceEditor, SupportPage } from './workspace';
export function AdminServices() {
  const q = useRows<Service>('services');
  const [editing, setEditing] = useState<Service | undefined>();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const cache = useQueryClient();
  const [deleting, setDeleting] = useState<Service | null>(null);
  return (
    <>
      <PageHeader
        title="Usluge i cjenik"
        description="Promjena cijene ne mijenja zaključane iznose postojećih narudžbi i ponuda."
        actions={
          <Button
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus size={17} />
            Nova usluga
          </Button>
        }
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Pretražite usluge" />
      <QueryState query={q}>
        <div className="panel">
          {q.data
            ?.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
            .map((s) => (
              <div className="file-row" key={s.id}>
                <div>
                  <h3>{s.name}</h3>
                  <p>
                    {s.price_cents === null ? 'Prema ponudi' : money(s.price_cents)} ·{' '}
                    {s.active ? 'Aktivna' : 'Neaktivna'}
                  </p>
                </div>
                <div className="actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(s);
                      setOpen(true);
                    }}
                  >
                    Uredi
                  </Button>
                  <Button variant="ghost" onClick={() => setDeleting(s)}>
                    Izbriši
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </QueryState>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Uredi uslugu' : 'Nova usluga'}
      >
        <ServiceEditor service={editing} done={() => setOpen(false)} />
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Izbrisati uslugu?"
      >
        <p>Povezane narudžbe mogu spriječiti brisanje. U tom slučaju deaktivirajte uslugu.</p>
        <Button
          variant="destructive"
          onClick={() =>
            void action(async () => {
              const { error } = await requireDb().from('services').delete().eq('id', deleting!.id);
              if (error)
                throw new Error(
                  'Usluga se koristi i ne može se izbrisati. Deaktivirajte je kroz uređivanje.',
                );
              setDeleting(null);
              await cache.invalidateQueries();
            })
          }
        >
          Izbriši
        </Button>
      </ConfirmationDialog>
    </>
  );
}
export function AdminServiceRoute() {
  const { id } = useParams();
  const q = useRows<Service>('services', id && id !== 'nova' ? { id } : {});
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title={id === 'nova' || !id ? 'Nova usluga' : 'Uredi uslugu'} />
      <QueryState query={q}>
        <div className="panel">
          <ServiceEditor
            service={id === 'nova' ? undefined : q.data?.[0]}
            done={() => navigate('/admin/usluge')}
          />
        </div>
      </QueryState>
    </>
  );
}
export function CategoriesPage() {
  const q = useRows<{ id: string; name: string; slug: string }>('service_categories');
  const cache = useQueryClient();
  return (
    <>
      <PageHeader title="Kategorije" />
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const ok = await action(async () => {
            const { error } = await requireDb()
              .from('service_categories')
              .insert({ name: f.get('name'), slug: f.get('slug') });
            if (error) throw error;
            await cache.invalidateQueries();
          });
          if (ok) form.reset();
        }}
      >
        <label>
          Naziv
          <input name="name" required maxLength={100} />
        </label>
        <label>
          Slug
          <input name="slug" pattern="[a-z0-9-]+" required />
        </label>
        <Button>Dodaj kategoriju</Button>
      </form>
      <QueryState query={q}>
        {q.data?.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </QueryState>
    </>
  );
}
function CategoryRow({ category }: { category: { id: string; name: string; slug: string } }) {
  const cache = useQueryClient();
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await action(async () => {
          const { error } = await requireDb()
            .from('service_categories')
            .update({ name: f.get('name'), slug: f.get('slug') })
            .eq('id', category.id);
          if (error) throw error;
          await cache.invalidateQueries();
        });
      }}
    >
      <div className="form-row">
        <label>
          Naziv
          <input name="name" required defaultValue={category.name} />
        </label>
        <label>
          Slug
          <input name="slug" required pattern="[a-z0-9-]+" defaultValue={category.slug} />
        </label>
      </div>
      <Button variant="outline">Spremi kategoriju</Button>
    </form>
  );
}
export function QuotesPage() {
  const q = useRows<Quote>('quotes');
  return (
    <>
      <PageHeader
        title="Ponude"
        description="Ponude se izrađuju u detaljima narudžbe. Prihvaćena verzija i cijena ostaju zaključane."
      />
      <QueryState query={q}>
        {q.data?.length ? (
          q.data.map((x) => (
            <Link to={`/admin/narudzbe/${x.order_id}`} key={x.id} className="order-card">
              <div>
                <h3>Ponuda · verzija {x.version}</h3>
                <p>
                  {money(x.total_cents)} · vrijedi do {localDate(x.expires_at)}
                </p>
              </div>
              <ArrowRight size={17} />
            </Link>
          ))
        ) : (
          <EmptyState title="Još nema ponuda" />
        )}
      </QueryState>
    </>
  );
}
export function UsersPage() {
  const { id } = useParams();
  const q = useRows<{
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    created_at: string;
  }>('profiles', id ? { id } : {});
  const [search, setSearch] = useState('');
  return (
    <>
      <PageHeader
        title={id ? 'Profil korisnika' : 'Korisnici'}
        description="Prikaz minimalnih podataka. Lozinke i tajne nisu dostupne."
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Ime ili prezime" />
      <QueryState query={q}>
        {q.data?.length ? (
          q.data
            .filter((u) =>
              `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()),
            )
            .map((u) => (
              <div key={u.id} className="panel">
                <h3>
                  <Link to={`/admin/korisnici/${u.id}`}>
                    {u.first_name} {u.last_name}
                  </Link>
                </h3>
                <p>{u.phone || 'Telefon nije naveden'}</p>
                <small>Registracija {localDate(u.created_at)}</small>
              </div>
            ))
        ) : (
          <EmptyState title="Nema korisnika" />
        )}
      </QueryState>
    </>
  );
}
export function CouponsPage() {
  const q = useRows<{
    id: string;
    code: string;
    kind: string;
    value: number;
    active: boolean;
    expires_at: string;
    max_uses: number;
  }>('promo_codes');
  const cache = useQueryClient();
  return (
    <>
      <PageHeader
        title="Kuponi"
        description="Kod se provjerava i iskorištava transakcijski na poslužitelju. Jedno korištenje po korisniku."
      />
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const ok = await action(async () => {
            const { error } = await requireDb()
              .from('promo_codes')
              .insert({
                code: String(f.get('code')).trim().toUpperCase(),
                kind: f.get('kind'),
                value:
                  f.get('kind') === 'fixed'
                    ? eurosToCents(String(f.get('value')), 1)
                    : Number(f.get('value')),
                max_uses: Number(f.get('max')),
                expires_at: new Date(String(f.get('expires'))).toISOString(),
              });
            if (error) throw error;
            await cache.invalidateQueries();
          });
          if (ok) form.reset();
        }}
      >
        <div className="form-row">
          <label>
            Kod
            <input name="code" required pattern="[A-Za-z0-9_-]+" maxLength={40} />
          </label>
          <label>
            Vrsta
            <select name="kind">
              <option value="percent">Postotni</option>
              <option value="fixed">Fiksni iznos (€)</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Vrijednost
            <input
              name="value"
              required
              type="text"
              inputMode="decimal"
              pattern="[0-9]+([.,][0-9]{1,2})?"
            />
          </label>
          <label>
            Najviše korištenja
            <input name="max" required type="number" min={1} />
          </label>
        </div>
        <label>
          Vrijedi do
          <input name="expires" type="datetime-local" required />
        </label>
        <Button>Izradi kupon</Button>
      </form>
      <QueryState query={q}>
        {q.data?.map((c) => (
          <div className="panel" key={c.id}>
            <h3>{c.code}</h3>
            <p>
              {c.kind === 'percent' ? `${c.value} %` : money(c.value)} · najviše {c.max_uses}{' '}
              korištenja · {localDate(c.expires_at)}
            </p>
            <Button
              variant="outline"
              onClick={() =>
                void action(async () => {
                  const { error } = await requireDb()
                    .from('promo_codes')
                    .update({ active: !c.active })
                    .eq('id', c.id);
                  if (error) throw error;
                  await cache.invalidateQueries();
                })
              }
            >
              {c.active ? 'Deaktiviraj' : 'Aktiviraj'}
            </Button>
          </div>
        ))}
      </QueryState>
    </>
  );
}
export function AuditPage() {
  const q = useRows<{
    id: string;
    action: string;
    entity_id: string;
    actor_id: string;
    created_at: string;
  }>('audit_logs');
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Evidencija kritičnih promjena. Zapisi se ne mogu mijenjati kroz aplikaciju."
      />
      <QueryState query={q}>
        <div className="panel data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Radnja</th>
                <th>Entitet</th>
                <th>Izvršitelj</th>
                <th>Vrijeme</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((x) => (
                <tr key={x.id}>
                  <td>{x.action}</td>
                  <td>{x.entity_id?.slice(0, 12)}</td>
                  <td>{x.actor_id?.slice(0, 12) || 'Serverska operacija'}</td>
                  <td>{localDate(x.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </>
  );
}
export function ReportsPage() {
  const q = useRows<Payment>('payments');
  const rows =
    q.data?.filter((p) => ['succeeded', 'refunded', 'partially_refunded'].includes(p.status)) || [];
  const gross = rows.reduce((n, p) => n + p.amount_cents, 0),
    refunds = rows.reduce((n, p) => n + p.refunded_cents, 0),
    fees = rows.reduce((n, p) => n + (p.fee_cents || 0), 0);
  const complete = rows.every((p) => p.fee_cents !== null);
  const months = new Map<string, number>();
  for (const p of rows) {
    const date = new Intl.DateTimeFormat('hr-HR', {
      year: 'numeric',
      month: '2-digit',
      timeZone: 'Europe/Zagreb',
    }).format(new Date(p.created_at));
    months.set(date, (months.get(date) || 0) + p.amount_cents - p.refunded_cents);
  }
  return (
    <>
      <PageHeader
        title="Izvještaji"
        description="Operativni pregled do 200 najnovijih transakcija. Ovo nije računovodstveni ni porezni izvještaj."
      />
      <QueryState query={q}>
        <div className="stat-grid">
          <StatCard label="Bruto naplate" value={money(gross)} />
          <StatCard label="Povrati" value={money(refunds)} />
          <StatCard label="Evidentirane naknade" value={money(fees)} />
          <StatCard
            label="Neto nakon povrata i naknada"
            value={complete ? money(gross - refunds - fees) : 'Nepotpuni podaci'}
          />
        </div>
        <div className="panel">
          <h2>Mjesečne naplate nakon povrata</h2>
          {months.size ? (
            [...months].map(([month, value]) => (
              <div key={month} style={{ marginBottom: 20 }}>
                <p>
                  {month} · {money(value)}
                </p>
                <div style={{ height: 12, borderRadius: 6, background: '#eef1ff' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(1, (value / Math.max(...months.values())) * 100)}%`,
                      background: '#3155F6',
                      borderRadius: 6,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="Još nema naplata" />
          )}
        </div>
      </QueryState>
    </>
  );
}
export function AdminSettings() {
  const q = useRows<{ id: boolean; stripe_enabled: boolean; maintenance: boolean }>(
    'site_settings',
  );
  const b = useRows<{
    id: boolean;
    legal_name: string;
    address: string;
    contact_email: string;
    tax_status: string;
  }>('business_settings');
  const cache = useQueryClient();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { error } = await requireDb().from('services').select('id').limit(1);
      if (error) throw error;
      return true;
    },
  });
  return (
    <>
      <PageHeader
        title="Postavke platforme"
        description="Tajne ključeve postavite isključivo u Supabase Edge Function Secrets."
      />
      <div className="panel">
        <h2>Integracije</h2>
        <p>
          Supabase baza:{' '}
          {health.isPending ? 'Provjera…' : health.isError ? 'Nedostupna' : 'Veza potvrđena'}
        </p>
        <p>
          Stripe:{' '}
          {q.data?.[0]?.stripe_enabled
            ? 'Uključen u postavkama; API i webhook treba zasebno provjeriti'
            : 'Nije aktiviran'}
        </p>
        <p>PayPal, CorvusPay, OAuth e-pošte i fiskalizacija: nisu implementirani.</p>
        <p>E-mail obavijesti: zahtijevaju Resend konfiguraciju i zakazani poziv funkcije notify.</p>
      </div>
      <QueryState query={q}>
        {q.data?.[0] && (
          <form
            className="panel"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await action(async () => {
                const { error } = await requireDb()
                  .from('site_settings')
                  .update({
                    stripe_enabled: f.get('stripe') === 'on',
                    maintenance: f.get('maintenance') === 'on',
                  })
                  .eq('id', true);
                if (error) throw error;
                await cache.invalidateQueries();
              });
            }}
          >
            <h2>Plaćanje i održavanje</h2>
            <label className="checkbox">
              <input name="stripe" type="checkbox" defaultChecked={q.data[0].stripe_enabled} />
              Aktiviraj Stripe nakon provjere konfiguracije
            </label>
            <label className="checkbox">
              <input name="maintenance" type="checkbox" defaultChecked={q.data[0].maintenance} />
              Način pripreme (naplata je onemogućena)
            </label>
            <p>
              Uključivanje ove opcije ne konfigurira Stripe račun i ne zamjenjuje testnu naplatu i
              provjeru webhookova.
            </p>
            <Button>Spremi postavke</Button>
          </form>
        )}
      </QueryState>
      <QueryState query={b}>
        {b.data?.[0] && (
          <form
            className="panel"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await action(async () => {
                const { error } = await requireDb()
                  .from('business_settings')
                  .update({
                    legal_name: f.get('name'),
                    address: f.get('address'),
                    contact_email: f.get('email'),
                    tax_status: f.get('tax'),
                  })
                  .eq('id', true);
                if (error) throw error;
                await cache.invalidateQueries();
              });
            }}
          >
            <h2>Poslovni podaci</h2>
            <label>
              Naziv pružatelja
              <input name="name" defaultValue={b.data[0].legal_name || ''} />
            </label>
            <label>
              Adresa
              <input name="address" defaultValue={b.data[0].address || ''} />
            </label>
            <label>
              Kontakt e-mail
              <input name="email" type="email" defaultValue={b.data[0].contact_email || ''} />
            </label>
            <label>
              Porezni status
              <input name="tax" defaultValue={b.data[0].tax_status || ''} />
            </label>
            <p>Podaci su interni dok vlasnik ne odobri javnu objavu i pravne tekstove.</p>
            <Button>Spremi podatke</Button>
          </form>
        )}
      </QueryState>
    </>
  );
}
export function AdminSupport() {
  const q = useRows<{ id: string; name: string; email: string; body: string; created_at: string }>(
    'contact_requests',
  );
  return (
    <>
      <SupportPage admin />
      <div className="panel">
        <h2>Javni kontaktni upiti</h2>
        <QueryState query={q}>
          {q.data?.length ? (
            q.data.map((c) => (
              <div className="panel" key={c.id}>
                <h3>{c.name}</h3>
                <p>{c.email}</p>
                <p>{c.body}</p>
                <small>{localDate(c.created_at)}</small>
              </div>
            ))
          ) : (
            <EmptyState title="Nema kontaktnih upita" />
          )}
        </QueryState>
      </div>
    </>
  );
}
