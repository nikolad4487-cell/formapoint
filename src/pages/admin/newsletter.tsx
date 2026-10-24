import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, Eye, Trash2 } from 'lucide-react';
import { useRows } from '../../hooks/use-data';
import { PageHeader, EmptyState, StatusBadge } from '../../components/common';
import { AdminData } from '../../components/admin-data';
import { Button } from '../../components/ui/button';
import { ConfirmationDialog } from '../../components/ui/dialog';
import { requireDb, invoke } from '../../lib/supabase';
import { action } from '../workspace';
import {
  field,
  previewHtml,
  type NewsletterTemplate,
  type Subscriber,
  type Campaign,
} from '../../lib/admin-tools';
import { localDate } from '../../lib/utils';
export function NewsletterAdmin() {
  const templates = useRows<NewsletterTemplate>('newsletter_templates'),
    subscribers = useRows<Subscriber>('newsletter_subscribers'),
    campaigns = useRows<Campaign>('newsletter_campaigns'),
    deliveries = useRows<{ id: string; campaign_id: string; status: string }>(
      'newsletter_deliveries',
    );
  const health = useQuery({
    queryKey: ['admin-tools-health'],
    retry: false,
    queryFn: () => invoke<{ email_configured: boolean }>('admin-tools', { action: 'health' }),
  });
  const cache = useQueryClient();
  const [editing, setEditing] = useState<NewsletterTemplate | null | undefined>();
  const [html, setHtml] = useState('');
  const [preview, setPreview] = useState<NewsletterTemplate | null>(null);
  const [campaignId, setCampaignId] = useState(() => crypto.randomUUID());
  const [send, setSend] = useState<NewsletterTemplate | null>(null);
  const [deleting, setDeleting] = useState<NewsletterTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  async function refresh() {
    await cache.invalidateQueries();
  }
  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Predlošci, potvrđeni pretplatnici i evidencija slanja."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setHtml('');
            }}
          >
            <Plus size={16} />
            Novi predložak
          </Button>
        }
      />
      <div className="notice">
        <Mail />
        <p>
          {health.data?.email_configured
            ? 'E-mail adapter je konfiguriran.'
            : 'Slanje je isključeno dok admin-tools i Resend nisu konfigurirani.'}{' '}
          Poruke primaju samo korisnici s privolom i potvrđenom e-mail adresom. Svaka poruka ima
          poveznicu za odjavu.
        </p>
      </div>
      <AdminData query={templates}>
        <section className="panel">
          <h2>Predlošci poruka</h2>
          {templates.data?.length ? (
            <div className="admin-template-grid">
              {templates.data.map((t) => (
                <article className="template-card" key={t.id}>
                  <span className="service-icon">
                    <Mail />
                  </span>
                  <h3>{t.name}</h3>
                  <p>{t.subject}</p>
                  {(t.valid_from || t.valid_until) && (
                    <p className="muted">
                      {t.valid_from ? localDate(t.valid_from) : 'Odmah'} —{' '}
                      {t.valid_until ? localDate(t.valid_until) : 'Bez završnog datuma'}
                    </p>
                  )}
                  <div className="actions">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(t);
                        setHtml(t.html);
                      }}
                    >
                      Uredi
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPreview(t)}>
                      <Eye size={15} />
                      Pregled
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        !health.data?.email_configured ||
                        busy ||
                        (!!t.valid_from && new Date(t.valid_from) > new Date()) ||
                        (!!t.valid_until && new Date(t.valid_until) < new Date())
                      }
                      onClick={() => {
                        setSend(t);
                        setCampaignId(crypto.randomUUID());
                      }}
                    >
                      Pošalji
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Izbriši predložak ${t.name}`}
                      onClick={() => setDeleting(t)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Dodajte prvi newsletter predložak"
              description="Unesite predmet i HTML poruke. Pregled se otvara u izoliranom okviru."
            />
          )}
        </section>
      </AdminData>
      <AdminData query={subscribers}>
        <section className="panel">
          <h2>Pretplatnici</h2>
          <p>
            Popis se ažurira iz postavki privole korisnika. Prikazano je najviše 200 zadnjih zapisa.
          </p>
          {subscribers.data?.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>E-mail</th>
                    <th>Status</th>
                    <th>Potvrđena adresa</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.data.map((s) => (
                    <tr key={s.id}>
                      <td>{s.email}</td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                      <td>{s.confirmed_at ? localDate(s.confirmed_at) : 'Nije potvrđena'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nema pretplatnika"
              description="Korisnik se može prijaviti na newsletter u svom profilu."
            />
          )}
        </section>
      </AdminData>
      <AdminData query={campaigns}>
        <section className="panel">
          <div className="panel-heading">
            <h2>Kampanje i slanje</h2>
            <Button
              variant="outline"
              size="sm"
              disabled={!health.data?.email_configured || busy}
              onClick={() =>
                void action(async () => {
                  setBusy(true);
                  try {
                    await invoke('admin-tools', { action: 'process-newsletter' });
                    await refresh();
                  } finally {
                    setBusy(false);
                  }
                }, 'Obrađen je sljedeći paket poruka.')
              }
            >
              Obradi sljedeći paket
            </Button>
          </div>
          <p>
            Svaki poziv obrađuje do 20 poruka. Za automatski nastavak postavite raspored prema
            uputama za objavu. Brojači obuhvaćaju najviše 200 zadnjih dostava.
          </p>
          {campaigns.data?.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Predmet</th>
                    <th>Status</th>
                    <th>Dostave (poslano / neuspjelo / preskočeno)</th>
                    <th>Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.data.map((c) => (
                    <tr key={c.id}>
                      <td>{c.subject}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        {deliveries.isError
                          ? 'Nedostupno'
                          : deliveries.isPending
                            ? '…'
                            : ['sent', 'failed', 'skipped']
                                .map(
                                  (s) =>
                                    deliveries.data?.filter(
                                      (d) => d.campaign_id === c.id && d.status === s,
                                    ).length || 0,
                                )
                                .join(' / ')}
                      </td>
                      <td>{localDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Još nema kampanja" />
          )}
        </section>
      </AdminData>
      <ConfirmationDialog
        open={editing !== undefined}
        onOpenChange={() => setEditing(undefined)}
        title={editing ? 'Uredi predložak' : 'Novi newsletter predložak'}
      >
        <form
          key={editing?.id || 'new'}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            const ok = await action(async () => {
              const image = field(f, 'image_url');
              if (image && new URL(image).protocol !== 'https:')
                throw new Error('Slika mora koristiti https.');
              const values = {
                name: field(f, 'name'),
                subject: field(f, 'subject'),
                html: field(f, 'html'),
                image_url: image || null,
                valid_from: field(f, 'valid_from')
                  ? new Date(field(f, 'valid_from')).toISOString()
                  : null,
                valid_until: field(f, 'valid_until')
                  ? new Date(field(f, 'valid_until')).toISOString()
                  : null,
              };
              const db = requireDb();
              const { error } = await (editing
                ? db.from('newsletter_templates').update(values).eq('id', editing.id)
                : db.from('newsletter_templates').insert(values));
              if (error) throw error;
              await refresh();
            });
            setBusy(false);
            if (ok) setEditing(undefined);
          }}
        >
          <label>
            Naziv predloška
            <input
              name="name"
              required
              minLength={2}
              maxLength={150}
              defaultValue={editing?.name || ''}
            />
          </label>
          <label>
            Predmet poruke
            <input
              name="subject"
              required
              minLength={3}
              maxLength={150}
              defaultValue={editing?.subject || ''}
            />
          </label>
          <label>
            HTML poruke
            <textarea
              className="large-textarea code-editor"
              name="html"
              required
              minLength={10}
              maxLength={100000}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
          </label>
          <label>
            Slika — HTTPS URL (neobvezno)
            <input name="image_url" type="url" defaultValue={editing?.image_url || ''} />
          </label>
          <p>
            Slika se u poruku dodaje iznad sadržaja. Za prijenos koristite vlastitu javnu pohranu i
            zalijepite HTTPS poveznicu.
          </p>
          <div className="form-row">
            <label>
              Vrijedi od
              <input
                name="valid_from"
                type="datetime-local"
                defaultValue={editing?.valid_from ? localInput(editing.valid_from) : ''}
              />
            </label>
            <label>
              Vrijedi do
              <input
                name="valid_until"
                type="datetime-local"
                defaultValue={editing?.valid_until ? localInput(editing.valid_until) : ''}
              />
            </label>
          </div>
          <h3>Pregled sadržaja</h3>
          <iframe
            className="newsletter-preview"
            title="Pregled newsletter sadržaja"
            sandbox=""
            srcDoc={previewHtml(html)}
          />
          <Button disabled={busy}>Spremi predložak</Button>
        </form>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!preview}
        onOpenChange={() => setPreview(null)}
        title={preview?.subject || 'Pregled poruke'}
      >
        <iframe
          className="newsletter-preview"
          title="Pregled newsletter poruke"
          sandbox=""
          srcDoc={previewHtml(
            `${preview?.image_url ? `<img src="${preview.image_url.replace(/"/g, '&quot;')}" alt="">` : ''}${preview?.html || ''}`,
          )}
        />
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!send}
        onOpenChange={() => setSend(null)}
        title="Poslati newsletter?"
      >
        <p>
          Predmet: <strong>{send?.subject}</strong>
        </p>
        <p>
          Kampanja se šalje svim potvrđenim pretplatnicima s privolom. Nakon početka poruka se ne
          može opozvati.
        </p>
        <Button
          disabled={busy}
          onClick={() =>
            void (async () => {
              setBusy(true);
              const ok = await action(async () => {
                await invoke('admin-tools', {
                  action: 'send-newsletter',
                  template_id: send!.id,
                  campaign_id: campaignId,
                });
                await refresh();
              }, 'Kampanja je pokrenuta. Pratite stvarne rezultate u evidenciji.');
              setBusy(false);
              if (ok) setSend(null);
            })()
          }
        >
          Potvrdi slanje
        </Button>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Izbrisati predložak?"
      >
        <p>Postojeće kampanje zadržavaju svoj sadržaj i evidenciju.</p>
        <Button
          variant="destructive"
          onClick={() =>
            void action(async () => {
              const { error } = await requireDb()
                .from('newsletter_templates')
                .delete()
                .eq('id', deleting!.id);
              if (error) throw error;
              setDeleting(null);
              await refresh();
            })
          }
        >
          Izbriši predložak
        </Button>
      </ConfirmationDialog>
    </>
  );
}
function localInput(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
