import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Mail, ImagePlus } from 'lucide-react';
import { Button } from './ui/button';
import { ConfirmationDialog } from './ui/dialog';
import { preparePaymentIcon } from './payment-icon-upload';
import { requireDb, rpc } from '../lib/supabase';
import { eurosToCents } from '../lib/currency';
import { localDate } from '../lib/utils';
import type { AdminUser } from '../lib/admin-tools';
import {
  promotionThemes,
  promotionEmail,
  type PromotionOccasion,
} from '../../supabase/functions/_shared/promotion-email';
interface Campaign {
  id: string;
  name: string;
  occasion: string;
  recipients: number;
  sent: number;
  pending: number;
  failed: number;
  skipped: number;
  starts_at: string;
  expires_at: string;
}
interface Delivery {
  id: string;
  recipient_name: string;
  email: string;
  code: string;
  status: string;
  last_error: string | null;
}
async function callPromotion(body: Record<string, unknown> | FormData) {
  const { data, error } = await requireDb().functions.invoke('promotions', { body });
  if (error) {
    let message = 'Promocija nije obrađena. Provjerite dostupnost slanja e-pošte.';
    if (error.context instanceof Response) {
      try {
        const result = await error.context.json();
        if (typeof result.error === 'string') message = result.error;
      } catch {}
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export function PersonalPromotions() {
  const cache = useQueryClient();
  const campaigns = useQuery({
    queryKey: ['personal-promotions'],
    queryFn: () => rpc<Campaign[]>('personal_promotion_summary'),
    retry: false,
  });
  const health = useQuery({
    queryKey: ['promotions-health'],
    queryFn: () =>
      callPromotion({ action: 'health' }) as Promise<{
        schema_ready: boolean;
        worker_ready?: boolean;
        email_configured: boolean;
        missing_email_settings?: string[];
      }>,
    retry: false,
  });
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [occasion, setOccasion] = useState<PromotionOccasion>('christmas');
  const [subject, setSubject] = useState(promotionThemes.christmas.subject),
    [message, setMessage] = useState(promotionThemes.christmas.message);
  const [image, setImage] = useState(''),
    [imageBusy, setImageBusy] = useState(false);
  const [kind, setKind] = useState('percent'),
    [value, setValue] = useState('10'),
    [starts, setStarts] = useState(''),
    [expires, setExpires] = useState('');
  const [audience, setAudience] = useState('all'),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState('');
  const [requestId, setRequestId] = useState(''),
    [inspect, setInspect] = useState<Campaign | null>(null);
  const users = useQuery({
    queryKey: ['promotion-users', search],
    enabled: open && audience === 'selected',
    queryFn: () => rpc<AdminUser[]>('admin_users', { p_search: search, p_limit: 100 }),
  });
  const deliveries = useQuery({
    queryKey: ['promotion-deliveries', inspect?.id],
    enabled: !!inspect,
    queryFn: async () => {
      const { data, error } = await requireDb()
        .from('promotion_deliveries')
        .select('id,recipient_name,email,code,status,last_error')
        .eq('campaign_id', inspect!.id)
        .order('created_at')
        .limit(1000);
      if (error) throw error;
      return data as Delivery[];
    },
  });
  const ready = health.data?.schema_ready && health.data.email_configured;
  const defaultImage = () =>
    new URL(promotionThemes[occasion].image, window.location.origin).toString();
  function fresh() {
    setRequestId(crypto.randomUUID());
    setError('');
    setOccasion('christmas');
    setSubject(promotionThemes.christmas.subject);
    setMessage(promotionThemes.christmas.message);
    setImage('');
    setKind('percent');
    setValue('10');
    setStarts('');
    setExpires('');
    setAudience('all');
    setSelected([]);
    setSearch('');
    setOpen(true);
  }
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ['personal-promotions'] });
    await cache.invalidateQueries({ queryKey: ['promo_codes'] });
  }
  async function drain(id: string, retry = false) {
    for (let batch = 0; batch < 100; batch++) {
      const result = await callPromotion({
        action: 'process',
        campaign_id: id,
        retry: retry && batch === 0,
      });
      await refresh();
      if (!result.available || !result.claimed) break;
    }
  }
  const sample = {
    recipient_name: users.data?.find((u) => selected.includes(u.id))?.first_name || 'Ana',
    code: `${occasion === 'christmas' ? 'BOZIC' : occasion === 'birthday' ? 'RODJENDAN' : occasion === 'easter' ? 'USKRS' : 'POKLON'}-PRIMJER`,
    kind,
    value:
      kind === 'percent'
        ? Number(value) || 10
        : (() => {
            try {
              return eurosToCents(value || '10');
            } catch {
              return 1000;
            }
          })(),
    starts_at: starts ? new Date(starts).toISOString() : new Date().toISOString(),
    expires_at: expires
      ? new Date(expires).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString(),
    subject,
    message,
    image_url: image || defaultImage(),
    occasion,
  };
  let preview = '';
  try {
    preview = promotionEmail(
      sample,
      window.location.origin,
      'https://www.formapoint.online/odjava-newslettera?token=PRIMJER',
    ).html;
  } catch {
    /* Local HTTP development: use the public asset for the preview. */ try {
      preview = promotionEmail(
        {
          ...sample,
          image_url: image || `https://www.formapoint.online${promotionThemes[occasion].image}`,
        },
        window.location.origin,
        'https://www.formapoint.online/odjava-newslettera?token=PRIMJER',
      ).html;
    } catch {}
  }
  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <div className="panel-heading">
        <div>
          <h2>Personalizirane promocije</h2>
          <p>
            Božić, rođendan, Uskrs i posebne prigode. Svaki korisnik dobiva svoj kod, zadano na 30
            dana.
          </p>
        </div>
        <Button onClick={fresh} disabled={busy}>
          <Plus size={16} />
          Nova promocija
        </Button>
      </div>
      {health.isPending && <p role="status">Provjeravam postavke promocija…</p>}
      {health.isError && (
        <div className="notice">
          <Mail />
          <div>
            <p>
              Funkcija promocija trenutačno nije dostupna. Provjerite njezinu objavu naredbom{' '}
              <code>npm run deploy:promotions</code>.
            </p>
            <Button variant="outline" size="sm" onClick={() => void health.refetch()}>
              Provjeri ponovno
            </Button>
          </div>
        </div>
      )}
      {health.data?.schema_ready === false && (
        <div className="notice">
          <Mail />
          <div>
            <p>
              Potrebna je SQL nadogradnja 014.{' '}
              <a
                className="text-link"
                href="/migracije/202610260014_personal_promotions.sql"
                target="_blank"
                rel="noreferrer"
              >
                Otvori SQL nadogradnju
              </a>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void health.refetch();
                void campaigns.refetch();
              }}
            >
              Provjeri ponovno
            </Button>
          </div>
        </div>
      )}
      {health.data?.schema_ready && !health.data.email_configured && (
        <div className="notice">
          <Mail />
          <div>
            <p>Baza je spremna. Slanje e-pošte još nije konfigurirano.</p>
            <p>
              {health.data.missing_email_settings?.length
                ? 'Nedostaje: ' + health.data.missing_email_settings.join(', ') + '.'
                : 'U Supabase Secrets provjerite RESEND_API_KEY, EMAIL_FROM i APP_URL.'}
            </p>
            <div className="actions">
              <Button asChild size="sm" variant="outline">
                <a
                  href="https://supabase.com/dashboard/project/heseilggogbtmqeuwlku/functions/secrets"
                  target="_blank"
                  rel="noreferrer"
                >
                  Otvori postavke e-pošte
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={health.isFetching}
                onClick={() => void health.refetch()}
              >
                Provjeri ponovno
              </Button>
            </div>
          </div>
        </div>
      )}
      {ready && !health.data?.worker_ready && (
        <p className="muted">
          Pozadinska obrada još nije uključena. Ostavite ovu stranicu otvorenu tijekom slanja ili
          uključite worker prema uputama za promocije.
        </p>
      )}
      {campaigns.data?.map((c) => (
        <article key={c.id} className="file-row">
          <div>
            <h3>{c.name}</h3>
            <p>
              {localDate(c.starts_at)} — {localDate(c.expires_at)}
            </p>
            <p>
              {c.recipients} kodova · {c.sent} poslano · {c.pending} čeka · {c.failed} neuspjelo ·{' '}
              {c.skipped} preskočeno
            </p>
          </div>
          <div className="actions">
            <Button variant="outline" size="sm" onClick={() => setInspect(c)}>
              Kodovi i isporuke
            </Button>
            <Button
              size="sm"
              disabled={busy || !ready || (!c.pending && !c.failed)}
              onClick={async () => {
                setBusy(true);
                try {
                  await drain(c.id, true);
                  toast.success('Obrada promocije završena. Provjerite statuse isporuke.');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Obrada nije uspjela.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Obradi neslane
            </Button>
          </div>
        </article>
      ))}
      {campaigns.isSuccess && !campaigns.data?.length && (
        <p>Još nema personaliziranih promocija.</p>
      )}
      <ConfirmationDialog
        open={open}
        onOpenChange={(value) => {
          if (!busy && !imageBusy) setOpen(value);
        }}
        title="Nova personalizirana promocija"
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            const data = new FormData(event.currentTarget);
            try {
              if (audience === 'selected' && !selected.length)
                throw new Error('Odaberite barem jednog korisnika.');
              const amount = kind === 'fixed' ? eurosToCents(value, 1) : Number(value);
              if (!Number.isInteger(amount) || amount < 1 || (kind === 'percent' && amount > 100))
                throw new Error('Unesite valjanu vrijednost popusta.');
              const result = await callPromotion({
                action: 'create',
                request_id: requestId,
                name: String(data.get('name')).trim(),
                occasion,
                kind,
                value: amount,
                subject,
                message,
                image_url: image || null,
                user_ids: audience === 'selected' ? selected : null,
                starts_at: starts ? new Date(starts).toISOString() : null,
                expires_at: expires ? new Date(expires).toISOString() : null,
              });
              setOpen(false);
              await refresh();
              toast.success('Osobni kodovi su kreirani. Status slanja prikazan je uz promociju.');
              await drain(result.campaign_id);
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Promocija nije obrađena.';
              setError(message);
              toast.error(message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Naziv promocije
            <input name="name" required minLength={2} maxLength={150} />
          </label>
          <label>
            Prigoda
            <select
              aria-label="Prigoda"
              value={occasion}
              onChange={(event) => {
                const next = event.target.value as PromotionOccasion;
                setOccasion(next);
                setSubject(promotionThemes[next].subject);
                setMessage(promotionThemes[next].message);
                setImage('');
              }}
            >
              {Object.entries(promotionThemes).map(([key, theme]) => (
                <option key={key} value={key}>
                  {theme.label}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Vrsta popusta
              <select
                aria-label="Vrsta popusta"
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option value="percent">Postotak</option>
                <option value="fixed">Fiksni iznos (€)</option>
              </select>
            </label>
            <label>
              {kind === 'percent' ? 'Vrijednost (%)' : 'Iznos (€)'}
              <input
                name="amount"
                required
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Vrijedi od (prazno: odmah)
              <input
                type="datetime-local"
                value={starts}
                onChange={(event) => setStarts(event.target.value)}
              />
            </label>
            <label>
              Vrijedi do (prazno: 30 dana od kreiranja)
              <input
                type="datetime-local"
                value={expires}
                onChange={(event) => setExpires(event.target.value)}
              />
            </label>
          </div>
          <label>
            Primatelji
            <select
              aria-label="Primatelji"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            >
              <option value="all">Svi korisnici — svakome poseban kod</option>
              <option value="selected">Odabrani korisnici</option>
            </select>
          </label>
          {audience === 'selected' && (
            <>
              <label>
                Pretraži korisnike
                <input value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <div style={{ maxHeight: 190, overflowY: 'auto' }}>
                {users.data?.map((user) => (
                  <label key={user.id} className="checkbox">
                    <input
                      type="checkbox"
                      checked={selected.includes(user.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, user.id]
                            : current.filter((id) => id !== user.id),
                        )
                      }
                    />
                    {user.first_name} {user.last_name} · {user.email}
                  </label>
                ))}
              </div>
              <small>Odabrano: {selected.length}</small>
            </>
          )}
          <p>
            Poruke primaju korisnici koji imaju uključene promotivne poruke i potvrđen e-mail. Za
            ostale se kod kreira, a slanje označava kao preskočeno.
          </p>
          <label>
            Naslov e-maila
            <input
              required
              maxLength={150}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>
          <label>
            Personalizirana poruka
            <textarea
              required
              minLength={10}
              maxLength={5000}
              rows={6}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          <p>
            Oznake: {'{ime}, {kod}, {popust}, {od}, {do}'}. Svaki kod vrijedi samo za pripadajućeg
            korisnika, jednom.
          </p>
          <img
            src={image || promotionThemes[occasion].image}
            alt={`Slika promocije: ${promotionThemes[occasion].label}`}
            style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12 }}
          />
          <label>
            <span>
              <ImagePlus size={16} /> Učitaj vlastitu sliku (PNG/JPG/WebP do 2 MB)
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={imageBusy || busy || !ready}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setImageBusy(true);
                try {
                  const blob = await preparePaymentIcon(file),
                    form = new FormData();
                  form.set('action', 'upload-image');
                  form.set('file', new File([blob], 'promocija.png', { type: 'image/png' }));
                  const result = await callPromotion(form);
                  setImage(result.url);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Slika nije prenesena.');
                } finally {
                  setImageBusy(false);
                  event.target.value = '';
                }
              }}
            />
          </label>
          <details>
            <summary>Pregled personaliziranog e-maila (primjer)</summary>
            <iframe
              title="Pregled promotivnog e-maila"
              sandbox=""
              srcDoc={preview}
              style={{ width: '100%', height: 480, border: '1px solid #ddd', borderRadius: 12 }}
            />
          </details>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          {!ready && (
            <Button
              type="button"
              variant="outline"
              disabled={health.isFetching}
              onClick={() => void health.refetch()}
            >
              Provjeri postavke slanja
            </Button>
          )}
          <Button disabled={busy || imageBusy || !ready}>
            {busy ? 'Kreiranje i slanje…' : 'Izradi kodove i pošalji e-mail'}
          </Button>
        </form>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!inspect}
        onOpenChange={(open) => {
          if (!open) setInspect(null);
        }}
        title={inspect?.name || 'Isporuke promocije'}
      >
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Korisnik</th>
                <th>Osobni kod</th>
                <th>Slanje</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.data?.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.recipient_name}
                    <br />
                    {d.email}
                  </td>
                  <td>{d.code}</td>
                  <td>
                    {
                      (
                        {
                          sent: 'Poslano',
                          pending: 'Čeka',
                          processing: 'Šalje se',
                          failed: 'Neuspjelo',
                          skipped: 'Preskočeno',
                        } as Record<string, string>
                      )[d.status]
                    }
                    {d.last_error && <small style={{ display: 'block' }}>{d.last_error}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {deliveries.isPending && <p>Učitavanje isporuka…</p>}
        {deliveries.isError && <p role="alert">Isporuke nije moguće učitati.</p>}
      </ConfirmationDialog>
    </section>
  );
}
