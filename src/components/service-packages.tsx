import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { requireDb, rpc } from '../lib/supabase';
import { eurosToCents, centsToEuroInput } from '../lib/currency';
import type { Service, ServicePackage } from '../lib/domain';
import { money } from '../lib/utils';
import { Button } from './ui/button';
import { AddToCartButton } from './add-to-cart';

export const packagePeriods: Record<string, string> = {
  one_time: 'Jednokratno',
  week: 'Tjedni paket',
  month: 'Mjesečni paket',
};
export function ServicePackageChoices({ service }: { service: Service }) {
  const packages = service.packages?.filter((p) => p.active && !p.archived) || [];
  if (!packages.length) return <p>Paketi trenutačno nisu dostupni.</p>;
  return (
    <div className="service-package-choices">
      <p>Odaberite paket. Svaki paket kupuje se jednom, bez automatske obnove.</p>
      {packages.map((p) => (
        <article id={`paket-${p.id}`} className="service-package" key={p.id}>
          <h3>{p.name}</h3>
          <span className="badge">{packagePeriods[p.period] || 'Jednokratno'}</span>
          {p.description && <p>{p.description}</p>}
          <strong>{money(p.price_cents)}</strong>
          <AddToCartButton service={service} variant={p} />
        </article>
      ))}
    </div>
  );
}

type DraftPackage = {
  id: string;
  name: string;
  description: string;
  price: string;
  period: string;
  active: boolean;
};
export function ServicePackagesEditor({ service, done }: { service: Service; done: () => void }) {
  const ready = service.packages_enabled !== undefined;
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ['service-packages', service.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await requireDb()
        .from('service_variants')
        .select('*')
        .eq('service_id', service.id)
        .eq('archived', false)
        .order('sort_order');
      if (error) throw error;
      return data as ServicePackage[];
    },
  });
  const [rows, setRows] = useState<DraftPackage[]>([]);
  const [enabled, setEnabled] = useState(service.packages_enabled || false);
  const [initialized, setInitialized] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (q.data && !initialized) {
      setRows(
        q.data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: centsToEuroInput(p.price_cents),
          period: p.period,
          active: p.active,
        })),
      );
      setInitialized(true);
    }
  }, [q.data, initialized]);
  if (!ready)
    return (
      <p>
        Za više paketa primijenite{' '}
        <a
          className="text-link"
          href="/migracije/202611120019_service_packages.sql"
          target="_blank"
          rel="noreferrer"
        >
          SQL nadogradnju 019
        </a>
        , zatim osvježite stranicu.
      </p>
    );
  function update(id: string, values: Partial<DraftPackage>) {
    setRows((current) => current.map((p) => (p.id === id ? { ...p, ...values } : p)));
  }
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          await rpc('save_service_packages', {
            p_service: service.id,
            p_enabled: enabled,
            p_packages: rows.map((p) => ({
              id: p.id,
              name: p.name.trim(),
              description: p.description.trim(),
              price_cents: eurosToCents(p.price, 100),
              period: p.period,
              active: p.active,
            })),
          });
          await cache.invalidateQueries({ queryKey: ['services'] });
          await cache.invalidateQueries({ queryKey: ['service-packages', service.id] });
          await cache.invalidateQueries({ queryKey: ['cart'] });
          toast.success('Paketi su spremljeni.');
          done();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Paketi nisu spremljeni.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Svaki paket ima svoju cijenu. Tjedni i mjesečni paketi naplaćuju se jednom za odabrano
        razdoblje, bez automatske obnove. Pravila 50/50 nasljeđuju se iz usluge.
      </p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={busy || !initialized}
        />
        Kupac bira između paketa ove usluge
      </label>
      {q.isPending && <p>Učitavam pakete…</p>}
      {q.isError && (
        <p role="alert">
          Pakete nije moguće učitati.{' '}
          <button type="button" onClick={() => void q.refetch()}>
            Pokušaj ponovno
          </button>
        </p>
      )}
      {rows.map((p, index) => (
        <fieldset className="service-package" key={p.id} disabled={busy}>
          <legend>Paket {index + 1}</legend>
          <label>
            Naziv paketa
            <input
              required
              minLength={2}
              maxLength={150}
              value={p.name}
              onChange={(e) => update(p.id, { name: e.target.value })}
            />
          </label>
          <label>
            Opis i opseg paketa
            <textarea
              maxLength={2000}
              value={p.description}
              onChange={(e) => update(p.id, { description: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              Cijena paketa (€)
              <input
                required
                inputMode="decimal"
                value={p.price}
                onChange={(e) => update(p.id, { price: e.target.value })}
              />
            </label>
            <label>
              Razdoblje usluge
              <select value={p.period} onChange={(e) => update(p.id, { period: e.target.value })}>
                {Object.entries(packagePeriods).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={p.active}
              onChange={(e) => update(p.id, { active: e.target.checked })}
            />
            Paket dostupan kupcima
          </label>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRows((current) => current.filter((row) => row.id !== p.id))}
          >
            <Trash2 size={16} />
            Ukloni paket
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={busy || !initialized || q.isError}
        onClick={() => {
          setEnabled(true);
          setRows((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              name: `Paket ${current.length + 1}`,
              description: '',
              price: '',
              period: 'one_time',
              active: true,
            },
          ]);
        }}
      >
        <Plus size={16} />
        Dodaj paket
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy || !initialized || q.isError}>Spremi pakete</Button>
    </form>
  );
}
