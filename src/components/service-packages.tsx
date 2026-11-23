import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/use-auth';
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
type PackageDraft = { rows: DraftPackage[]; enabled: boolean };
function readPackageDraft(key: string): PackageDraft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (
      value?.version !== 1 ||
      typeof value.enabled !== 'boolean' ||
      !Array.isArray(value.rows) ||
      value.rows.length > 100
    )
      return null;
    if (
      !value.rows.every(
        (row: DraftPackage) =>
          row &&
          ['id', 'name', 'description', 'price', 'period'].every(
            (field) => typeof row[field as keyof DraftPackage] === 'string',
          ) &&
          typeof row.active === 'boolean',
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
const packageRows = (packages: ServicePackage[]): DraftPackage[] =>
  packages.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    price: centsToEuroInput(p.price_cents),
    period: p.period,
    active: p.active,
  }));
export function ServicePackagesEditor({ service, done }: { service: Service; done: () => void }) {
  const { session } = useAuth();
  const draftKey = `fp-package-draft:${session?.user.id || 'visitor'}:${service.id}`;
  const [draft] = useState(() => readPackageDraft(draftKey));
  const [dirty, setDirty] = useState(Boolean(draft));
  const [draftStored, setDraftStored] = useState(Boolean(draft));
  const [restored, setRestored] = useState(Boolean(draft));
  const saved = useRef(false);
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
  const [rows, setRows] = useState<DraftPackage[]>(draft?.rows || []);
  const [enabled, setEnabled] = useState(draft?.enabled ?? service.packages_enabled ?? false);
  const [initialized, setInitialized] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (q.data && !initialized) {
      if (!draft) setRows(packageRows(q.data));
      setInitialized(true);
    }
  }, [q.data, initialized, draft]);
  useEffect(() => {
    if (!initialized || !dirty || saved.current) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, rows, enabled }));
      setDraftStored(true);
    } catch {
      setDraftStored(false);
    }
  }, [rows, enabled, initialized, dirty, draftKey]);
  function clearDraft() {
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      /* Database save does not depend on browser storage. */
    }
  }

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
    setDirty(true);
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
          saved.current = true;
          clearDraft();
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
      {dirty && (
        <div className="notice" role="status">
          <div>
            <p>
              {restored ? 'Vraćen je nespremljeni nacrt. ' : ''}
              {draftStored
                ? 'Unos je sačuvan kao nacrt u ovoj kartici preglednika, ali još nije spremljen u bazu.'
                : 'Preglednik ne može sačuvati nacrt. Unos još nije spremljen u bazu.'}{' '}
              Za trajno spremanje kliknite „Spremi pakete”.
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !initialized || q.isError}
              onClick={() => {
                clearDraft();
                setRows(packageRows(q.data || []));
                setEnabled(service.packages_enabled || false);
                setDirty(false);
                setDraftStored(false);
                setRestored(false);
                setError('');
              }}
            >
              Odbaci nacrt
            </Button>
          </div>
        </div>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setDirty(true);
            setEnabled(e.target.checked);
          }}
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
        <fieldset
          className="service-package"
          key={p.id}
          disabled={busy || !initialized || q.isError}
        >
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
            onClick={() => {
              setDirty(true);
              setRows((current) => current.filter((row) => row.id !== p.id));
            }}
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
          setDirty(true);
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
