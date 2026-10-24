import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useRows } from '../../hooks/use-data';
import { PageHeader, EmptyState, SearchInput } from '../../components/common';
import { AdminData } from '../../components/admin-data';
import { localDate } from '../../lib/utils';
export function ContactInquiries() {
  const q = useRows<{ id: string; name: string; email: string; body: string; created_at: string }>(
    'contact_requests',
  );
  const [search, setSearch] = useState('');
  return (
    <>
      <PageHeader
        title="Kontaktni upiti"
        description="Poruke posjetitelja poslane preko kontaktnog obrasca. Zahtjevi postojećih korisnika nalaze se u podršci."
      />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Ime, e-mail ili sadržaj upita"
      />
      <AdminData query={q}>
        <div className="admin-template-grid">
          {q.data?.length ? (
            q.data
              .filter((c) =>
                `${c.name} ${c.email} ${c.body}`.toLowerCase().includes(search.toLowerCase()),
              )
              .map((c) => (
                <article className="panel" key={c.id}>
                  <h2>{c.name}</h2>
                  <p>{c.email}</p>
                  <p className="prose-text">{c.body}</p>
                  <p className="muted">{localDate(c.created_at)}</p>
                  <a
                    className="button button-outline"
                    href={`mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent('Odgovor na vaš FormaPoint upit')}`}
                  >
                    <Mail size={16} />
                    Odgovori e-poštom
                  </a>
                </article>
              ))
          ) : (
            <EmptyState title="Nema kontaktnih upita" />
          )}
        </div>
        <p className="muted">Prikazano je najviše 200 posljednjih upita.</p>
      </AdminData>
    </>
  );
}
