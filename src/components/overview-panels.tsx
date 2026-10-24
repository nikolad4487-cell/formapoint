import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, MessageSquare } from 'lucide-react';
import type { Order, Payment, Message } from '../lib/domain';
import { useRows, useServices } from '../hooks/use-data';
import { EmptyState, ErrorState, LoadingSkeleton, ServiceCard } from './common';
import { localDate, money } from '../lib/utils';
export function RecentMessages({ admin = false }: { admin?: boolean }) {
  const q = useRows<Message>('order_messages');
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Nedavne poruke</h2>
        <Link to={`${admin ? '/admin' : '/app'}/poruke`}>
          Sve poruke <ArrowRight size={15} />
        </Link>
      </div>
      {q.isPending ? (
        <LoadingSkeleton />
      ) : q.isError ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data?.length ? (
        q.data.slice(0, 3).map((m) => (
          <Link
            key={m.id}
            className="recent-message"
            to={`${admin ? '/admin' : '/app'}/poruke/${m.order_id}`}
          >
            <span className="message-avatar">
              <MessageSquare size={20} />
            </span>
            <div>
              <strong>{m.internal ? 'Interna bilješka' : 'Poruka o narudžbi'}</strong>
              <p>{m.body}</p>
              <small>{localDate(m.created_at)}</small>
            </div>
            <ArrowRight size={15} />
          </Link>
        ))
      ) : (
        <EmptyState
          title="Još nema poruka"
          description="Razgovori o vašim narudžbama pojavit će se ovdje."
        />
      )}
    </section>
  );
}
export function RecommendedServices() {
  const q = useServices();
  return (
    <section className="panel recommended-services">
      <div className="panel-heading">
        <h2>Preporučene usluge</h2>
        <Link to="/usluge">
          Sve usluge <ArrowRight size={15} />
        </Link>
      </div>
      {q.isPending ? (
        <LoadingSkeleton />
      ) : q.isError ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : (
        <div className="service-grid">
          {q.data?.slice(0, 3).map((s) => (
            <ServiceCard service={s} key={s.id} />
          ))}
        </div>
      )}
    </section>
  );
}
export function RecentActivity() {
  const q = useRows<{ id: string; action: string; created_at: string }>('audit_logs');
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Nedavna aktivnost</h2>
        <Link to="/admin/audit-log">
          Sve aktivnosti <ArrowRight size={15} />
        </Link>
      </div>
      {q.isPending ? (
        <LoadingSkeleton />
      ) : q.isError ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data?.length ? (
        q.data.slice(0, 5).map((a) => (
          <div key={a.id} className="recent-message">
            <span className="message-avatar">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <strong>{a.action}</strong>
              <small>{localDate(a.created_at)}</small>
            </div>
          </div>
        ))
      ) : (
        <EmptyState title="Još nema aktivnosti" />
      )}
    </section>
  );
}
export function BusinessCharts({ orders, payments }: { orders: Order[]; payments: Payment[] }) {
  const months = new Map<string, number>();
  for (const p of payments.filter((p) =>
    ['succeeded', 'refunded', 'partially_refunded'].includes(p.status),
  )) {
    const month = new Intl.DateTimeFormat('hr-HR', {
      month: 'short',
      year: 'numeric',
      timeZone: 'Europe/Zagreb',
    }).format(new Date(p.created_at));
    months.set(month, (months.get(month) || 0) + p.amount_cents - p.refunded_cents);
  }
  const full = orders.filter((o) => o.payment_model === 'full').length,
    split = orders.filter((o) => o.payment_model === 'split').length;
  const ratio = orders.length ? Math.round((full / orders.length) * 100) : 0;
  return (
    <div className="business-charts">
      <section className="panel">
        <div className="panel-heading">
          <h2>Mjesečne naplate</h2>
          <Link to="/admin/izvjestaji">
            Izvještaji <ArrowRight size={15} />
          </Link>
        </div>
        {months.size ? (
          <div
            className="monthly-bars"
            role="img"
            aria-label={[...months].map(([m, n]) => `${m}: ${money(n)}`).join(', ')}
          >
            {[...months]
              .reverse()
              .slice(-6)
              .map(([m, n]) => (
                <div key={m}>
                  <strong>{money(n)}</strong>
                  <i
                    style={{
                      height: `${Math.max(3, (n / Math.max(1, ...months.values())) * 140)}px`,
                    }}
                  />
                  <span>{m}</span>
                </div>
              ))}
          </div>
        ) : (
          <EmptyState title="Još nema naplata" />
        )}
        <small>Potvrđene naplate nakon povrata; nisu računovodstveni prihod.</small>
      </section>
      <section className="panel">
        <h2>Modeli plaćanja narudžbi</h2>
        {orders.length ? (
          <div className="payment-distribution">
            <div
              className="distribution-donut"
              style={{ background: `conic-gradient(#3155f6 0 ${ratio}%,#a270ff ${ratio}% 100%)` }}
            >
              <span>
                Ukupno<strong>{orders.length}</strong>narudžbi
              </span>
            </div>
            <div>
              <p>
                <i />
                100 % unaprijed <strong>{full}</strong>
              </p>
              <p>
                <i />
                50/50 <strong>{split}</strong>
              </p>
            </div>
          </div>
        ) : (
          <EmptyState title="Još nema narudžbi" />
        )}
        <small>Raspodjela modela; prikazuje i narudžbe koje čekaju uplatu.</small>
      </section>
    </div>
  );
}
