import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Upload } from 'lucide-react';
import { useRows } from '../hooks/use-data';
import { stripeMethods, type PaymentMethod } from '../hooks/use-payment-methods';
import { Button } from './ui/button';
import { ConfirmationDialog } from './ui/dialog';
import { LoadingSkeleton, ErrorState, EmptyState } from './common';
import { requireDb } from '../lib/supabase';
import { action } from '../pages/workspace';
import { preparePaymentIcon } from './payment-icon-upload';
export function PaymentMethodManager() {
  const q = useRows<PaymentMethod>('payment_methods');
  const cache = useQueryClient();
  const [adding, setAdding] = useState(false),
    [selection, setSelection] = useState('visa'),
    [busy, setBusy] = useState(''),
    [deleting, setDeleting] = useState<PaymentMethod | null>(null),
    [confirming, setConfirming] = useState<PaymentMethod | null>(null),
    [approved, setApproved] = useState(false),
    [uploadError, setUploadError] = useState(false);
  const refresh = () => cache.invalidateQueries();
  const legacyBank = (method: PaymentMethod) =>
    method.provider === 'unconnected' &&
    /^(iban|iban uplata|uplata na iban|bankovna uplata)$/i.test(method.name.trim());
  async function toggle(method: PaymentMethod) {
    if (method.provider === 'bank') {
      setBusy(method.id);
      await action(async () => {
        const { error } = await requireDb().rpc('configure_bank_method', {
          p_enabled: !method.enabled,
        });
        if (error) throw new Error(error.message);
        await refresh();
      });
      setBusy('');
      return;
    }
    if (!method.enabled && ['apple_pay', 'google_pay'].includes(method.code)) {
      setApproved(false);
      setConfirming(method);
      return;
    }
    setBusy(method.id);
    await action(async () => {
      const { error } = await requireDb()
        .from('payment_methods')
        .update({
          enabled: !method.enabled,
          verified: !method.enabled && ['visa', 'mastercard'].includes(method.code),
        })
        .eq('id', method.id);
      if (error) throw error;
      await refresh();
    });
    setBusy('');
  }
  async function upload(method: PaymentMethod, file: File) {
    setBusy(method.id);
    setUploadError(false);
    const ok = await action(async () => {
      const db = requireDb(),
        png = await preparePaymentIcon(file),
        path = `${method.code}/${crypto.randomUUID()}.png`;
      const { error } = await db.storage
        .from('payment-icons')
        .upload(path, png, { contentType: 'image/png', upsert: false });
      if (error)
        throw new Error('Učitavanje ikone nije uspjelo. Provjerite prijavu i dostupnost pohrane.');
      const url = db.storage.from('payment-icons').getPublicUrl(path).data.publicUrl;
      const result = await db
        .from('payment_methods')
        .update({ icon_url: url })
        .eq('id', method.id)
        .select('id')
        .single();
      if (result.error) {
        await db.storage.from('payment-icons').remove([path]);
        throw result.error;
      }
      await refresh();
    }, 'Ikona je spremljena.');
    setUploadError(!ok);
    setBusy('');
  }
  const upgrade = (
    <div className="notice">
      <div>
        <strong>Potrebna je nadogradnja načina plaćanja</strong>
        <p>Jednom pokrenite SQL nadogradnju 008 nakon 006 i 007.</p>
        <a className="text-link" href="/migracije/202610240008_payment_methods.sql" download>
          Preuzmi SQL nadogradnju 008
        </a>
      </div>
    </div>
  );
  if (q.isPending) return <LoadingSkeleton />;
  if (q.isError)
    return ['PGRST205', '42P01'].includes((q.error as { code?: string }).code || '') ? (
      upgrade
    ) : (
      <ErrorState retry={() => void q.refetch()} />
    );
  return (
    <section className="payment-method-manager">
      <div className="panel-heading">
        <h3>Načini plaćanja i oznake</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setSelection(
              stripeMethods.find(([code]) => !q.data?.some((m) => m.code === code))?.[0] ||
                'custom',
            );
            setAdding(true);
          }}
        >
          <Plus size={16} />
          Dodaj način plaćanja
        </Button>
      </div>
      <p>
        Ovdje uređujete prikaz kupcima. Kartičnu naplatu uključujete prekidačem Stripe iznad;
        dostupnost novčanika određuje vaš Stripe račun i uređaj kupca.
      </p>
      <a
        className="text-link"
        href="https://dashboard.stripe.com/settings/payment_methods"
        target="_blank"
        rel="noopener noreferrer"
      >
        Otvori postavke načina plaćanja na Stripeu ↗
      </a>
      {q.data?.length ? (
        q.data.map((method) => (
          <article className="managed-payment-method" key={method.id}>
            <div className="payment-method-heading">
              <strong>{method.name}</strong>
              <span className="badge">
                {method.provider === 'bank'
                  ? method.enabled
                    ? 'IBAN plaćanje uključeno'
                    : 'IBAN plaćanje isključeno'
                  : legacyBank(method)
                    ? 'Potrebno je povezati IBAN'
                    : method.provider === 'unconnected'
                      ? 'Nije povezana s naplatom'
                      : method.enabled
                        ? 'Prikazuje se uz aktivan Stripe'
                        : 'Skriveno'}
              </span>
            </div>
            <p>
              {method.provider === 'bank'
                ? 'Bankovna uplata na spremljeni IBAN. Uključivanje i skrivanje mijenjaju i glavnu IBAN postavku. Primljene uplate potvrđujete nakon provjere bankovnog izvoda.'
                : legacyBank(method)
                  ? 'Vaša IBAN ikona je spremljena. Primijenite nadogradnju 011 kako bi se ova kartica povezala s bankovnom uplatom.'
                  : method.provider === 'unconnected'
                    ? 'Ovo je pripremljena oznaka i ikona. Naplata ovom metodom još nije integrirana.'
                    : ['apple_pay', 'google_pay'].includes(method.code)
                      ? 'Novčanik kroz Stripe Checkout. Dostupnost ovisi i o uređaju kupca.'
                      : 'Oznaka podržane kartice. Uklanjanje oznake ne blokira karticu u Stripeu.'}
            </p>
            {legacyBank(method) && (
              <a className="text-link" href="/migracije/202610250011_bank_method.sql" download>
                Preuzmi SQL nadogradnju 011 za IBAN
              </a>
            )}
            <div className="payment-icon-row">
              <div className="payment-icon-preview">
                {method.icon_url ? (
                  <img
                    src={method.icon_url}
                    alt={`Ikona ${method.name}`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{method.name}</span>
                )}
              </div>
              <label className="icon-file-label">
                Ikona {method.name}
                <span>
                  <Upload size={15} />
                  {busy === method.id ? 'Spremanje…' : 'Učitaj ikonu'}
                </span>
                <input
                  type="file"
                  aria-label={`Učitaj ikonu ${method.name}`}
                  accept="image/png,image/jpeg,image/webp"
                  disabled={Boolean(busy)}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void upload(method, file);
                  }}
                />
              </label>
              {method.icon_url && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Ukloni ikonu ${method.name}`}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void action(async () => {
                      const { error } = await requireDb()
                        .from('payment_methods')
                        .update({ icon_url: null })
                        .eq('id', method.id);
                      if (error) throw error;
                      await refresh();
                    })
                  }
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
            <div className="actions">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(busy) || !['stripe', 'bank'].includes(method.provider)}
                onClick={() => void toggle(method)}
              >
                {method.enabled ? 'Sakrij kupcima' : 'Prikaži kupcima'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={Boolean(busy)}
                aria-label={`Ukloni način plaćanja ${method.name}`}
                onClick={() => setDeleting(method)}
              >
                <Trash2 size={15} />
                Ukloni metodu
              </Button>
            </div>
          </article>
        ))
      ) : (
        <EmptyState
          title="Nema dodanih oznaka plaćanja"
          description="Dodajte samo metode koje koristite. Stripe naplata ima svoj zasebni prekidač."
        />
      )}
      {uploadError && (
        <div role="alert">
          <p>Provjerite PNG/JPG/WebP sliku do 2 MB i dostupnost pohrane.</p>
        </div>
      )}
      <ConfirmationDialog open={adding} onOpenChange={setAdding} title="Dodaj način plaćanja">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setBusy('new');
            const ok = await action(async () => {
              if (
                selection === 'iban' ||
                (selection === 'custom' &&
                  /^(iban|iban uplata|uplata na iban|bankovna uplata)$/i.test(
                    String(form.get('name') || '').trim(),
                  ))
              ) {
                if (q.data?.some((m) => m.provider === 'bank'))
                  throw new Error('IBAN je već dodan. Koristite postojeću IBAN karticu.');
                const { error } = await requireDb().rpc('configure_bank_method', {
                  p_enabled: false,
                });
                if (error)
                  throw new Error(
                    'Za povezivanje IBAN kartice najprije primijenite SQL nadogradnju 011.',
                  );
                await refresh();
                return;
              }
              const known = stripeMethods.find(([code]) => code === selection);
              const values = known
                ? {
                    code: known[0],
                    name: known[1],
                    provider: 'stripe',
                    enabled: false,
                    verified: false,
                  }
                : {
                    code: `custom_${crypto.randomUUID().replaceAll('-', '')}`,
                    name: String(form.get('name') || '').trim(),
                    provider: 'unconnected',
                    enabled: false,
                    verified: false,
                  };
              const { error } = await requireDb().from('payment_methods').insert(values);
              if (error) throw error;
              await refresh();
            }, 'Metoda je dodana kao skrivena.');
            setBusy('');
            if (ok) setAdding(false);
          }}
        >
          <label>
            Metoda
            <select value={selection} onChange={(e) => setSelection(e.target.value)}>
              {stripeMethods
                .filter(([code]) => !q.data?.some((m) => m.code === code))
                .map(([code, name]) => (
                  <option value={code} key={code}>
                    {name} — Stripe
                  </option>
                ))}
              {!q.data?.some((m) => m.code === 'iban') && (
                <option value="iban">IBAN — bankovna uplata</option>
              )}
              <option value="custom">Druga metoda — priprema</option>
            </select>
          </label>
          {selection === 'custom' ? (
            <>
              <label>
                Naziv metode
                <input
                  name="name"
                  minLength={2}
                  maxLength={80}
                  required
                  placeholder="Npr. drugi pružatelj plaćanja"
                />
              </label>
              <p>
                Možete pripremiti naziv i ikonu. Metoda će ostati skrivena dok se ne poveže stvarna
                naplata.
              </p>
            </>
          ) : selection === 'iban' ? (
            <p>
              Dodajte IBAN karticu, spremite primatelja i IBAN u Podaci za uplatu pa uključite
              bankovno plaćanje.
            </p>
          ) : (
            <p>
              Za Apple Pay i Google Pay prvo uključite novčanik na svom Stripe računu i provjerite
              ga u Checkoutu. Dodavanje ovdje ne mijenja postavke Stripe računa.
            </p>
          )}
          <Button disabled={Boolean(busy)}>Dodaj metodu</Button>
        </form>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!confirming}
        onOpenChange={() => setConfirming(null)}
        title={`Prikazati ${confirming?.name || 'novčanik'} kupcima?`}
      >
        <p>Stripe prikazuje novčanik samo kada su račun, uređaj i kartica kupca podržani.</p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
          />
          Uključio/la sam ovu metodu na Stripe računu i provjerio/la je u Stripe Checkoutu.
        </label>
        <Button
          type="button"
          disabled={!approved || Boolean(busy)}
          onClick={() =>
            void (async () => {
              setBusy(confirming!.id);
              const ok = await action(async () => {
                const { error } = await requireDb()
                  .from('payment_methods')
                  .update({ enabled: true, verified: true })
                  .eq('id', confirming!.id);
                if (error) throw error;
                await refresh();
              });
              setBusy('');
              if (ok) setConfirming(null);
            })()
          }
        >
          Potvrdi prikaz
        </Button>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Ukloniti način plaćanja iz prikaza?"
      >
        <p>
          {deleting?.provider === 'bank'
            ? 'Uklanjanje IBAN kartice isključuje IBAN za nove narudžbe. Postojeće narudžbe, upute za uplatu i potvrđene uplate ostaju sačuvane.'
            : 'Uklanja se spremljeni naziv i ikona iz popisa aplikacije. Za promjenu naplate na Stripe računu koristite Stripe Dashboard ili glavni prekidač naplate.'}
        </p>
        <Button
          type="button"
          variant="destructive"
          disabled={Boolean(busy)}
          onClick={() =>
            void (async () => {
              setBusy(deleting!.id);
              const ok = await action(async () => {
                const { error } = await requireDb()
                  .from('payment_methods')
                  .delete()
                  .eq('id', deleting!.id);
                if (error) throw error;
                await refresh();
              });
              setBusy('');
              if (ok) setDeleting(null);
            })()
          }
        >
          Potvrdi uklanjanje
        </Button>
      </ConfirmationDialog>
    </section>
  );
}
