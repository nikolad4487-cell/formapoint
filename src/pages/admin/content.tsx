import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2, CheckCircle2, Upload, FileText } from 'lucide-react';
import { useRows } from '../../hooks/use-data';
import { useAuth } from '../../hooks/use-auth';
import { PageHeader, EmptyState, SearchInput, StatusBadge } from '../../components/common';
import { Button } from '../../components/ui/button';
import { ConfirmationDialog } from '../../components/ui/dialog';
import { AdminData } from '../../components/admin-data';
import { requireDb, invoke } from '../../lib/supabase';
import { action } from '../workspace';
import {
  field,
  parsed,
  pageSchema,
  portfolioSchema,
  legalSlugs,
  type ContentPage,
  type PortfolioItem,
} from '../../lib/admin-tools';
import { localDate } from '../../lib/utils';
export function ContentPages() {
  const q = useRows<ContentPage>('content_pages');
  const cache = useQueryClient();
  const { session } = useAuth();
  const [editing, setEditing] = useState<ContentPage | null | undefined>();
  const [publishing, setPublishing] = useState<ContentPage | null>(null);
  const [deleting, setDeleting] = useState<ContentPage | null>(null);
  const [approved, setApproved] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  async function publish() {
    if (!publishing) return;
    setBusy(true);
    const legal = legalSlugs.includes(publishing.slug);
    const ok = await action(async () => {
      const { error } = await requireDb()
        .from('content_pages')
        .update({
          published: !publishing.published,
          approved_by: legal && !publishing.published ? session!.user.id : null,
          approved_at: null,
        })
        .eq('id', publishing.id);
      if (error) throw error;
      await cache.invalidateQueries({ queryKey: ['content_pages'] });
    });
    setBusy(false);
    if (ok) setPublishing(null);
  }
  return (
    <>
      <PageHeader
        title="Upravljanje stranicama"
        description="Uređujte javne tekstove i objavljujte odobrene sadržaje."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} />
            Nova stranica
          </Button>
        }
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Naslov ili slug stranice" />
      <AdminData query={q}>
        <section className="panel">
          {q.data?.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naslov</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Zadnja izmjena</th>
                    <th>Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data
                    .filter((p) =>
                      `${p.title} ${p.slug}`.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((p) => (
                      <tr key={p.id}>
                        <td>{p.title}</td>
                        <td>/p/{p.slug}</td>
                        <td>
                          <StatusBadge status={p.published ? 'published' : 'draft'} />
                        </td>
                        <td>{localDate(p.updated_at)}</td>
                        <td>
                          <div className="actions table-actions">
                            {p.published && (
                              <Link className="text-link" to={`/p/${p.slug}`}>
                                <Eye size={15} />
                                Pregled
                              </Link>
                            )}
                            <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                              <Pencil size={14} />
                              Uredi
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setApproved(false);
                                setPublishing(p);
                              }}
                            >
                              {p.published ? 'Povuci objavu' : 'Objavi'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Izbriši stranicu ${p.title}`}
                              onClick={() => setDeleting(p)}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Još nema vlastitih stranica"
              description="U aplikaciji i dalje ostaju postojeći javni tekstovi i označeni pravni predlošci."
            />
          )}
        </section>
      </AdminData>
      <ConfirmationDialog
        open={editing !== undefined}
        onOpenChange={() => setEditing(undefined)}
        title={editing ? 'Uredi stranicu' : 'Nova stranica'}
      >
        <form
          key={editing?.id || 'new'}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            const ok = await action(async () => {
              const values = parsed(pageSchema, {
                title: field(f, 'title'),
                slug: field(f, 'slug'),
                content: field(f, 'content'),
              });
              const payload = { ...values, published: false, approved_at: null, approved_by: null };
              const db = requireDb();
              const { error } = await (editing
                ? db.from('content_pages').update(payload).eq('id', editing.id)
                : db.from('content_pages').insert(payload));
              if (error) throw error;
              await cache.invalidateQueries({ queryKey: ['content_pages'] });
            }, 'Nacrt je spremljen. Objavu potvrdite zasebno.');
            setBusy(false);
            if (ok) setEditing(undefined);
          }}
        >
          <label>
            Naslov
            <input
              name="title"
              required
              minLength={2}
              maxLength={150}
              defaultValue={editing?.title || ''}
            />
          </label>
          <label>
            Slug
            <input
              name="slug"
              required
              pattern="[a-z0-9-]+"
              maxLength={100}
              defaultValue={editing?.slug || ''}
            />
          </label>
          <label>
            Sadržaj
            <textarea
              className="large-textarea"
              name="content"
              required
              minLength={10}
              maxLength={100000}
              defaultValue={editing?.content || ''}
            />
          </label>
          <p>
            Sadržaj je običan tekst; HTML se ne izvršava. Spremanje izmjena vraća stranicu u nacrt.
          </p>
          <Button disabled={busy}>Spremi nacrt</Button>
        </form>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!publishing}
        onOpenChange={() => setPublishing(null)}
        title={publishing?.published ? 'Povuci objavu' : 'Potvrdi objavu'}
      >
        <p>{publishing?.title}</p>
        {publishing && !publishing.published && legalSlugs.includes(publishing.slug) && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            Potvrđujem da je pravni tekst dopunjen stvarnim podacima, provjeren i odobren za objavu.
          </label>
        )}
        <Button
          disabled={
            busy ||
            Boolean(
              publishing &&
              !publishing.published &&
              legalSlugs.includes(publishing.slug) &&
              !approved,
            )
          }
          onClick={() => void publish()}
        >
          {publishing?.published ? 'Povuci objavu' : 'Objavi stranicu'}
        </Button>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Izbrisati stranicu?"
      >
        <p>Ova radnja uklanja spremljeni tekst stranice.</p>
        <Button
          variant="destructive"
          onClick={() =>
            void action(async () => {
              const { error } = await requireDb()
                .from('content_pages')
                .delete()
                .eq('id', deleting!.id);
              if (error) throw error;
              setDeleting(null);
              await cache.invalidateQueries({ queryKey: ['content_pages'] });
            })
          }
        >
          Izbriši
        </Button>
      </ConfirmationDialog>
    </>
  );
}
export function PortfolioAdmin() {
  const q = useRows<PortfolioItem>('portfolio_items');
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [deleting, setDeleting] = useState<PortfolioItem | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<PortfolioItem | null>(null);
  return (
    <>
      <PageHeader
        title="Radovi i portfolio"
        description="Objavite samo vlastite primjere ili radove za koje imate dopuštenje za javnu objavu."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFile(null);
              setOpen(true);
            }}
          >
            <Plus size={16} />
            Dodaj novi rad
          </Button>
        }
      />
      <AdminData query={q}>
        <div className="portfolio-grid">
          {q.data?.length ? (
            q.data.map((p) => (
              <article className="panel portfolio-card" key={p.id}>
                <span className="service-icon">
                  <FileText />
                </span>
                <h2>{p.title}</h2>
                <p>{p.description}</p>
                <div className="actions">
                  <StatusBadge status={p.published ? 'published' : 'draft'} />
                  <StatusBadge status={p.scan_status} />
                </div>
                <div className="actions">
                  {p.pdf_url && (
                    <a
                      className="text-link"
                      href={p.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Pregledaj PDF <Eye size={15} />
                    </a>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(p);
                      setFile(null);
                      setOpen(true);
                    }}
                  >
                    Uredi
                  </Button>
                  {p.file_path && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void action(async () => {
                          const data = await invoke<{ url: string }>('portfolio-download', {
                            id: p.id,
                          });
                          window.open(data.url, '_blank', 'noopener,noreferrer');
                        })
                      }
                    >
                      Preuzmi za provjeru
                    </Button>
                  )}
                  {p.file_path && p.scan_status !== 'clean' && (
                    <Button variant="outline" size="sm" onClick={() => setReview(p)}>
                      Sigurnosna provjera
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!p.publication_rights || !['clean', 'linked'].includes(p.scan_status)}
                    onClick={() =>
                      void action(async () => {
                        const { error } = await requireDb()
                          .from('portfolio_items')
                          .update({ published: !p.published })
                          .eq('id', p.id);
                        if (error) throw error;
                        await cache.invalidateQueries({ queryKey: ['portfolio_items'] });
                      })
                    }
                  >
                    {p.published ? 'Povuci objavu' : 'Objavi'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Izbriši rad ${p.title}`}
                    onClick={() => setDeleting(p)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <section className="panel">
              <EmptyState
                title="Još nema objavljenih radova"
                description="Dodajte opis i PDF poveznicu ili prenesite datoteku."
              />
            </section>
          )}
        </div>
      </AdminData>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Uredi rad' : 'Dodaj novi rad'}
      >
        <form
          key={editing?.id || 'new'}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            const ok = await action(
              async () => {
                const title = field(f, 'title'),
                  description = field(f, 'description');
                if (file) {
                  if (editing)
                    throw new Error('Za novu verziju privatnog PDF-a dodajte zaseban novi rad.');
                  const body = new FormData();
                  body.set('file', file);
                  body.set('title', title);
                  body.set('description', description);
                  body.set('action', 'portfolio-upload');
                  const { data, error } = await requireDb().functions.invoke('admin-tools', {
                    body,
                  });
                  if (error || data?.error)
                    throw new Error(
                      'Prijenos nije dostupan. Objavite admin-tools funkciju ili koristite javnu PDF poveznicu.',
                    );
                } else {
                  const values = editing?.file_path
                    ? { title, description }
                    : parsed(portfolioSchema, { title, description, pdf_url: field(f, 'pdf_url') });
                  const payload = {
                    ...values,
                    publication_rights: f.get('rights') === 'on',
                    published: false,
                  };
                  const db = requireDb();
                  const { error } = await (editing
                    ? db.from('portfolio_items').update(payload).eq('id', editing.id)
                    : db.from('portfolio_items').insert(payload));
                  if (error) throw error;
                }
                await cache.invalidateQueries({ queryKey: ['portfolio_items'] });
              },
              file ? 'PDF je prenesen u karantenu.' : 'Rad je spremljen kao nacrt.',
            );
            setBusy(false);
            if (ok) setOpen(false);
          }}
        >
          <label>
            Naziv rada
            <input
              name="title"
              required
              minLength={3}
              maxLength={150}
              defaultValue={editing?.title || ''}
            />
          </label>
          <label>
            Opis
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={10000}
              defaultValue={editing?.description || ''}
            />
          </label>
          {!editing?.file_path && (
            <label>
              Javna PDF poveznica
              <input
                name="pdf_url"
                type="url"
                required={!file}
                placeholder="https://…"
                defaultValue={editing?.pdf_url || ''}
                disabled={!!file}
              />
            </label>
          )}
          {!editing && (
            <label>
              Ili prenesite PDF (do 20 MB)
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <small>
                Prijenos zahtijeva objavljenu admin-tools funkciju. Datoteka ostaje privatna i u
                karanteni do stvarne provjere.
              </small>
            </label>
          )}
          <label className="checkbox">
            <input
              name="rights"
              type="checkbox"
              defaultChecked={editing?.publication_rights || false}
            />
            Imam dopuštenje i uklonio/la sam osobne ili povjerljive podatke iz javnog primjerka.
          </label>
          <Button disabled={busy}>
            {file ? (
              <>
                <Upload size={16} />
                Prenesi u karantenu
              </>
            ) : (
              'Spremi rad'
            )}
          </Button>
        </form>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Izbrisati rad?"
      >
        <p>
          Rad će biti uklonjen iz javnog portfolija. Privatna pohrana datoteke obrađuje se prema
          pravilima čuvanja.
        </p>
        <Button
          variant="destructive"
          onClick={() =>
            void action(async () => {
              const { error } = await requireDb()
                .from('portfolio_items')
                .delete()
                .eq('id', deleting!.id);
              if (error) throw error;
              setDeleting(null);
              await cache.invalidateQueries({ queryKey: ['portfolio_items'] });
            })
          }
        >
          Izbriši rad
        </Button>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!review}
        onOpenChange={() => setReview(null)}
        title="Evidentiraj stvarnu provjeru PDF-a"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const ok = await action(async () => {
              await requireDb()
                .rpc('review_portfolio_file', {
                  p_id: review!.id,
                  p_result: field(f, 'result'),
                  p_reason: field(f, 'reason'),
                })
                .then(({ error }) => {
                  if (error) throw error;
                });
              await cache.invalidateQueries({ queryKey: ['portfolio_items'] });
            });
            if (ok) setReview(null);
          }}
        >
          <p>
            Ovo ne pokreće antivirus. Prvo provjerite datoteku odgovarajućim sigurnosnim alatom.
          </p>
          <label>
            Rezultat
            <select name="result">
              <option value="clean">Provjereno i dopušteno</option>
              <option value="rejected">Odbijeno</option>
            </select>
          </label>
          <label>
            Alat i obrazloženje
            <textarea name="reason" minLength={10} maxLength={500} required />
          </label>
          <Button>
            <CheckCircle2 size={15} />
            Evidentiraj provjeru
          </Button>
        </form>
      </ConfirmationDialog>
    </>
  );
}
