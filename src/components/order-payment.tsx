import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Order } from '../lib/domain';
import { money } from '../lib/utils';
import { eurosToCents } from '../lib/currency';
import { useRows } from '../hooks/use-data';
import { rpc, invoke } from '../lib/supabase';
import { Button } from './ui/button';
import { EuroInput } from './euro-input';
import { ConfirmationDialog } from './ui/dialog';

export function OrderPayment({ order, admin = false }: { order: Order; admin?: boolean }) {
  const site = useRows<{ stripe_enabled: boolean; maintenance: boolean }>('site_settings');
  const installments = useRows<{ id: string; installment: number; amount_cents: number }>(
    'payment_installments',
    { order_id: order.id },
    'installment',
  );
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const bank = order.payment_method === 'bank';
  const pending = ['deposit_pending', 'final_pending'].includes(order.status);
  const current = installments.data?.find(
    (i) => i.installment === (order.status === 'final_pending' ? 2 : 1),
  );
  if (!pending) return null;
  if (bank)
    return (
      <section className="notice bank-instructions">
        <div>
          <h3>
            IBAN uplata ·{' '}
            {order.status === 'final_pending'
              ? '2. rata nakon izrade'
              : order.payment_model === 'split'
                ? '1. rata prije izrade'
                : 'jednokratno'}
          </h3>
          <dl>
            <dt>Primatelj</dt>
            <dd>{order.bank_instructions?.recipient || 'Obratite se podršci'}</dd>
            <dt>IBAN</dt>
            <dd>{order.bank_instructions?.iban}</dd>
            <dt>Banka</dt>
            <dd>{order.bank_instructions?.bank || '—'}</dd>
            <dt>Iznos za uplatu</dt>
            <dd>{current ? money(current.amount_cents) : 'Provjera iznosa…'}</dd>
            <dt>Opis plaćanja</dt>
            <dd>
              {order.number} / {order.status === 'final_pending' ? '2' : '1'}. uplata
            </dd>
          </dl>
          <p>
            Uplata se evidentira nakon provjere bankovnog izvoda. Izrada počinje nakon prve uplate,
            a završne datoteke isporučuju se nakon cijele uplate.
          </p>
          {!admin && <ChangePaymentMethod order={order} />}
          {admin && (
            <Button type="button" disabled={!current || busy} onClick={() => setOpen(true)}>
              Evidentiraj primljenu IBAN uplatu
            </Button>
          )}
          <ConfirmationDialog
            open={open}
            onOpenChange={(v) => {
              if (!busy) setOpen(v);
            }}
            title="Potvrdi primljenu bankovnu uplatu"
          >
            <p>
              Provjerite da je novac stvarno zaprimljen na bankovnom izvodu. Ova potvrda mijenja
              plaćeni iznos i status narudžbe.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  await rpc('confirm_bank_payment', {
                    p_order: order.id,
                    p_amount: eurosToCents(String(form.get('amount')), 1),
                    p_reference: String(form.get('reference')),
                  });
                  setOpen(false);
                  await cache.invalidateQueries();
                  toast.success('Bankovna uplata je evidentirana.');
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Potvrda nije uspjela.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Iznos primljen na račun (€)
                <EuroInput name="amount" defaultCents={current?.amount_cents} required />
              </label>
              <label>
                Jedinstvena referenca transakcije s bankovnog izvoda
                <input name="reference" required minLength={6} maxLength={150} />
              </label>
              <Button variant="destructive" disabled={busy}>
                {busy ? 'Spremanje…' : 'Potvrdi provjerenu uplatu'}
              </Button>
            </form>
          </ConfirmationDialog>
        </div>
      </section>
    );
  if (admin) return null;
  const enabled = site.data?.[0]?.stripe_enabled && !site.data?.[0]?.maintenance;
  return (
    <div className="notice">
      <div>
        <p>
          {enabled
            ? 'Naplata se provodi na službenoj Stripe stranici. Uplatu potvrđuje Stripe, a ne povratak na ovu stranicu.'
            : 'Online plaćanje trenutačno nije aktivirano.'}
        </p>
        {['apple_pay', 'google_pay'].includes(order.payment_method || '') && (
          <p>
            Odabrano: {order.payment_method === 'apple_pay' ? 'Apple Pay' : 'Google Pay'}. Novčanik
            se prikazuje kada ga podržavaju uređaj i kartica; dostupno je i plaćanje karticom.
          </p>
        )}
        <ChangePaymentMethod order={order} />
        {enabled && (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { url } = await invoke<{ url: string }>('checkout', { order_id: order.id });
                if (!url.startsWith('https://checkout.stripe.com/'))
                  throw new Error('Neočekivana adresa naplate.');
                window.location.assign(url);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Naplata nije otvorena.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Otvaranje…' : 'Plati putem Stripea'}
          </Button>
        )}
      </div>
    </div>
  );
}

function ChangePaymentMethod({ order }: { order: Order }) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const options = useQuery({
    queryKey: ['checkout-options'],
    enabled: open,
    queryFn: () => rpc<Record<string, boolean>>('checkout_options'),
  });
  if (order.status !== 'deposit_pending' || order.paid_cents !== 0) return null;
  return (
    <div className="actions">
      <Button type="button" variant="outline" onClick={() => setOpen(!open)}>
        Promijeni način plaćanja
      </Button>
      {open && (
        <label>
          Način plaćanja za ugovoreni model{' '}
          {order.payment_model === 'split' ? '50/50' : 'jednokratno'}
          <select
            disabled={busy || !options.data}
            value={order.payment_method || 'card'}
            onChange={async (e) => {
              setBusy(true);
              try {
                await rpc('choose_order_payment', { p_order: order.id, p_method: e.target.value });
                await cache.invalidateQueries();
                setOpen(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Promjena nije uspjela.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {[
              ['card', 'Kartica'],
              ['bank', 'IBAN'],
              ['google_pay', 'Google Pay'],
              ['apple_pay', 'Apple Pay'],
            ]
              .filter(([key]) => order.payment_model !== 'split' || ['card', 'bank'].includes(key))
              .map(([key, label]) => (
                <option key={key} value={key} disabled={!options.data?.[key]}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      )}
    </div>
  );
}
