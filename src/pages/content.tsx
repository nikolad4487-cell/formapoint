import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, ArrowUpRight } from 'lucide-react';
import { usePublishedPage } from '../hooks/use-site-settings';
import { PageHeader, EmptyState, LoadingSkeleton, ErrorState } from '../components/common';
import { Button } from '../components/ui/button';
import { configured, requireDb, invoke } from '../lib/supabase';
import type { PortfolioItem, ContentPage } from '../lib/admin-tools';
import { action } from './workspace';
export function PublishedText({ page }: { page: ContentPage }) {
  return (
    <article className="container narrow section">
      <PageHeader title={page.title} />
      <div className="panel prose-text">{page.content}</div>
    </article>
  );
}
export function ContentPageView() {
  const { slug = '' } = useParams();
  const q = usePublishedPage(slug);
  if (q.isFetching)
    return (
      <div className="container section">
        <LoadingSkeleton />
      </div>
    );
  if (q.isError)
    return (
      <div className="container section">
        <ErrorState retry={() => void q.refetch()} />
      </div>
    );
  return q.data ? (
    <PublishedText page={q.data} />
  ) : (
    <div className="container section">
      <EmptyState
        title="Stranica nije objavljena"
        description="Sadržaj još nije dostupan posjetiteljima."
      />
    </div>
  );
}
export function PublicPortfolio() {
  const [busy, setBusy] = useState('');
  const q = useQuery({
    queryKey: ['portfolio_items', 'public'],
    enabled: configured,
    queryFn: async () => {
      const { data, error } = await requireDb()
        .from('portfolio_items')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        if (error.code === 'PGRST205') return [];
        throw error;
      }
      return data as PortfolioItem[];
    },
  });
  return (
    <div className="container section">
      <PageHeader
        eyebrow="PRIMJERI NAŠEG RADA"
        title="Portfolio"
        description="Odabrani primjeri oblikovanja, organizacije i digitalnih rješenja."
      />
      {q.isFetching ? (
        <LoadingSkeleton />
      ) : q.isError ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data?.length ? (
        <div className="portfolio-grid">
          {q.data.map((p) => (
            <article className="panel portfolio-card" key={p.id}>
              <span className="service-icon">
                <FileText />
              </span>
              <h2>{p.title}</h2>
              <p>{p.description}</p>
              {p.pdf_url ? (
                <a
                  className="button button-outline"
                  href={p.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pogledaj PDF <ArrowUpRight size={16} />
                </a>
              ) : (
                <Button
                  variant="outline"
                  disabled={busy === p.id}
                  onClick={() =>
                    void (async () => {
                      setBusy(p.id);
                      await action(async () => {
                        const data = await invoke<{ url: string }>('portfolio-download', {
                          id: p.id,
                        });
                        const url = new URL(data.url);
                        if (!['https:', 'http:'].includes(url.protocol))
                          throw new Error('Neispravna poveznica');
                        const a = document.createElement('a');
                        a.href = url.toString();
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.click();
                      });
                      setBusy('');
                    })()
                  }
                >
                  Otvori PDF
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            title="Primjeri radova uskoro"
            description="Novi primjeri bit će dostupni nakon odobrenja za javnu objavu."
          />
        </section>
      )}
    </div>
  );
}
export function NewsletterUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  const [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <div className="container narrow section">
      <PageHeader title="Odjava s newslettera" />
      <section className="panel">
        {done ? (
          <p role="status">
            Zahtjev je obrađen. Za valjanu poveznicu buduće marketinške poruke su isključene.
          </p>
        ) : (
          <>
            <p>
              {valid
                ? 'Potvrdite da više ne želite primati newsletter. Obavijesti o svojim narudžbama i dalje uređujete u postavkama računa.'
                : 'Poveznica za odjavu nije valjana.'}
            </p>
            <Button
              disabled={!valid || !configured || busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  const ok = await action(async () => {
                    const { error } = await requireDb().rpc('unsubscribe_newsletter', {
                      p_token: token,
                    });
                    if (error) throw error;
                  });
                  setBusy(false);
                  if (ok) setDone(true);
                })()
              }
            >
              Potvrdi odjavu
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
