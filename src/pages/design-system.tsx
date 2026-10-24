import { useState } from 'react';
import { ArrowRight, Plus, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  PageHeader,
  ServiceCard,
  StatCard,
  StatusBadge,
  LoadingSkeleton,
  ErrorState,
} from '../components/common';
import { PageNote } from '../components/brand';
import { useServices } from '../hooks/use-data';
export function DesignSystemPage() {
  const q = useServices();
  const [count, setCount] = useState(0);
  const [email, setEmail] = useState('');
  const [checked, setChecked] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <>
      <PageHeader
        title="Dizajn-sustav"
        description="Zajedničke komponente i pravila prikaza za sve FormaPoint stranice."
        actions={<PageNote>Jedinstveni dizajn za sve stranice!</PageNote>}
      />
      <div className="design-system-grid">
        <section className="panel">
          <h2>Gumbi i interakcije</h2>
          <p>
            Ovi primjeri mijenjaju samo lokalni prikaz. Ne šalju podatke i ne stvaraju narudžbe.
          </p>
          <div className="design-buttons">
            <Button onClick={() => setCount(count + 1)}>
              Primarni gumb <ArrowRight size={16} />
            </Button>
            <Button variant="outline" onClick={() => setCount(0)}>
              Poništi primjer <RotateCcw size={16} />
            </Button>
            <Button variant="ghost" onClick={() => setChecked(!checked)}>
              Prikaži / sakrij napomenu
            </Button>
            <Button variant="secondary" onClick={() => setCount(count + 1)}>
              <Plus size={16} />
              Dodaj
            </Button>
            <Button disabled>Onemogućeni primjer</Button>
          </div>
          <p role="status">Broj lokalnih klikova: {count}</p>
          {checked && (
            <div className="notice">
              <CheckCircle2 />
              <p>Sve stranice koriste iste boje, rubove i tipografiju.</p>
            </div>
          )}
        </section>
        <section className="panel">
          <h2>Polja za unos</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setChecked(true);
            }}
          >
            <label htmlFor="design-email">
              E-mail za provjeru formata
              <input
                id="design-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={email.length > 0 && !valid}
                aria-describedby="design-email-hint"
                placeholder="Unesite e-mail adresu"
              />
            </label>
            <small id="design-email-hint" className={email && !valid ? 'field-error' : ''}>
              {email
                ? valid
                  ? 'Format adrese je ispravan.'
                  : 'Unesite ispravnu e-mail adresu.'
                : 'Primjer lokalne validacije, bez slanja poruke.'}
            </small>
            <label>
              Odabir iz liste
              <select>
                <option>Dokumenti</option>
                <option>Prezentacije</option>
                <option>Administracija</option>
              </select>
            </label>
            <Button variant="outline" disabled={!valid}>
              Provjeri primjer
            </Button>
          </form>
        </section>
      </div>
      <section className="panel">
        <h2>Kartice usluga</h2>
        {q.isPending ? (
          <LoadingSkeleton />
        ) : q.isError ? (
          <ErrorState retry={() => void q.refetch()} />
        ) : (
          <div className="service-grid design-services">
            {q.data?.slice(0, 5).map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        )}
      </section>
      <div className="design-system-grid">
        <section className="panel">
          <h2>Statističke kartice</h2>
          <p>Brojevi se izvode iz učitanog aktivnog kataloga.</p>
          <div className="stat-grid">
            <StatCard
              label="Aktivne usluge"
              value={q.isError ? '—' : q.isPending ? '…' : q.data?.length || 0}
            />
            <StatCard
              label="S definiranim cjenikom"
              value={
                q.isError
                  ? '—'
                  : q.isPending
                    ? '…'
                    : q.data?.filter((s) => s.price_cents !== null).length || 0
              }
              tone="green"
            />
          </div>
        </section>
        <section className="panel">
          <h2>Legenda statusa</h2>
          <div className="status-legend">
            {[
              'received',
              'in_progress',
              'deposit_pending',
              'final_pending',
              'completed',
              'cancelled',
              'quarantined',
            ].map((status) => (
              <StatusBadge status={status} key={status} />
            ))}
          </div>
          <h3>Pravila prikaza</h3>
          <p>
            Napredak označava potvrđenu fazu izrade. Boja ili povratak s naplate nikad ne potvrđuju
            stvarnu uplatu.
          </p>
        </section>
      </div>
    </>
  );
}
