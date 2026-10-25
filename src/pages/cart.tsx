import { usePublicPaymentMethods } from '../hooks/use-payment-methods';
import { AddToCartButton } from '../components/add-to-cart';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useServices } from '../hooks/use-data';
import { useAuth } from '../hooks/use-auth';
import { Button } from '../components/ui/button';
import { EmptyState, PageHeader, ServiceIcon, SearchInput } from '../components/common';
import { FilePicker, NewOrderPage, QueryState } from './workspace';
import { requireDb, rpc, invoke } from '../lib/supabase';
import { localDate, money } from '../lib/utils';
import { installments, type CartItem } from '../lib/domain';

export interface CartPrice {
  subtotal: number;
  discount: number;
  total: number;
  split: boolean;
  count: number;
}
type Options = Record<'card' | 'bank' | 'google_pay' | 'apple_pay', boolean>;
const choices = [
  { id: 'card_full', method: 'card', model: 'full', label: 'Kartica - jednokratno' },
  {
    id: 'card_split',
    method: 'card',
    model: 'split',
    label: 'Kartica - 2 rate (50% prije/50% poslije izrade)',
  },
  { id: 'google_pay', method: 'google_pay', model: 'full', label: 'Google Pay' },
  { id: 'apple_pay', method: 'apple_pay', model: 'full', label: 'Apple Pay' },
  { id: 'bank_full', method: 'bank', model: 'full', label: 'IBAN - jednokratno' },
  {
    id: 'bank_split',
    method: 'bank',
    model: 'split',
    label: 'IBAN - 2 rate (50% prije/50% poslije izrade)',
  },
] as const;
export function CatalogOrderPage() {
  const q = useServices();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const service = q.data?.find((s) => s.slug === params.get('usluga'));
  if (params.get('ponuda') === '1' && service?.price_cents === null) return <NewOrderPage />;
  return (
    <>
      <PageHeader
        title="Nova narudžba"
        description="Dodajte artikle u košaricu. Upute, datoteke i način plaćanja odabirete pri završetku narudžbe."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/kosarica">
              Otvori košaricu <ArrowRight size={16} />
            </Link>
          </Button>
        }
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Pretraži artikle" />
      <QueryState query={q}>
        <div className="checkout-catalog">
          {q.data
            ?.filter((s) => `${s.name} ${s.category}`.toLowerCase().includes(search.toLowerCase()))
            .map((s) => (
              <article className={`panel service-${s.icon}`} key={s.id}>
                <span className="service-icon">
                  <ServiceIcon name={s.icon} />
                </span>
                <small>{s.category}</small>
                <h2>{s.name}</h2>
                <p>{s.description}</p>
                <strong>{s.price_cents === null ? 'Prema ponudi' : money(s.price_cents)}</strong>
                <AddToCartButton service={s} />
              </article>
            ))}
        </div>
      </QueryState>
    </>
  );
}

interface Draft {
  title: string;
  description: string;
  course: string;
  due: string;
  school: string;
  mentor: string;
  student: string;
  year: string;
  place: string;
}
const emptyDraft: Draft = {
  title: '',
  description: '',
  course: '',
  due: '',
  school: '',
  mentor: '',
  student: '',
  year: '',
  place: '',
};
export function CartPage() {
  const methodIcons = usePublicPaymentMethods();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const { session } = useAuth();
  const storageKey = `fp-checkout:${session!.user.id}`;
  const [saved] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || '{}');
    } catch {
      return {};
    }
  });
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft, ...saved.draft });
  const [requestId] = useState<string>(saved.requestId || crypto.randomUUID());
  const [promo, setPromo] = useState<string>(saved.promo || '');
  const [code, setCode] = useState(promo);
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState('card_full');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const cart = useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const { data, error } = await requireDb()
        .from('cart_items')
        .select('*,services(*)')
        .order('created_at');
      if (error) throw error;
      return data as CartItem[];
    },
  });
  const items = cart.data || [];
  const price = useQuery({
    queryKey: [
      'cart-price',
      promo,
      items
        .map(
          (i) =>
            `${i.id}:${i.quantity}:${i.services?.price_cents}:${i.services?.split_enabled}:${i.services?.split_min_cents}`,
        )
        .join('|'),
    ],
    enabled: cart.isSuccess && items.length > 0,
    queryFn: () => rpc<CartPrice>('cart_pricing', { p_promo: promo || null }),
    retry: false,
  });
  const options = useQuery({
    queryKey: ['checkout-options'],
    queryFn: () => rpc<Options>('checkout_options'),
  });
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify({ draft, requestId, promo }));
  }, [draft, requestId, promo, storageKey]);
  const selected = choices.find((c) => c.id === selection)!;
  const chosen =
    selected.model === 'split' && !price.data?.split
      ? choices.find((c) => c.method === selected.method && c.model === 'full')!
      : selected;
  const allowed = (c: (typeof choices)[number]) =>
    !!options.data?.[c.method] && (c.model !== 'split' || !!price.data?.split);
  const total = price.data?.total;
  function field(key: keyof Draft, label: string, required = false, type = 'text') {
    return (
      <label>
        {label}
        <input
          type={type}
          required={required}
          minLength={key === 'title' ? 3 : undefined}
          maxLength={key === 'title' ? 150 : 400}
          value={draft[key]}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        />
      </label>
    );
  }
  async function change(item: CartItem, quantity: number) {
    setBusy(true);
    try {
      await rpc('cart_set', { p_service: item.service_id, p_quantity: quantity });
      await cache.invalidateQueries({ queryKey: ['cart'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Izmjena nije uspjela.');
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (!allowed(chosen) || !price.data || price.isFetching || price.isError) return;
    setBusy(true);
    let id: string | undefined;
    try {
      id = await rpc<string>('checkout_cart_order', {
        p_request: requestId,
        p_title: draft.title,
        p_description: draft.description,
        p_due: new Date(draft.due).toISOString(),
        p_method: chosen.method,
        p_model: chosen.model,
        p_promo: promo || null,
        p_details: {
          course: draft.course,
          school: draft.school,
          mentor: draft.mentor,
          student: draft.student,
          year: draft.year,
          place: draft.place,
        },
      });
      sessionStorage.removeItem(storageKey);
      let failed = 0;
      for (const file of files) {
        const form = new FormData();
        form.set('order_id', id);
        form.set('file', file);
        const { data, error } = await requireDb().functions.invoke('upload', { body: form });
        if (error || data?.error) failed++;
      }
      await cache.invalidateQueries();
      if (failed)
        toast.error(
          'Narudžba je spremljena, ali dio datoteka nije prenesen. Dodajte ih u detaljima narudžbe.',
        );
      navigate(`/app/narudzbe/${id}`);
      if (chosen.method !== 'bank') {
        const { url } = await invoke<{ url: string }>('checkout', { order_id: id });
        if (!url.startsWith('https://checkout.stripe.com/'))
          throw new Error('Neočekivana adresa naplate.');
        window.location.assign(url);
      } else toast.success('Narudžba je spremljena. Podaci za IBAN uplatu nalaze se u detaljima.');
    } catch (error) {
      if (id) navigate(`/app/narudzbe/${id}`);
      toast.error(
        id
          ? 'Narudžba je spremljena. Naplata nije otvorena; pokušajte ponovno u detaljima narudžbe.'
          : error instanceof Error
            ? error.message
            : 'Narudžba nije kreirana.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title={['Košarica', 'Detalji narudžbe', 'Odabir plaćanja'][step]}
        description="Košarica → podaci i datoteke → način plaćanja"
      />
      <nav className="wizard-steps" aria-label="Koraci kupnje">
        {['Košarica', 'Podaci i datoteke', 'Plaćanje'].map((label, i) => (
          <button
            key={label}
            disabled={busy || i > step}
            className={step === i ? 'active' : ''}
            aria-current={step === i ? 'step' : undefined}
            onClick={() => setStep(i)}
          >
            {i + 1}. {label}
          </button>
        ))}
      </nav>
      <QueryState query={cart}>
        {!items.length ? (
          <EmptyState
            title="Košarica je prazna"
            description="Dodajte artikle pa nastavite na unos podataka i plaćanje."
            action={
              <Button asChild>
                <Link to="/app/nova-narudzba">Dodaj artikle</Link>
              </Button>
            }
          />
        ) : (
          <form
            className="cart-layout checkout-flow"
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 1 && new Date(draft.due) <= new Date()) {
                toast.error('Rok isporuke mora biti u budućnosti.');
                return;
              }
              if (step < 2) setStep(step + 1);
              else void finish();
            }}
          >
            <div>
              {step === 0 && (
                <section className="panel cart-items">
                  <h2>Odabrani artikli ({items.length})</h2>
                  {items.map((i) => (
                    <article className="cart-item" key={i.id}>
                      <span className="service-icon">
                        <ServiceIcon name={i.services?.icon || 'FileText'} />
                      </span>
                      <div className="cart-item-copy">
                        <h3>{i.services?.name || 'Nedostupan artikl'}</h3>
                        <p>{i.services?.description}</p>
                      </div>
                      <div className="cart-item-controls">
                        <div className="quantity-stepper">
                          <Button
                            type="button"
                            variant="ghost"
                            aria-label={`Smanji količinu: ${i.services?.name}`}
                            disabled={busy || i.quantity <= 1}
                            onClick={() => void change(i, i.quantity - 1)}
                          >
                            −
                          </Button>
                          <label>
                            Količina
                            <input
                              aria-label={`Količina: ${i.services?.name}`}
                              type="number"
                              min={1}
                              max={100}
                              value={i.quantity}
                              disabled={busy}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                if (Number.isInteger(value) && value >= 1 && value <= 100)
                                  void change(i, value);
                              }}
                            />
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            aria-label={`Povećaj količinu: ${i.services?.name}`}
                            disabled={busy || i.quantity >= 100}
                            onClick={() => void change(i, i.quantity + 1)}
                          >
                            +
                          </Button>
                        </div>
                        <strong>
                          {i.services?.price_cents == null
                            ? 'Prema ponudi'
                            : money(i.services.price_cents * i.quantity)}
                        </strong>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void change(i, 0)}
                        >
                          <Trash2 size={16} />
                          Ukloni
                        </Button>
                      </div>
                    </article>
                  ))}
                  <div className="actions">
                    <Button asChild type="button" variant="outline">
                      <Link to="/app/nova-narudzba">Dodaj još artikala</Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await rpc('cart_clear');
                          await cache.invalidateQueries({ queryKey: ['cart'] });
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : 'Pražnjenje nije uspjelo.',
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Isprazni košaricu
                    </Button>
                  </div>
                </section>
              )}
              {step === 1 && (
                <>
                  <section className="panel">
                    <h2>Osnovni podaci o zadatku</h2>
                    {field('title', 'Naslov / tema zadatka', true)}
                    <div className="form-row">
                      {field('course', 'Predmet / područje', true)}
                      {field('due', 'Rok isporuke', true, 'datetime-local')}
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Podaci za naslovnicu (neobvezno)</h2>
                    <p>Ispunite ako želite uređivanje naslovnice.</p>
                    {field('school', 'Naziv i adresa škole / fakulteta')}
                    <div className="form-row">
                      {field('mentor', 'Ime i prezime mentora')}
                      {field('student', 'Ime i prezime učenika / studenta')}
                    </div>
                    <div className="form-row">
                      {field('year', 'Razred / godina')}
                      {field('place', 'Mjesto i datum')}
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Upute i datoteke</h2>
                    <label>
                      Detaljne upute
                      <textarea
                        required
                        minLength={10}
                        maxLength={10000}
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      />
                    </label>
                    <FilePicker files={files} setFiles={setFiles} />
                    <p>
                      Datoteke se prenose nakon potvrde narudžbe. Nakon zatvaranja stranice potrebno
                      ih je ponovno odabrati.
                    </p>
                  </section>
                </>
              )}
              {step === 2 && (
                <>
                  <section className="panel checkout-review">
                    <div className="panel-heading">
                      <h2>Pregled prije plaćanja</h2>
                      <Button type="button" variant="outline" onClick={() => setStep(1)}>
                        Uredi podatke
                      </Button>
                    </div>
                    <dl className="checkout-details">
                      {Object.entries({
                        title: 'Naslov / tema',
                        course: 'Predmet / područje',
                        due: 'Rok isporuke',
                        school: 'Škola / fakultet',
                        mentor: 'Mentor',
                        student: 'Učenik / student',
                        year: 'Razred / godina',
                        place: 'Mjesto i datum',
                      }).map(([key, label]) =>
                        draft[key as keyof Draft] ? (
                          <div key={key}>
                            <dt>{label}</dt>
                            <dd>
                              {key === 'due' ? localDate(draft.due) : draft[key as keyof Draft]}
                            </dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                    <h3>Upute</h3>
                    <p className="checkout-instructions">{draft.description}</p>
                    <h3>Datoteke ({files.length})</h3>
                    {files.length ? (
                      <ul>
                        {files.map((file, i) => (
                          <li key={i}>{file.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Nema odabranih datoteka.</p>
                    )}
                  </section>
                  <section className="panel">
                    <fieldset
                      className={`payment-models checkout-plans ${price.data?.split ? '' : 'single-plan'}`}
                    >
                      <legend>Odaberite model plaćanja</legend>
                      {(['full', 'split'] as const)
                        .filter((model) => model === 'full' || price.data?.split === true)
                        .map((model) => (
                          <label key={model} className={chosen.model === model ? 'selected' : ''}>
                            <input
                              type="radio"
                              name="plan"
                              value={model}
                              checked={chosen.model === model}
                              disabled={busy}
                              onChange={() =>
                                setSelection(
                                  `${['card', 'bank'].includes(chosen.method) ? chosen.method : 'card'}_${model}`,
                                )
                              }
                            />
                            <strong>
                              {model === 'full'
                                ? 'Plaćanje u cijelosti (100%)'
                                : 'Plaćanje u 2 rate (50% + 50%)'}
                            </strong>
                            <span>
                              {model === 'full'
                                ? 'Puni iznos prije početka izrade.'
                                : '50% prije izrade, 50% nakon izrade i prije isporuke.'}
                            </span>
                            {total != null && (
                              <b>{money(model === 'split' ? Math.ceil(total / 2) : total)} sada</b>
                            )}
                          </label>
                        ))}
                    </fieldset>
                  </section>
                  <section className="panel">
                    <fieldset className="payment-models checkout-methods">
                      <legend>Odaberite način plaćanja</legend>
                      {(['card', 'google_pay', 'apple_pay', 'bank'] as const).map((method) => {
                        const c = choices.find(
                          (choice) =>
                            choice.method === method &&
                            (choice.model === chosen.model ||
                              ['google_pay', 'apple_pay'].includes(method)),
                        )!;
                        const supportedModel = !(
                          ['google_pay', 'apple_pay'].includes(method) && chosen.model === 'split'
                        );
                        return (
                          <label
                            key={method}
                            className={chosen.method === method ? 'selected' : ''}
                          >
                            <input
                              type="radio"
                              name="payment"
                              value={c.id}
                              checked={chosen.method === method}
                              disabled={!supportedModel || !allowed(c) || busy}
                              onChange={() => setSelection(c.id)}
                            />
                            {(() => {
                              const icon = methodIcons.data?.find(
                                (m) =>
                                  m.code ===
                                  (method === 'bank'
                                    ? 'iban'
                                    : method === 'card'
                                      ? 'visa'
                                      : method),
                              )?.icon_url;
                              return icon ? (
                                <img
                                  className="checkout-method-icon"
                                  src={icon}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                />
                              ) : null;
                            })()}
                            <strong>{c.label}</strong>
                            {!options.data?.[method] && <span>Trenutačno nije aktivirano.</span>}
                            {!supportedModel && <span>Dostupno uz jednokratno plaćanje.</span>}
                          </label>
                        );
                      })}
                    </fieldset>
                    <p>
                      Google Pay i Apple Pay dostupni su na podržanim uređajima i preglednicima na
                      Stripe stranici naplate. Ako novčanik nije dostupan, možete platiti karticom.
                    </p>
                    <p>Uplatu na IBAN potvrđuje administrator nakon provjere bankovnog izvoda.</p>
                  </section>
                </>
              )}
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setStep(step - 1)}
                >
                  Natrag
                </Button>
              )}
            </div>
            <aside>
              <section className="panel cart-summary">
                <h2>Sažetak narudžbe</h2>
                <ul className="checkout-summary-items">
                  {items.map((i) => (
                    <li key={i.id}>
                      <span>
                        {i.quantity} × {i.services?.name || 'Nedostupan artikl'}
                      </span>
                      <strong>
                        {i.services?.price_cents == null
                          ? '—'
                          : money(i.quantity * i.services.price_cents)}
                      </strong>
                    </li>
                  ))}
                </ul>
                {step === 0 && (
                  <>
                    <label>
                      Imate kod za popust?
                      <input
                        value={code}
                        maxLength={80}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                      />
                    </label>
                    <div className="actions">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setPromo(code.trim())}
                      >
                        Primijeni
                      </Button>
                      {promo && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setPromo('');
                            setCode('');
                          }}
                        >
                          Ukloni kupon
                        </Button>
                      )}
                    </div>
                  </>
                )}
                {price.error && (
                  <p role="alert">
                    {price.error instanceof Error
                      ? price.error.message
                      : 'Provjera cijene nije uspjela.'}
                  </p>
                )}
                {options.isError && step === 2 && (
                  <p role="alert">
                    Načini plaćanja nisu dostupni. Osvježite stranicu ili se obratite podršci.
                  </p>
                )}
                {price.data && !price.isError && (
                  <>
                    <dl>
                      <dt>Međuzbroj</dt>
                      <dd>{money(price.data.subtotal)}</dd>
                      <dt>Popust {promo}</dt>
                      <dd>−{money(price.data.discount)}</dd>
                    </dl>
                    <div className="cart-total">
                      <strong>Ukupno</strong>
                      <strong>{money(price.data.total)}</strong>
                    </div>
                    {step === 2 && (
                      <div className="checkout-due">
                        <p>
                          Odabrano: <strong>{chosen.label}</strong>
                        </p>
                        <dl>
                          <dt>Za platiti sada</dt>
                          <dd>
                            {money(installments(price.data.total, chosen.model === 'split')[0])}
                          </dd>
                          {chosen.model === 'split' && (
                            <>
                              <dt>Nakon izrade, prije isporuke</dt>
                              <dd>{money(installments(price.data.total, true)[1])}</dd>
                            </>
                          )}
                        </dl>
                      </div>
                    )}
                  </>
                )}
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    price.isPending ||
                    price.isFetching ||
                    price.isError ||
                    (step === 2 && !allowed(chosen))
                  }
                >
                  {busy
                    ? 'Spremanje…'
                    : step === 0
                      ? 'Nastavi na narudžbu'
                      : step === 1
                        ? 'Nastavi na plaćanje'
                        : chosen.method === 'bank'
                          ? 'Potvrdi narudžbu za IBAN uplatu'
                          : 'Potvrdi i nastavi na sigurnu naplatu'}
                  <ArrowRight size={16} />
                </Button>
                <small>
                  {step === 2
                    ? 'Potvrdom nastaje jedna narudžba za sve artikle. Uplata se evidentira tek nakon potvrde.'
                    : 'Nastavak ne kreira narudžbu i ne naplaćuje karticu.'}
                </small>
              </section>
            </aside>
          </form>
        )}
      </QueryState>
    </>
  );
}
