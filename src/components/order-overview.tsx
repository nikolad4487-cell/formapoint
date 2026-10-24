import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  FileText,
  ArrowRight,
  Folder,
  MessagesSquare,
  Clock3,
} from 'lucide-react';
import type { Order } from '../lib/domain';
import { statuses } from '../lib/domain';
import { money, localDate } from '../lib/utils';
import { StatusBadge, EmptyState } from './common';
import { Button } from './ui/button';
export function orderStage(order: Order) {
  if (order.status === 'cancelled') return -1;
  if (['delivered', 'completed'].includes(order.status)) return 3;
  if (
    ['ready', 'in_progress', 'needs_info', 'work_done', 'final_pending', 'revision'].includes(
      order.status,
    )
  )
    return 2;
  if (order.status === 'deposit_pending') return 1;
  return 0;
}
export function OrderStageTimeline({ order }: { order: Order }) {
  const stage = orderStage(order);
  if (stage < 0) return <p>Narudžba je otkazana.</p>;
  const labels = ['Zahtjev i ponuda', 'Potvrda uplate', 'Izrada', 'Isporuka'];
  return (
    <>
      <ol className="order-stage-timeline" aria-label="Faze narudžbe">
        {labels.map((label, i) => (
          <li
            key={label}
            className={i < stage ? 'done' : i === stage ? 'current' : ''}
            aria-current={i === stage ? 'step' : undefined}
          >
            <span>{i < stage ? <Check size={17} /> : i + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
      <p className="stage-caption">
        <Clock3 size={14} />
        {statuses[order.status]}
      </p>
    </>
  );
}
export function PaymentRemainder({ order, admin = false }: { order: Order; admin?: boolean }) {
  const due = order.total_cents === null ? null : Math.max(0, order.total_cents - order.paid_cents);
  return (
    <div className="payment-remainder">
      <span>
        <CreditSymbol />
        <strong>
          {due === null
            ? 'Čeka ponudu'
            : due === 0
              ? 'Uplata potvrđena'
              : `Preostali iznos: ${money(due)}`}
        </strong>
        <small>
          {order.paid_cents > 0
            ? `Potvrđeno uplaćeno ${money(order.paid_cents)}`
            : 'Uvjeti plaćanja u detaljima narudžbe.'}
        </small>
      </span>
      <Button asChild size="sm">
        <Link to={`${admin ? '/admin' : '/app'}/narudzbe/${order.id}`}>
          {!admin && ['deposit_pending', 'final_pending'].includes(order.status)
            ? 'Pregledaj uplatu'
            : 'Pogledaj detalje'}
          <ArrowRight size={14} />
        </Link>
      </Button>
    </div>
  );
}
function CreditSymbol() {
  return <span className="remainder-symbol">€</span>;
}
export function OrderSummaryTable({
  orders,
  admin = false,
  expandable = false,
}: {
  orders: Order[];
  admin?: boolean;
  expandable?: boolean;
}) {
  const base = admin ? '/admin' : '/app';
  if (!orders.length)
    return (
      <EmptyState
        title="Nema narudžbi za odabrani prikaz"
        description="Nove narudžbe i dogovori prikazat će se ovdje."
      />
    );
  return (
    <div className={`order-register ${expandable ? 'expandable' : ''}`}>
      <div className="order-register-head" aria-hidden="true">
        <span>Usluga / zadatak</span>
        <span>Broj narudžbe</span>
        <span>Status</span>
        <span>Faza</span>
        <span>Iznos</span>
        <span />
      </div>
      {orders.map((o) => (
        <details className="order-register-row" key={o.id} open={expandable ? undefined : false}>
          <summary>
            <span className="register-service">
              <span className="service-icon">
                <FileText size={23} />
              </span>
              <span>
                <strong>{o.title}</strong>
                <small>{localDate(o.created_at)}</small>
              </span>
            </span>
            <span className="register-number">{o.number}</span>
            <span>
              <StatusBadge status={o.status} />
            </span>
            <span
              className="phase-indicator"
              aria-label={o.status === 'cancelled' ? 'Otkazano' : `Faza ${orderStage(o) + 1} od 4`}
            >
              {[0, 1, 2, 3].map((n) => (
                <i className={n <= orderStage(o) ? 'filled' : ''} key={n} />
              ))}
            </span>
            <strong className="register-amount">
              {o.total_cents === null ? 'Prema ponudi' : money(o.total_cents)}
            </strong>
            <ChevronDown size={17} />
          </summary>
          <div className="order-expanded">
            <section>
              <h3>Detalji narudžbe</h3>
              <dl>
                <dt>Broj</dt>
                <dd>{o.number}</dd>
                <dt>Model</dt>
                <dd>{o.payment_model === 'split' ? '50/50' : '100 %'}</dd>
                <dt>Rok</dt>
                <dd>{o.due_at ? localDate(o.due_at) : 'Prema dogovoru'}</dd>
                <dt>Uplaćeno</dt>
                <dd>{money(o.paid_cents)}</dd>
              </dl>
              <p>{o.description}</p>
              <Link className="text-link" to={`${base}/narudzbe/${o.id}`}>
                Otvori narudžbu <ArrowRight size={14} />
              </Link>
            </section>
            <section>
              <h3>Praćenje narudžbe</h3>
              <OrderStageTimeline order={o} />
              <PaymentRemainder order={o} admin={admin} />
            </section>
            <section>
              <h3>Dokumenti i komunikacija</h3>
              <p>Otvorite privatne datoteke i sve dogovore povezane s ovom narudžbom.</p>
              <Link className="order-action-link" to={`${base}/poruke/${o.id}`}>
                <MessagesSquare size={18} />
                Otvori razgovor <ArrowRight size={14} />
              </Link>
              <Link className="order-action-link" to={`${base}/narudzbe/${o.id}`}>
                <Folder size={18} />
                Datoteke narudžbe <ArrowRight size={14} />
              </Link>
            </section>
          </div>
        </details>
      ))}
    </div>
  );
}
