import { saveCatalogService, catalogError } from '../lib/catalog-editor';
import { useSiteSettings, usePublishedPage } from '../hooks/use-site-settings';
import { WorkPreviewGallery } from '../components/work-preview-gallery';
import { WorkDeliveryUpload } from '../components/work-delivery-upload';
import { WorkPreview } from '../components/work-preview';
import { OrderPayment } from '../components/order-payment';
import { EuroInput } from '../components/euro-input';
import { eurosToCents, centsToEuroInput } from '../lib/currency';
import { AdminDashboardExtras } from './admin/overview';
import {
  OrderStageTimeline,
  OrderSummaryTable,
  PaymentRemainder,
} from '../components/order-overview';
import {
  RecentMessages,
  RecommendedServices,
  RecentActivity,
  BusinessCharts,
} from '../components/overview-panels';
import { PageNote } from '../components/brand';
import { PaymentMethods } from '../components/payment-methods';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight,
  ShoppingBag,
  Gift,
  Plus,
  Download,
  Folder,
  FileText,
  CreditCard,
  Clock3,
  Send,
  Upload,
} from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { useRows, useServices } from '../hooks/use-data';
import { Button } from '../components/ui/button';
import { ConfirmationDialog } from '../components/ui/dialog';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  OrderCard,
  PageHeader,
  SearchInput,
  ServiceIcon,
  StatCard,
  StatusBadge,
  Unavailable,
} from '../components/common';
import { requireDb, rpc, invoke, configured } from '../lib/supabase';
import type {
  Order,
  OrderFile,
  Message,
  Payment,
  Quote,
  OrderStatus,
  Service,
} from '../lib/domain';
import { installments, statuses, transitions } from '../lib/domain';
import { localDate, money } from '../lib/utils';
export function QueryState({
  query,
  children,
}: {
  query: { isPending: boolean; isError: boolean; refetch: () => unknown };
  children: React.ReactNode;
}) {
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;
  return <>{children}</>;
}
export async function action(fn: () => Promise<unknown>, success = 'Promjene su spremljene.') {
  try {
    await fn();
    toast.success(success);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Zahtjev nije uspio.');
    return false;
  }
}
export function DashboardPage({ admin = false }: { admin?: boolean }) {
  const q = useRows<Order>('orders');
  const payments = useRows<Payment>('payments');
  const files = useRows<OrderFile>('order_files');
  const data = q.data || [];
  const active = data.filter((o) => !['completed', 'cancelled', 'delivered'].includes(o.status));
  const focus = active[0] || data[0];
  return (
    <>
      <PageHeader
        title={admin ? 'Administracija' : 'Nadzorna ploča'}
        description={
          admin
            ? 'Pregled poslovanja, narudžbi, naplata i korisničke podrške.'
            : 'Pregled vaših narudžbi, uplata i aktivnosti na jednom mjestu.'
        }
        actions={
          <PageNote>
            {admin ? 'Sve što vam treba na jednom mjestu!' : 'Drago nam je vidjeti vas ponovno!'}
          </PageNote>
        }
      />
      <QueryState query={q}>
        <div className={`stat-grid ${admin ? 'admin-stats' : ''}`}>
          {admin && (
            <StatCard
              label="Nove narudžbe"
              value={
                data.filter((o) => new Date(o.created_at).getTime() > Date.now() - 7 * 86400000)
                  .length
              }
              description="U posljednjih 7 dana"
              icon={<ShoppingBag />}
            />
          )}
          <StatCard
            label="Aktivne narudžbe"
            value={active.length}
            description="Narudžbe u tijeku"
            icon={<FileText />}
          />
          <StatCard
            label="Čekaju uplatu"
            value={
              data.filter((o) => ['deposit_pending', 'final_pending'].includes(o.status)).length
            }
            description="Početnu ili završnu"
            icon={<Clock3 />}
            tone="orange"
          />
          <StatCard
            label="Potvrđeno naplaćeno"
            value={money(data.reduce((n, o) => n + o.paid_cents, 0))}
            description="Nakon evidentiranih povrata"
            icon={<CreditCard />}
            tone="green"
          />
          <StatCard
            label="Dostupne datoteke"
            value={
              files.isError
                ? 'Nedostupno'
                : files.isPending
                  ? '…'
                  : files.data?.filter((f) => {
                      const o = data.find((o) => o.id === f.order_id);
                      return (
                        f.scan_status === 'clean' &&
                        (admin ||
                          f.kind !== 'final' ||
                          Boolean(o && o.total_cents !== null && o.paid_cents >= o.total_cents))
                      );
                    }).length || 0
            }
            description="Provjerene i otključane"
            icon={<Folder />}
            tone="violet"
          />
        </div>
        {admin && <AdminDashboardExtras />}
        <div className="overview-grid">
          <section className="panel">
            <div className="panel-heading">
              <h2>{admin ? 'Najnovije narudžbe' : 'Moje narudžbe'}</h2>
              <Link to={`${admin ? '/admin' : '/app'}/narudzbe`}>
                Sve narudžbe <ArrowRight size={15} />
              </Link>
            </div>
            <OrderSummaryTable orders={data.slice(0, 5)} admin={admin} />
          </section>
          {admin ? (
            <RecentActivity />
          ) : (
            <section className="panel tracking-panel">
              <div className="panel-heading">
                <h2>Praćenje narudžbe</h2>
                {focus && (
                  <Link to={`/app/narudzbe/${focus.id}`}>
                    Detalji <ArrowRight size={15} />
                  </Link>
                )}
              </div>
              {focus ? (
                <>
                  <div className="tracking-order">
                    <span className="service-icon">
                      <FileText />
                    </span>
                    <div>
                      <h3>{focus.title}</h3>
                      <p>{focus.number}</p>
                    </div>
                  </div>
                  <OrderStageTimeline order={focus} />
                  <PaymentRemainder order={focus} />
                </>
              ) : (
                <EmptyState
                  title="Započnite prvi projekt"
                  description="Odaberite uslugu i pošaljite svoj zahtjev."
                  action={
                    <Button asChild>
                      <Link to="/app/nova-narudzba">
                        <Plus size={16} />
                        Nova narudžba
                      </Link>
                    </Button>
                  }
                />
              )}
            </section>
          )}
        </div>
        <div className="overview-lower">
          {admin ? (
            <QueryState query={payments}>
              <BusinessCharts orders={data} payments={payments.data || []} />
            </QueryState>
          ) : (
            <>
              <RecentMessages />
              <RecommendedServices />
            </>
          )}
        </div>
      </QueryState>
      {admin && (
        <p className="data-scope-note">
          Operativni pregled do 200 najnovijih zapisa. Naplate nisu računovodstveni prihod.{' '}
          {payments.isError
            ? 'Naplate trenutačno nisu dostupne.'
            : payments.data?.some((p) => p.fee_cents === null)
              ? 'Neke stvarne naknade još nisu dostupne.'
              : ''}
        </p>
      )}
    </>
  );
}
export function OrdersPage({ admin = false }: { admin?: boolean }) {
  const q = useRows<Order>('orders');
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const incomingSearch = searchParams.get('q') || '';
  useEffect(() => {
    setSearch(incomingSearch);
    setPage(1);
  }, [incomingSearch]);
  const [view, setView] = useState('table');
  const data = (q.data || []).filter(
    (o) =>
      (status === 'all' ||
        (status === 'payment_pending'
          ? ['deposit_pending', 'final_pending'].includes(o.status)
          : o.status === status)) &&
      `${o.number} ${o.title}`.toLocaleLowerCase('hr').includes(search.toLocaleLowerCase('hr')),
  );
  const shown = data.slice((page - 1) * 10, page * 10);
  return (
    <>
      <PageHeader
        title={admin ? 'Narudžbe' : 'Moje narudžbe'}
        description="Pratite dogovore i svaki korak do gotovog rada."
      />
      <div className="filter-bar">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Sve narudžbe</option>
            <option value="payment_pending">Sve koje čekaju uplatu</option>
            {Object.entries(statuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={() => setView(view === 'cards' ? 'table' : 'cards')}>
          {view === 'cards' ? 'Tablični prikaz' : 'Kartični prikaz'}
        </Button>
      </div>
      <div className="order-filter-pills">
        {[
          { label: 'Sve', match: 'all', count: q.data?.length || 0 },
          {
            label: 'U izradi',
            match: 'in_progress',
            count: q.data?.filter((o) => o.status === 'in_progress').length || 0,
          },
          {
            label: 'Čeka uplatu',
            match: 'payment_pending',
            count:
              q.data?.filter((o) => ['deposit_pending', 'final_pending'].includes(o.status))
                .length || 0,
          },
          {
            label: 'Završeno',
            match: 'completed',
            count: q.data?.filter((o) => o.status === 'completed').length || 0,
          },
        ].map((f) => (
          <button
            key={f.match}
            className={status === f.match ? 'active' : ''}
            onClick={() => {
              setStatus(f.match);
              setPage(1);
            }}
          >
            {f.label}
            <span>{q.isPending ? '…' : q.isError ? '—' : f.count}</span>
          </button>
        ))}
      </div>
      <QueryState query={q}>
        {shown.length ? (
          view === 'cards' ? (
            shown.map((o) => <OrderCard key={o.id} order={o} admin={admin} />)
          ) : (
            <OrderSummaryTable orders={shown} admin={admin} expandable />
          )
        ) : (
          <EmptyState title="Nema narudžbi za odabrani prikaz" />
        )}
      </QueryState>
      <div className="actions">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Prethodna
        </Button>
        <span>
          {page} / {Math.max(1, Math.ceil(data.length / 10))}
        </span>
        <Button
          variant="outline"
          disabled={page * 10 >= data.length}
          onClick={() => setPage(page + 1)}
        >
          Sljedeća
        </Button>
      </div>
    </>
  );
}
const steps = ['Usluga', 'Detalji', 'Datoteke', 'Rok', 'Opcije', 'Cijena', 'Plaćanje', 'Potvrda'];
export function NewOrderPage() {
  const services = useServices();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const key = `fp-draft:${session!.user.id}`;
  const [draft, setDraft] = useState(() => {
    try {
      return (
        JSON.parse(sessionStorage.getItem(key) || 'null') || {
          service: params.get('usluga') || '',
          title: '',
          description: '',
          quantity: 1,
          due: '',
          model: 'full',
          promo: '',
        }
      );
    } catch {
      return {
        service: '',
        title: '',
        description: '',
        quantity: 1,
        due: '',
        model: 'full',
        promo: '',
      };
    }
  });
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const s = services.data?.find((x) => x.slug === draft.service);
  const total = s?.price_cents == null ? null : s.price_cents * draft.quantity;
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(draft));
  }, [draft, key]);
  function set(k: string, v: unknown) {
    setDraft({ ...draft, [k]: v });
  }
  function next() {
    if (step === 0 && !s) {
      toast.error('Odaberite uslugu.');
      return;
    }
    if (step === 1 && (draft.title.trim().length < 3 || draft.description.trim().length < 10)) {
      toast.error('Unesite naslov (najmanje 3 znaka) i opis (najmanje 10 znakova).');
      return;
    }
    if (step === 3 && draft.due && new Date(draft.due) <= new Date()) {
      toast.error('Željeni rok mora biti u budućnosti.');
      return;
    }
    setStep(Math.min(7, step + 1));
  }
  async function submit() {
    if (!s || s.price_cents !== null) {
      toast.error('Artikle s cijenom dodajte u košaricu.');
      return;
    }
    setBusy(true);
    try {
      const id = await rpc<string>('create_order', {
        p_service: s.id,
        p_quantity: Number(draft.quantity),
        p_title: draft.title,
        p_description: draft.description,
        p_due: draft.due ? new Date(draft.due).toISOString() : null,
        p_model: draft.model,
        p_promo: draft.promo || null,
      });
      sessionStorage.removeItem(key);
      let failed = 0;
      for (const file of files) {
        const form = new FormData();
        form.set('order_id', id);
        form.set('file', file);
        const { error } = await requireDb().functions.invoke('upload', { body: form });
        if (error) failed++;
      }
      await cache.invalidateQueries({ queryKey: ['orders'] });
      if (failed)
        toast.error(
          'Narudžba je kreirana, ali dio datoteka nije prenesen. Dodajte ih u detaljima narudžbe.',
        );
      else toast.success('Narudžba je zaprimljena.');
      navigate(`/app/narudzbe/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Narudžba nije kreirana.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Zahtjev za individualnu ponudu"
        description="Recite nam što trebate. Dogovor počinje jasnim uputama."
      />
      <nav className="wizard-steps" aria-label="Koraci narudžbe">
        {steps.map((t, i) => (
          <span
            key={t}
            className={i === step ? 'active' : ''}
            aria-current={i === step ? 'step' : undefined}
          >
            {i + 1}. {t}
          </span>
        ))}
      </nav>
      <div className="panel">
        <h2>{steps[step]}</h2>
        {step === 0 && (
          <QueryState query={services}>
            <div className="stack">
              {services.data
                ?.filter((x) => x.price_cents === null)
                .map((x) => (
                  <button
                    key={x.id}
                    onClick={() =>
                      setDraft({ ...draft, service: x.slug, model: 'full', quantity: 1 })
                    }
                    className={`select-card ${s?.id === x.id ? 'selected' : ''}`}
                  >
                    <span className="service-icon">
                      <ServiceIcon name={x.icon} />
                    </span>
                    <div>
                      <h3>{x.name}</h3>
                      <p>{x.price_cents === null ? 'Prema ponudi' : money(x.price_cents)}</p>
                    </div>
                  </button>
                ))}
            </div>
          </QueryState>
        )}
        {step === 1 && (
          <div className="stack">
            <label>
              Naslov zadatka
              <input
                value={draft.title}
                maxLength={150}
                onChange={(e) => set('title', e.target.value)}
              />
            </label>
            <label>
              Detaljne upute
              <textarea
                value={draft.description}
                maxLength={10000}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Opišite opseg, željeni rezultat i važne napomene."
              />
            </label>
          </div>
        )}
        {step === 2 && (
          <>
            <FilePicker files={files} setFiles={setFiles} />
            <p>
              Datoteke se prenose nakon potvrde narudžbe i čekaju sigurnosnu provjeru. Nacrt ne čuva
              odabrane datoteke nakon zatvaranja stranice.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <label>
              Željeni rok (neobvezno)
              <input
                type="datetime-local"
                value={draft.due}
                onChange={(e) => set('due', e.target.value)}
              />
            </label>
            <p>Konačni rok potvrđuje se ponudom. Unesite svoje lokalno vrijeme.</p>
          </>
        )}
        {step === 4 && (
          <>
            <label>
              Količina
              <input
                type="number"
                min="1"
                max="100"
                value={draft.quantity}
                onChange={(e) =>
                  set('quantity', Math.min(100, Math.max(1, Number(e.target.value))))
                }
              />
            </label>
            <p>U ovoj verziji opseg i dodatne opcije dogovaraju se kroz opis i ponudu.</p>
          </>
        )}
        {step === 5 && (
          <>
            <StatCard
              label="Informativna cijena prije kupona"
              value={total === null ? 'Prema ponudi' : money(total)}
            />
            {total !== null && (
              <label>
                Promo kod (neobvezno)
                <input
                  value={draft.promo}
                  onChange={(e) => set('promo', e.target.value.toUpperCase())}
                />
              </label>
            )}
            <p>
              Konačni iznos izračunava poslužitelj pri kreiranju. Kupon se provjerava na
              poslužitelju; nevažeći kod zaustavlja narudžbu.
            </p>
          </>
        )}
        {step === 6 && (
          <>
            <label>
              Model plaćanja
              <select value={draft.model} onChange={(e) => set('model', e.target.value)}>
                <option value="full">100 % unaprijed</option>
                {s?.split_enabled && total !== null && total >= s.split_min_cents && (
                  <option value="split">50/50</option>
                )}
              </select>
            </label>
            {total !== null && (
              <div className="notice">
                <CreditCard />
                <p>
                  {draft.model === 'split'
                    ? installments(total, true)
                        .map((x, i) => `${i + 1}. uplata: ${money(x)}`)
                        .join(' · ')
                    : `Jednokratna uplata: ${money(total)}`}
                  . Iznosi su informativni prije provjere kupona.
                </p>
              </div>
            )}
            {total === null && (
              <p>Model plaćanja potvrđujete tek pri prihvaćanju individualne ponude.</p>
            )}
          </>
        )}
        {step === 7 && (
          <div className="stack">
            <h3>{draft.title}</h3>
            <p>
              {s?.name} · {draft.quantity} ×
            </p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{draft.description}</p>
            <p>
              {total === null
                ? 'Cijena i uvjeti nakon individualne ponude.'
                : `Informativno ${money(total)} prije kupona.`}
            </p>
            <p>Datoteke: {files.length}. Slanjem se ne izvršava uplata.</p>
          </div>
        )}
        <div className="actions">
          <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>
            Natrag
          </Button>
          {step < 7 ? (
            <Button onClick={next}>
              Nastavi <ArrowRight size={16} />
            </Button>
          ) : (
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? 'Slanje…' : 'Potvrdi narudžbu'}
            </Button>
          )}
        </div>
      </div>
      <small>Nacrt se čuva samo u ovoj sesiji preglednika.</small>
    </>
  );
}
export function FilePicker({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  return (
    <label>
      Dodaj datoteke · do 20 MB po datoteci
      <input
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length > 10 || list.some((f) => f.size > 20 * 1024 * 1024)) {
            toast.error('Najviše 10 datoteka, svaka do 20 MB.');
            return;
          }
          setFiles(list);
        }}
      />
      <span>{files.map((f) => f.name).join(', ')}</span>
    </label>
  );
}
export function OrderDetailPage({ admin = false }: { admin?: boolean }) {
  const { id } = useParams();
  const q = useRows<Order>('orders', { id: id! });
  const quotes = useRows<Quote>('quotes', { order_id: id! });
  const orderedItems = useRows<{
    id: string;
    name: string;
    quantity: number;
    unit_cents: number | null;
  }>('order_items', { order_id: id! }, 'name');
  const history = useRows<{ id: string; status: string; created_at: string }>(
    'order_status_history',
    { order_id: id! },
  );
  const cache = useQueryClient();
  const [model, setModel] = useState('full');
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [confirm, setConfirm] = useState<OrderStatus | null>(null);
  const order = q.data?.[0];
  useEffect(() => {
    if (admin || !order || ['completed', 'cancelled'].includes(order.status)) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void q.refetch();
      void cache.invalidateQueries({ queryKey: ['order_files'] });
    }, 15000);
    return () => clearInterval(timer);
  }, [admin, order?.id, order?.status, q.refetch, cache]);
  return (
    <QueryState query={q}>
      {!order ? (
        <EmptyState title="Narudžba nije pronađena" />
      ) : (
        <>
          <PageHeader
            eyebrow={order.number}
            title={order.title}
            description={`Kreirano ${localDate(order.created_at)}`}
            actions={<StatusBadge status={order.status} />}
          />
          {orderedItems.data && orderedItems.data.length > 0 && (
            <section className="panel">
              <h2>Naručeni artikli</h2>
              <ul className="checkout-summary-items">
                {orderedItems.data.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <strong>
                      {item.unit_cents === null
                        ? 'Prema ponudi'
                        : money(item.unit_cents * item.quantity)}
                    </strong>
                  </li>
                ))}
              </ul>
              <p>
                Iznosi stavki su prije popusta. Dogovoreni ukupni iznos uključuje odobreni popust.
              </p>
            </section>
          )}
          <div className="stat-grid">
            <StatCard
              label="Dogovoreni iznos"
              value={order.total_cents === null ? 'Prema ponudi' : money(order.total_cents)}
            />
            <StatCard label="Potvrđeno uplaćeno" value={money(order.paid_cents)} />
            <StatCard
              label="Preostalo"
              value={
                order.total_cents === null
                  ? 'Čeka ponudu'
                  : money(Math.max(0, order.total_cents - order.paid_cents))
              }
            />
            <StatCard
              label="Model plaćanja"
              value={order.payment_model === 'split' ? '50/50' : '100 %'}
            />
          </div>
          <div className="panel">
            <h2>Upute za izradu</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{order.description}</p>
            {order.due_at && <p>Željeni / dogovoreni rok: {localDate(order.due_at)}</p>}
            {order.cancellation_deadline_at && (
              <p>
                Ugovoreni rok za zahtjev za otkazivanje: {localDate(order.cancellation_deadline_at)}
              </p>
            )}
            {order.payment_model === 'split' && order.final_payment_due_at && (
              <p>Ugovoreni rok završne uplate: {localDate(order.final_payment_due_at)}</p>
            )}
            <OrderPayment order={order} admin={admin} />
            {order.checkout_details && (
              <dl className="checkout-details">
                {Object.entries({
                  guest_name: 'Kupac (gost)',
                  guest_email: 'Kontaktni e-mail gosta',
                  course: 'Predmet / područje',
                  school: 'Škola / fakultet',
                  mentor: 'Mentor',
                  student: 'Učenik / student',
                  year: 'Razred / godina',
                  place: 'Mjesto i datum',
                }).map(([key, label]) =>
                  order.checkout_details?.[key] ? (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{order.checkout_details[key]}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            )}
            <div className="actions">
              {admin &&
                transitions[order.status].map((s) => (
                  <Button variant="outline" key={s} onClick={() => setConfirm(s)}>
                    {statuses[s]}
                  </Button>
                ))}
              {admin && ['received', 'quote_pending', 'quote_sent'].includes(order.status) && (
                <Button onClick={() => setQuoteOpen(true)}>Izradi ponudu</Button>
              )}
            </div>
          </div>
          <QueryState query={quotes}>
            {quotes.data?.map((quote, index) => (
              <div className="panel" key={quote.id}>
                <span className="eyebrow">PONUDA · VERZIJA {quote.version}</span>
                <h2>{money(quote.total_cents)}</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{quote.description}</p>
                <p>Vrijedi do {localDate(quote.expires_at)}</p>
                {quote.accepted_at ? (
                  <StatusBadge status="ready" />
                ) : (
                  !admin &&
                  index === 0 &&
                  order.status === 'quote_sent' &&
                  new Date(quote.expires_at) > new Date() && (
                    <>
                      <label>
                        Model plaćanja
                        <select value={model} onChange={(e) => setModel(e.target.value)}>
                          <option value="full">100 %</option>
                          {quote.split_enabled && quote.total_cents >= 200 && (
                            <option value="split">50/50</option>
                          )}
                        </select>
                      </label>
                      <div className="actions">
                        <Button
                          onClick={() =>
                            void action(async () => {
                              await rpc('accept_quote', { p_quote: quote.id, p_model: model });
                              await cache.invalidateQueries();
                            })
                          }
                        >
                          Prihvati ponudu
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            void action(async () => {
                              await rpc('reject_quote', { p_quote: quote.id });
                              await cache.invalidateQueries();
                            })
                          }
                        >
                          Odbij ponudu
                        </Button>
                      </div>
                    </>
                  )
                )}
              </div>
            ))}
          </QueryState>
          <div className="split-columns">
            <div>
              <OrderFiles orderId={id!} admin={admin} />
              <div className="panel">
                <h2>Vremenska crta</h2>
                <QueryState query={history}>
                  <ol className="timeline">
                    {history.data?.map((h) => (
                      <li key={h.id}>
                        <p>{statuses[h.status as OrderStatus]}</p>
                        <small>{localDate(h.created_at)}</small>
                      </li>
                    ))}
                  </ol>
                </QueryState>
              </div>
            </div>
            <ConversationPanel orderId={id!} admin={admin} />
          </div>
          <ConfirmationDialog
            open={!!confirm}
            onOpenChange={() => setConfirm(null)}
            title="Promjena statusa"
          >
            <p>Promijeniti status u „{confirm && statuses[confirm]}”?</p>
            <Button
              onClick={() =>
                void action(async () => {
                  await rpc('transition_order', { p_order: id, p_status: confirm });
                  setConfirm(null);
                  await cache.invalidateQueries();
                })
              }
            >
              Potvrdi
            </Button>
          </ConfirmationDialog>
          <ConfirmationDialog
            open={quoteOpen}
            onOpenChange={setQuoteOpen}
            title="Nova verzija ponude"
          >
            <QuoteForm orderId={id!} done={() => setQuoteOpen(false)} />
          </ConfirmationDialog>
        </>
      )}
    </QueryState>
  );
}
function QuoteForm({ orderId, done }: { orderId: string; done: () => void }) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        const ok = await action(async () => {
          await rpc('create_quote', {
            p_order: orderId,
            p_description: f.get('description'),
            p_total: eurosToCents(String(f.get('price')), 100),
            p_expires: new Date(String(f.get('expires'))).toISOString(),
            p_due: new Date(String(f.get('due'))).toISOString(),
            p_split: f.get('split') === 'on',
          });
          await cache.invalidateQueries();
        });
        setBusy(false);
        if (ok) done();
      }}
    >
      <label>
        Opis i uvjeti
        <textarea name="description" required minLength={10} maxLength={10000} />
      </label>
      <label>
        Konačna cijena (€)
        <EuroInput name="price" required />
      </label>
      <label>
        Vrijedi do
        <input type="datetime-local" name="expires" required />
      </label>
      <label>
        Rok isporuke
        <input type="datetime-local" name="due" required />
      </label>
      <label className="checkbox">
        <input name="split" type="checkbox" />
        Omogući 50/50
      </label>
      <Button disabled={busy}>Spremi i pošalji ponudu</Button>
    </form>
  );
}
export function ConversationPanel({
  orderId,
  admin = false,
}: {
  orderId: string;
  admin?: boolean;
}) {
  const q = useRows<Message>('order_messages', { order_id: orderId });
  const { session } = useAuth();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  useEffect(() => {
    const db = requireDb();
    const channel = db
      .channel(`messages:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_messages',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          void cache.invalidateQueries({ queryKey: ['order_messages'] });
        },
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [orderId, cache]);
  return (
    <section className="panel">
      <h2>Razgovor o narudžbi</h2>
      <QueryState query={q}>
        {q.data?.length ? (
          [...q.data].reverse().map((m) => (
            <article
              key={m.id}
              className={`message ${m.sender_id === session?.user.id ? 'mine' : ''} ${m.internal ? 'internal' : ''}`}
            >
              <p>{m.body}</p>
              <small>
                {m.internal ? 'Interna bilješka · ' : ''}
                {localDate(m.created_at)}
              </small>
            </article>
          ))
        ) : (
          <EmptyState
            title="Započnite razgovor"
            description="Sve upute i dogovori ostaju povezani s narudžbom."
          />
        )}
      </QueryState>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await action(async () => {
            await rpc('send_message', { p_order: orderId, p_body: body, p_internal: internal });
            await cache.invalidateQueries({ queryKey: ['order_messages'] });
          }, 'Poruka je poslana.');
          if (ok) setBody('');
          setBusy(false);
        }}
      >
        <label>
          Vaša poruka
          <textarea
            required
            minLength={1}
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        {admin && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
            />
            Interna bilješka, vidljiva samo administraciji
          </label>
        )}
        <Button disabled={busy || !body.trim()}>
          <Send size={15} />
          Pošalji
        </Button>
      </form>
    </section>
  );
}
export function OrderFiles({ orderId, admin = false }: { orderId: string; admin?: boolean }) {
  const q = useRows<OrderFile>('order_files', { order_id: orderId });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  return (
    <section className="panel">
      <h2>Datoteke narudžbe</h2>
      <QueryState query={q}>
        {q.data?.length ? (
          <>
            {!admin && <WorkPreviewGallery files={q.data} />}
            {q.data
              .filter((file) => admin || file.kind !== 'preview' || file.scan_status !== 'clean')
              .map((f) => (
                <FileRow key={f.id} file={f} />
              ))}
          </>
        ) : (
          <EmptyState title="Još nema datoteka" />
        )}
      </QueryState>
      {admin ? (
        <WorkDeliveryUpload orderId={orderId} />
      ) : (
        <>
          <FilePicker files={files} setFiles={setFiles} />
          <Button
            className="actions"
            variant="outline"
            disabled={busy || !files.length}
            onClick={async () => {
              setBusy(true);
              const ok = await action(async () => {
                for (const file of files) {
                  const form = new FormData();
                  form.set('file', file);
                  form.set('order_id', orderId);
                  form.set('kind', 'attachment');
                  const { error } = await requireDb().functions.invoke('upload', { body: form });
                  if (error)
                    throw new Error(
                      'Prijenos nije uspio. Već prenesene datoteke prikazane su nakon osvježavanja.',
                    );
                }
                await cache.invalidateQueries({ queryKey: ['order_files'] });
              }, 'Datoteke čekaju sigurnosnu provjeru.');
              if (ok) setFiles([]);
              else await cache.invalidateQueries({ queryKey: ['order_files'] });
              setBusy(false);
            }}
          >
            <Upload size={15} />
            Prenesi datoteke
          </Button>
        </>
      )}
      <small>
        Datoteke su privatne. Preuzimanje je moguće tek nakon sigurnosne provjere i provjere uplate
        za završni rad.
      </small>
    </section>
  );
}
function FileRow({ file }: { file: OrderFile }) {
  const { role } = useAuth();
  const order = useRows<Order>('orders', { id: file.order_id });
  const payment = order.data?.[0];
  const locked =
    file.kind === 'final' &&
    role !== 'ADMIN' &&
    !(payment?.total_cents && payment.paid_cents >= payment.total_cents);
  const [previewUrl, setPreviewUrl] = useState('');
  const cache = useQueryClient();
  const [review, setReview] = useState(false);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('clean');
  return (
    <div className="file-row">
      <div>
        <strong>{file.name}</strong>
        <small>
          {Math.ceil(file.size / 1024)} KB ·{' '}
          {file.kind === 'final' ? 'Završni rad' : file.kind === 'preview' ? 'Pregled' : 'Privitak'}{' '}
          · {localDate(file.created_at)}
        </small>
        <StatusBadge status={file.scan_status} />
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={file.scan_status !== 'clean' || locked}
        onClick={() =>
          void action(
            async () => {
              const result = await invoke<{ url: string }>('download', {
                file_id: file.id,
                ...(file.kind === 'preview' ? { action: 'preview' } : {}),
              });
              const url = new URL(result.url);
              if (
                url.protocol !== 'https:' &&
                url.hostname !== 'localhost' &&
                url.hostname !== '127.0.0.1'
              )
                throw new Error('Neispravna adresa.');
              if (file.kind === 'preview') setPreviewUrl(result.url);
              else window.open(result.url, '_blank', 'noopener,noreferrer');
            },
            file.kind === 'preview' ? 'Otvaranje pregleda…' : 'Preuzimanje je odobreno.',
          )
        }
      >
        <Download size={14} />
        {file.kind === 'preview'
          ? 'Pregledaj rad'
          : locked
            ? 'Zaključano do cijele uplate'
            : 'Preuzmi'}
      </Button>
      <ConfirmationDialog
        open={!!previewUrl}
        onOpenChange={(value) => {
          if (!value) setPreviewUrl('');
        }}
        title={`Pregled rada: ${file.name}`}
      >
        {previewUrl && <WorkPreview url={previewUrl} file={file} />}
      </ConfirmationDialog>
      {role === 'ADMIN' && (
        <>
          <Button variant="ghost" size="sm" onClick={() => setReview(true)}>
            Sigurnosna provjera
          </Button>
          <ConfirmationDialog
            open={review}
            onOpenChange={setReview}
            title="Evidentiraj sigurnosnu provjeru"
          >
            <p>
              Automatski antivirus nije povezan. Označite datoteku sigurnom tek nakon stvarne
              provjere odgovarajućim alatom.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await action(async () => {
                  await rpc('mark_file_scanned', {
                    p_file: file.id,
                    p_status: status,
                    p_reason: reason,
                  });
                  setReview(false);
                  await cache.invalidateQueries({ queryKey: ['order_files'] });
                });
              }}
            >
              <label>
                Rezultat
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="clean">Provjereno i dopušteno</option>
                  <option value="rejected">Odbijeno</option>
                </select>
              </label>
              <label>
                Alat, rezultat i obrazloženje
                <textarea
                  required
                  minLength={10}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button>Spremi u audit zapis</Button>
            </form>
          </ConfirmationDialog>
        </>
      )}
    </div>
  );
}
export function FilesPage() {
  const q = useRows<OrderFile>('order_files');
  return (
    <>
      <PageHeader
        title="Datoteke"
        description="Vaši privatni privici, pregledi i završni radovi."
      />
      <div className="panel">
        <QueryState query={q}>
          {q.data?.length ? (
            q.data.map((f) => <FileRow key={f.id} file={f} />)
          ) : (
            <EmptyState
              title="Još nema datoteka"
              description="Datoteke dodajete unutar pojedine narudžbe."
            />
          )}
        </QueryState>
      </div>
    </>
  );
}
export function PaymentsPage({ admin = false }: { admin?: boolean }) {
  const q = useRows<Payment>('payments');
  const orders = useRows<Order>('orders');
  const pending =
    orders.data?.filter((o) => ['deposit_pending', 'final_pending'].includes(o.status)) || [];
  const splitOrder = orders.data?.find(
    (o) => o.payment_model === 'split' && !['cancelled', 'completed'].includes(o.status),
  );
  const [search, setSearch] = useState('');
  const rows = (q.data || []).filter((p) =>
    `${p.status} ${p.provider} ${p.order_id}`.includes(search),
  );
  function csv() {
    const cell = (v: unknown) =>
      `"${String(v ?? '')
        .replace(/"/g, '""')
        .replace(/^[=+@-]/, "'$&")}"`;
    const text =
      '\uFEFF' +
      [
        [
          'ID',
          'Narudžba',
          'Bruto (EUR)',
          'Refundirano (EUR)',
          'Naknada (EUR)',
          'Status',
          'Pružatelj',
          'Vrijeme',
        ],
        ...rows.map((p) => [
          p.id,
          p.order_id,
          centsToEuroInput(p.amount_cents),
          centsToEuroInput(p.refunded_cents),
          centsToEuroInput(p.fee_cents),
          p.status,
          p.provider,
          p.created_at,
        ]),
      ]
        .map((r) => r.map(cell).join(';'))
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formapoint-transakcije.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <PageHeader
        title="Plaćanja"
        description="Potvrđene transakcije, povrati i stvarne naknade pružatelja."
        actions={
          admin && (
            <Button variant="outline" onClick={csv}>
              <Download size={16} />
              Izvoz CSV
            </Button>
          )
        }
      />
      <QueryState query={q}>
        <div className="stat-grid">
          <StatCard
            label="Ukupno potvrđeno uplaćeno"
            value={money(
              (q.data || [])
                .filter((p) => ['succeeded', 'refunded', 'partially_refunded'].includes(p.status))
                .reduce((n, p) => n + p.amount_cents - p.refunded_cents, 0),
            )}
            icon={<CreditCard />}
            tone="green"
            description="Nakon evidentiranih povrata"
          />
          <StatCard
            label="Transakcije na čekanju"
            value={q.data?.filter((p) => p.status === 'pending').length || 0}
            icon={<Clock3 />}
            tone="orange"
            description="Čekaju potvrdu pružatelja"
          />
          <StatCard
            label="Preostalo za uplatu"
            value={
              orders.isError
                ? 'Nedostupno'
                : orders.isPending
                  ? '…'
                  : money(
                      pending.reduce(
                        (n, o) => n + Math.max(0, (o.total_cents || 0) - o.paid_cents),
                        0,
                      ),
                    )
            }
            icon={<Folder />}
            tone="violet"
            description="Za narudžbe koje čekaju uplatu"
          />
          <StatCard
            label="Potvrđene transakcije"
            value={
              q.data?.filter((p) =>
                ['succeeded', 'refunded', 'partially_refunded'].includes(p.status),
              ).length || 0
            }
            icon={<FileText />}
            description="Stvarno evidentirani zapisi"
          />
        </div>
      </QueryState>
      <div className="payments-overview">
        <div className="panel">
          <PaymentMethods compact />
        </div>
        <section className="panel">
          <h2>Iznos za uplatu</h2>
          <QueryState query={orders}>
            {pending[0] ? (
              <>
                <p>{pending[0].number}</p>
                <strong className="amount-due">
                  {money(Math.max(0, (pending[0].total_cents || 0) - pending[0].paid_cents))}
                </strong>
                <PaymentRemainder order={pending[0]} admin={admin} />
              </>
            ) : (
              <EmptyState title="Nema narudžbi koje čekaju uplatu" />
            )}
          </QueryState>
        </section>
      </div>
      <section className="panel installments-panel">
        <div className="panel-heading">
          <h2>Plaćanje na rate 50/50</h2>
          <span className="service-icon">
            <Gift size={24} />
          </span>
        </div>
        <QueryState query={orders}>
          {splitOrder ? (
            <>
              <h3>{splitOrder.title}</h3>
              <OrderStageTimeline order={splitOrder} />
              <PaymentRemainder order={splitOrder} admin={admin} />
            </>
          ) : (
            <EmptyState
              title="Nema aktivnih narudžbi s modelom 50/50"
              description="Opcija je dostupna za usluge i ponude koje je podržavaju."
            />
          )}
        </QueryState>
      </section>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Filtriraj status, narudžbu ili pružatelja"
      />
      <div className="panel">
        <h2>Povijest transakcija</h2>
        <QueryState query={q}>
          {rows.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Narudžba</th>
                    <th>Bruto</th>
                    <th>Povrat</th>
                    <th>Naknada</th>
                    <th>Neto nakon naknade i povrata</th>
                    <th>Status</th>
                    <th>Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`${admin ? '/admin' : '/app'}/narudzbe/${p.order_id}`}>
                          {p.order_id.slice(0, 8)} · {p.provider}
                        </Link>
                      </td>
                      <td>{money(p.amount_cents)}</td>
                      <td>{money(p.refunded_cents)}</td>
                      <td>{p.fee_cents === null ? 'Nije dostupna' : money(p.fee_cents)}</td>
                      <td>
                        {p.fee_cents === null
                          ? 'Nije dostupno'
                          : money(p.amount_cents - p.refunded_cents - p.fee_cents)}
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td>{localDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nema transakcija"
              description="Ovdje se prikazuju stvarne evidentirane transakcije. Povratak s naplate sam po sebi ne potvrđuje uplatu."
            />
          )}
        </QueryState>
      </div>
    </>
  );
}
export function NotificationsPage() {
  const q = useRows<{
    id: string;
    title: string;
    body: string;
    read_at: string | null;
    created_at: string;
  }>('notifications');
  const cache = useQueryClient();
  return (
    <>
      <PageHeader title="Obavijesti" />
      <QueryState query={q}>
        {q.data?.length ? (
          q.data.map((n) => (
            <article className="panel" key={n.id}>
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <small>{localDate(n.created_at)}</small>
              {!n.read_at && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    void action(async () => {
                      const { error } = await requireDb()
                        .from('notifications')
                        .update({ read_at: new Date().toISOString() })
                        .eq('id', n.id);
                      if (error) throw error;
                      await cache.invalidateQueries({ queryKey: ['notifications'] });
                    })
                  }
                >
                  Označi kao pročitano
                </Button>
              )}
            </article>
          ))
        ) : (
          <EmptyState
            title="Sve je pod kontrolom"
            description="Trenutačno nema novih obavijesti."
          />
        )}
      </QueryState>
    </>
  );
}
export function ProfilePage({ embedded = false }: { embedded?: boolean }) {
  const { session } = useAuth();
  const q = useRows<{
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    marketing_consent: boolean;
  }>('profiles', { id: session!.user.id });
  const cache = useQueryClient();
  return (
    <>
      <PageHeader title="Moj profil" embedded={embedded} />
      <QueryState query={q}>
        {q.data?.[0] && (
          <form
            className="panel"
            key={q.data[0].id}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await action(async () => {
                const { error } = await requireDb()
                  .from('profiles')
                  .update({
                    first_name: String(f.get('first')).trim(),
                    last_name: String(f.get('last')).trim(),
                    phone: String(f.get('phone')).trim() || null,
                    marketing_consent: f.get('marketing') === 'on',
                  })
                  .eq('id', session!.user.id);
                if (error) throw error;
                await cache.invalidateQueries({ queryKey: ['profiles'] });
              });
            }}
          >
            <div className="form-row">
              <label>
                Ime
                <input name="first" required maxLength={150} defaultValue={q.data[0].first_name} />
              </label>
              <label>
                Prezime
                <input name="last" required maxLength={150} defaultValue={q.data[0].last_name} />
              </label>
            </div>
            <label>
              Telefon
              <input name="phone" type="tel" maxLength={40} defaultValue={q.data[0].phone || ''} />
            </label>
            <label className="checkbox">
              <input
                name="marketing"
                type="checkbox"
                defaultChecked={q.data[0].marketing_consent}
              />
              Želim novosti i ponude.
            </label>
            <Button>Spremi profil</Button>
          </form>
        )}
      </QueryState>
      <div className="panel">
        <h2>Sigurnost i osobni podaci</h2>
        <p>
          {session?.user.is_anonymous
            ? 'Kupujete kao gost. Izradite račun za pristup svojim narudžbama i s drugih uređaja.'
            : `E-mail računa: ${session?.user.email}`}
        </p>
        <div className="actions">
          <Button asChild variant="outline">
            <Link to={session?.user.is_anonymous ? '/registracija' : '/zaboravljena-lozinka'}>
              {session?.user.is_anonymous
                ? 'Izradi račun i sačuvaj narudžbe'
                : 'Promijeni lozinku putem e-pošte'}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/podrska">Zatraži izvoz ili brisanje podataka</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
export function SettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { session } = useAuth();
  const q = useRows<{ user_id: string; email_enabled: boolean }>('notification_preferences', {
    user_id: session!.user.id,
  });
  const cache = useQueryClient();
  return (
    <>
      <PageHeader
        title="Postavke"
        description="Upravljajte e-mail obavijestima."
        embedded={embedded}
      />
      <QueryState query={q}>
        <div className="panel">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={q.data?.[0]?.email_enabled ?? true}
              onChange={(e) =>
                void action(async () => {
                  const { error } = await requireDb()
                    .from('notification_preferences')
                    .upsert({ user_id: session!.user.id, email_enabled: e.target.checked });
                  if (error) throw error;
                  await cache.invalidateQueries({ queryKey: ['notification_preferences'] });
                })
              }
            />
            Želim primati obavijesti o narudžbama putem e-pošte.
          </label>
          <p>Sigurnosne poruke i potvrde prijave šalje Supabase Auth neovisno o ovoj postavci.</p>
        </div>
      </QueryState>
    </>
  );
}
export function SupportPage({ admin = false }: { admin?: boolean }) {
  const q = useRows<{
    id: string;
    subject: string;
    category: string;
    body: string;
    status: string;
    created_at: string;
  }>('support_tickets');
  const [selected, setSelected] = useState('');
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader
        title="Podrška"
        description="Pošaljite upit ili pratite odgovore na postojeće zahtjeve."
      />
      {!admin && (
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            setBusy(true);
            const ok = await action(async () => {
              await rpc('open_ticket', {
                p_subject: f.get('subject'),
                p_category: f.get('category'),
                p_body: f.get('body'),
              });
              await cache.invalidateQueries({ queryKey: ['support_tickets'] });
            }, 'Zahtjev je zaprimljen.');
            setBusy(false);
            if (ok) form.reset();
          }}
        >
          <label>
            Predmet
            <input name="subject" minLength={3} maxLength={150} required />
          </label>
          <label>
            Kategorija
            <select name="category">
              {[
                'Narudžbe',
                'Plaćanja',
                'Datoteke',
                'Tehnički problem',
                'Povrat novca',
                'Ostalo',
                'Izvoz podataka',
                'Brisanje računa',
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Vaša poruka
            <textarea name="body" minLength={10} maxLength={10000} required />
          </label>
          <Button disabled={busy}>Pošalji zahtjev</Button>
        </form>
      )}
      <QueryState query={q}>
        {q.data?.length ? (
          q.data.map((t) => (
            <article className="panel" key={t.id}>
              <div className="section-title">
                <h3>{t.subject}</h3>
                <StatusBadge status={t.status} />
              </div>
              <p>{t.body}</p>
              <small>
                {t.category} · {localDate(t.created_at)}
              </small>
              <div>
                <Button variant="ghost" onClick={() => setSelected(selected === t.id ? '' : t.id)}>
                  Otvori razgovor
                </Button>
              </div>
              {selected === t.id && <SupportConversation ticketId={t.id} admin={admin} />}
            </article>
          ))
        ) : (
          <EmptyState title="Nema otvorenih zahtjeva" />
        )}
      </QueryState>
    </>
  );
}
function SupportConversation({ ticketId, admin }: { ticketId: string; admin: boolean }) {
  const q = useRows<{ id: string; body: string; created_at: string }>('support_messages', {
    ticket_id: ticketId,
  });
  const [body, setBody] = useState('');
  const cache = useQueryClient();
  return (
    <>
      <QueryState query={q}>
        {q.data?.map((m) => (
          <div className="message" key={m.id}>
            <p>{m.body}</p>
            <small>{localDate(m.created_at)}</small>
          </div>
        ))}
      </QueryState>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await action(async () => {
            await rpc('reply_ticket', { p_ticket: ticketId, p_body: body, p_close: false });
            await cache.invalidateQueries({ queryKey: ['support_messages'] });
          });
          if (ok) setBody('');
        }}
      >
        <label>
          Odgovor
          <textarea
            required
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div className="actions">
          <Button>Pošalji odgovor</Button>
          {admin && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void action(async () => {
                  await rpc('reply_ticket', {
                    p_ticket: ticketId,
                    p_body: 'Zahtjev je zatvoren.',
                    p_close: true,
                  });
                  await cache.invalidateQueries();
                })
              }
            >
              Zatvori zahtjev
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
export function ContactPage() {
  const site = useSiteSettings();
  const provider = usePublishedPage('podaci-pruzatelja');
  const email = site.data?.public_contact_email;
  const phone = site.data?.contact_phone;
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div className="container section">
      <PageHeader
        eyebrow="TU SMO ZA VAS"
        title="Razgovarajmo o vašem zadatku."
        description="Pošaljite pitanje ili opišite ideju. Nemojte slati lozinke ni osjetljive dokumente ovim obrascem."
      />
      <div className="contact-grid">
        <div>
          <h2>Prvi korak je jednostavan.</h2>
          <p>
            Za konkretan zadatak koristite narudžbu kako biste upute, datoteke i komunikaciju
            pratili na jednom mjestu.
          </p>
          <Button asChild variant="outline">
            <Link to="/app/nova-narudzba">
              Zatraži uslugu <ArrowRight size={16} />
            </Link>
          </Button>
          {email || phone || provider.data ? (
            <section className="panel contact-provider">
              <h3>Pružatelj usluge i kontakt</h3>
              {provider.data && <p className="prose-text">{provider.data.content}</p>}
              <dl className="checkout-details">
                {email && (
                  <div>
                    <dt>E-mail i pisani prigovori</dt>
                    <dd>
                      <a href={`mailto:${email}`}>{email}</a>
                    </dd>
                  </div>
                )}
                {phone && (
                  <div>
                    <dt>Telefon</dt>
                    <dd>
                      <a href={`tel:${phone.replace(/[^+\d]/g, '').replace(/^0/, '+385')}`}>
                        {phone}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          ) : (
            <p>Za pitanja i pisane prigovore možete upotrijebiti kontaktni obrazac.</p>
          )}
        </div>
        {!configured ? (
          <Unavailable>
            Kontaktni obrazac nije dostupan dok se ne poveže Supabase i objavi kontaktna funkcija.
          </Unavailable>
        ) : sent ? (
          <EmptyState
            title="Poruka je zaprimljena"
            description="Vaš upit spremljen je za obradu."
          />
        ) : (
          <form
            className="panel"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              const ok = await action(
                () =>
                  invoke('contact', {
                    name: f.get('name'),
                    email: f.get('email'),
                    body: f.get('body'),
                    website: f.get('website'),
                  }),
                'Upit je zaprimljen.',
              );
              setSent(ok);
              setBusy(false);
            }}
          >
            <label>
              Ime i prezime
              <input name="name" required minLength={2} maxLength={150} />
            </label>
            <label>
              E-mail
              <input type="email" name="email" required />
            </label>
            <label>
              Poruka
              <textarea name="body" required minLength={10} maxLength={5000} />
            </label>
            <label className="sr-only" aria-hidden="true">
              Web stranica
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <p>
              Podaci se koriste za obradu upita. Pročitajte{' '}
              <Link to="/pravila-privatnosti">pravila privatnosti</Link>.
            </p>
            <Button disabled={busy}>Pošalji upit</Button>
          </form>
        )}
      </div>
    </div>
  );
}
export function MessagesPage({ admin = false }: { admin?: boolean }) {
  const { id } = useParams();
  const q = useRows<Order>('orders');
  if (id) return <ConversationPanel orderId={id} admin={admin} />;
  return (
    <>
      <PageHeader title="Poruke" description="Svaka narudžba ima zaseban razgovor." />
      <QueryState query={q}>
        {q.data?.length ? (
          q.data.map((o) => (
            <Link
              className="order-card"
              key={o.id}
              to={`${admin ? '/admin' : '/app'}/poruke/${o.id}`}
            >
              <div>
                <h3>{o.title}</h3>
                <p>{o.number}</p>
              </div>
              <ArrowRight size={16} />
            </Link>
          ))
        ) : (
          <EmptyState
            title="Još nema razgovora"
            description="Razgovor se otvara uz vašu narudžbu."
          />
        )}
      </QueryState>
    </>
  );
}
export function ServiceEditor({
  service,
  done,
  initialCategory,
}: {
  service?: Service;
  done: () => void;
  initialCategory?: string;
}) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const categories = useRows<{ id: string; name: string }>('service_categories');
  const [category, setCategory] = useState(service?.category || initialCategory || 'Ostalo');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setFormError('');
        try {
          const fields = {
            name: String(f.get('name')),
            slug: String(f.get('slug')),
            description: String(f.get('description')),
            category: String(f.get('category')),
            icon: String(f.get('icon')),
            price_cents: String(f.get('price') || '').trim()
              ? eurosToCents(String(f.get('price')), 100)
              : null,
            delivery_days: Number(f.get('days')),
            revisions: Number(f.get('revisions')),
            split_enabled: f.get('split') === 'on',
            split_min_cents: eurosToCents(String(f.get('min')), 200),
            active: f.get('active') === 'on',
            included: String(f.get('included')).split('\n').filter(Boolean),
            excluded: String(f.get('excluded')).split('\n').filter(Boolean),
          };
          const savedSlug = await saveCatalogService(requireDb(), fields, service?.id);
          await cache.invalidateQueries({ queryKey: ['services'] });
          toast.success(
            savedSlug !== fields.slug
              ? `Artikl je spremljen. Njegova oznaka u URL-u je ${savedSlug}.`
              : 'Artikl je spremljen.',
          );
          done();
        } catch (error) {
          const message = catalogError(error);
          setFormError(message);
          toast.error(message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Naziv
        <input name="name" required maxLength={150} defaultValue={service?.name} />
      </label>
      <label>
        Slug
        <input
          name="slug"
          pattern="[a-z0-9-]+"
          required
          defaultValue={service?.slug}
          aria-describedby={!service ? 'service-slug-help' : undefined}
        />
      </label>
      {!service && (
        <small id="service-slug-help">
          Ako je oznaka zauzeta, automatski se dodaje naziv kategorije.
        </small>
      )}
      <label>
        <span id="service-category-label">Kategorija</span>
        <select
          aria-labelledby="service-category-label"
          name="category"
          required
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={categories.isPending || categories.isError}
        >
          <option value="">Odaberite kategoriju</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ikona
        <select name="icon" defaultValue={service?.icon || 'FileText'}>
          {['FileText', 'Presentation', 'Table2', 'Files', 'Mail', 'LayoutGrid', 'Sparkles'].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>
      </label>
      <label>
        Opis
        <textarea name="description" required defaultValue={service?.description} />
      </label>
      <label>
        Uključeno (jedna stavka po retku)
        <textarea name="included" defaultValue={service?.included.join('\n')} />
      </label>
      <label>
        Nije uključeno (jedna stavka po retku)
        <textarea name="excluded" defaultValue={service?.excluded.join('\n')} />
      </label>
      <label>
        Cijena (€; prazno za individualnu ponudu)
        <EuroInput name="price" defaultCents={service?.price_cents} />
      </label>
      <div className="form-row">
        <label>
          Okvirni rok u danima
          <input
            type="number"
            name="days"
            min={0}
            required
            defaultValue={service?.delivery_days || 0}
          />
        </label>
        <label>
          Broj revizija
          <input
            name="revisions"
            type="number"
            min={0}
            required
            defaultValue={service?.revisions ?? 1}
          />
        </label>
      </div>
      <label className="checkbox">
        <input type="checkbox" name="split" defaultChecked={service?.split_enabled} />
        Dopusti 50/50
      </label>
      <label>
        Minimalni iznos za 50/50 (€)
        <EuroInput name="min" defaultCents={service?.split_min_cents ?? 10000} required />
      </label>
      <label className="checkbox">
        <input name="active" type="checkbox" defaultChecked={service?.active ?? true} />
        Aktivna usluga
      </label>
      {formError && (
        <p role="alert" className="field-error">
          {formError}
        </p>
      )}
      {categories.isError && (
        <p role="alert">
          Kategorije nije moguće učitati.{' '}
          <button type="button" onClick={() => void categories.refetch()}>
            Pokušaj ponovno
          </button>
        </p>
      )}
      <Button disabled={busy || categories.isPending || categories.isError}>Spremi uslugu</Button>
    </form>
  );
}
