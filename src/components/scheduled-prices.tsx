import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { toast } from 'sonner';
import { requireDb, rpc } from '../lib/supabase';
import { eurosToCents } from '../lib/currency';
import { localDate, money } from '../lib/utils';
import type { Service } from '../lib/domain';
import { Button } from './ui/button';
import { EuroInput } from './euro-input';
import { ConfirmationDialog } from './ui/dialog';

type PriceChange = {
  id: string;
  service_name: string;
  category_name: string;
  new_price_cents: number;
  starts_at: string;
  status: string;
  last_error: string | null;
};
function usePriceSchedule() {
  return useQuery({
    queryKey: ['service-price-schedules'],
    queryFn: async () => {
      const { data, error } = await requireDb().rpc('price_schedule_health');
      if (error)
        throw new Error(
          ['PGRST202', '42883'].includes(error.code)
            ? 'Nedostaje SQL nadogradnja 020.'
            : 'Raspored nije dostupan. Provjerite vezu i pokušajte ponovno.',
        );
      return data as { worker_ready: boolean; changes: PriceChange[] };
    },
    retry: false,
  });
}
function UpgradeLink() {
  return (
    <a
      className="text-link"
      href="/migracije/202611120020_scheduled_prices.sql"
      target="_blank"
      rel="noreferrer"
    >
      SQL nadogradnju 020
    </a>
  );
}
export function ScheduledServicePrices() {
  const q = usePriceSchedule(),
    cache = useQueryClient();
  const [cancel, setCancel] = useState<PriceChange | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <h2>Zakazane promjene cijena</h2>
      <p>
        Cijene se primjenjuju od odabranog datuma i vremena u Hrvatskoj. Postojeće narudžbe
        zadržavaju svoje iznose.
      </p>
      {q.isPending ? (
        <p>Učitavam raspored…</p>
      ) : q.isError ? (
        <p>
          {q.error instanceof Error && q.error.message.includes('020') ? (
            <>
              Za uključivanje primijenite <UpgradeLink /> i osvježite stranicu.
            </>
          ) : (
            'Raspored trenutačno nije dostupan. Provjerite vezu i pokušajte ponovno.'
          )}
        </p>
      ) : (
        <>
          {!q.data?.worker_ready && (
            <p className="notice">
              Pozadinski posao cijena nije aktivan. Cijene se dodatno provjeravaju pri otvaranju
              kataloga i prije potvrde narudžbe.
            </p>
          )}
          {!q.data?.changes.length ? (
            <p>Nema zakazanih promjena.</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usluga</th>
                    <th>Nova cijena</th>
                    <th>Vrijedi od</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {q.data.changes.map((change) => (
                    <tr key={change.id}>
                      <td>
                        {change.service_name}
                        <small style={{ display: 'block' }}>{change.category_name}</small>
                      </td>
                      <td>{money(change.new_price_cents)}</td>
                      <td>{localDate(change.starts_at)}</td>
                      <td>
                        {{
                          pending: 'Zakazano',
                          applied: 'Primijenjeno',
                          cancelled: 'Otkazano',
                          skipped: 'Potrebna provjera',
                        }[change.status] || change.status}
                        {change.last_error && <p>{change.last_error}</p>}
                      </td>
                      <td>
                        {change.status === 'pending' && (
                          <Button size="sm" variant="ghost" onClick={() => setCancel(change)}>
                            Otkaži promjenu
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={q.isFetching}
        onClick={() => void q.refetch()}
      >
        Provjeri raspored
      </Button>
      <ConfirmationDialog
        open={!!cancel}
        onOpenChange={(value) => {
          if (!value && !busy) setCancel(null);
        }}
        title="Otkazati zakazanu cijenu?"
      >
        <p>
          {cancel?.service_name}: {cancel && money(cancel.new_price_cents)} od{' '}
          {cancel && localDate(cancel.starts_at)}.
        </p>
        <Button
          disabled={busy}
          onClick={async () => {
            if (!cancel) return;
            setBusy(true);
            try {
              await rpc('cancel_service_price', { p_id: cancel.id });
              await cache.invalidateQueries({ queryKey: ['service-price-schedules'] });
              setCancel(null);
              toast.success('Zakazana promjena je otkazana.');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Otkazivanje nije uspjelo.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Otkaži zakazanu promjenu
        </Button>
      </ConfirmationDialog>
    </section>
  );
}
export function SchedulePriceEditor({ service, done }: { service: Service; done: () => void }) {
  const q = usePriceSchedule(),
    cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (q.isPending) return <p>Provjeravam raspored…</p>;
  if (q.isError)
    return (
      <p>
        {q.error instanceof Error && q.error.message.includes('020') ? (
          <>
            Najprije primijenite <UpgradeLink /> i osvježite stranicu.
          </>
        ) : (
          'Raspored trenutačno nije dostupan. Pokušajte ponovno.'
        )}
      </p>
    );
  if (service.packages_enabled)
    return <p>Ova usluga koristi pakete. Njihove cijene uređuju se zasebno.</p>;
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError('');
        try {
          await rpc('schedule_service_price', {
            p_service: service.id,
            p_price: eurosToCents(String(form.get('price')), 100),
            p_starts: fromZonedTime(String(form.get('starts')), 'Europe/Zagreb').toISOString(),
            p_note: String(form.get('note')).trim(),
          });
          await cache.invalidateQueries({ queryKey: ['service-price-schedules'] });
          done();
          toast.success('Nova cijena je zakazana.');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Cijena nije zakazana.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Trenutačna cijena:{' '}
        {service.price_cents === null ? 'Prema ponudi' : money(service.price_cents)}. Nova cijena
        vrijedi za buduće narudžbe.
      </p>
      <label>
        Nova cijena (€)
        <EuroInput name="price" required defaultCents={service.price_cents} />
      </label>
      <label>
        Vrijedi od (vrijeme Hrvatske)
        <input
          type="datetime-local"
          name="starts"
          required
          defaultValue={formatInTimeZone(
            new Date(Date.now() + 86400000),
            'Europe/Zagreb',
            "yyyy-MM-dd'T'HH:mm",
          )}
        />
      </label>
      <label>
        Bilješka
        <input name="note" maxLength={1000} />
      </label>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Button disabled={busy}>Zakaži novu cijenu</Button>
    </form>
  );
}
