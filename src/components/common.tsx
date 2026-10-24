import { BrandMark } from './brand-mark';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  FileText,
  Presentation,
  Table2,
  Files,
  Mail,
  LayoutGrid,
  Sparkles,
  ArrowRight,
  Search,
  Inbox,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Button } from './ui/button';
import type { Order, Service, OrderStatus } from '../lib/domain';
import { statuses } from '../lib/domain';
import { localDate, money } from '../lib/utils';
export const icons = { FileText, Presentation, Table2, Files, Mail, LayoutGrid, Sparkles };
export function ServiceIcon({ name }: { name: string }) {
  const Icon = icons[name as keyof typeof icons] || FileText;
  return <Icon size={25} strokeWidth={1.7} />;
}
export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="FormaPoint početna">
      <BrandMark />
      Forma<span>Point</span>
    </Link>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status}`}>
      {statuses[status as OrderStatus] ||
        {
          succeeded: 'Plaćeno',
          pending: 'Na čekanju',
          refunded: 'Refundirano',
          failed: 'Neuspjelo',
          open: 'Otvoreno',
          closed: 'Zatvoreno',
          clean: 'Provjereno',
          quarantined: 'Čeka sigurnosnu provjeru',
        }[status] ||
        status}
    </span>
  );
}
export function ServiceCard({ service }: { service: Service }) {
  return (
    <article className={`service-card service-${service.icon}`}>
      <div className="service-card-top">
        <span className="service-icon">
          <ServiceIcon name={service.icon} />
        </span>
        {service.popular && <span className="small-label">POPULARNO</span>}
      </div>
      <h3>{service.name}</h3>
      <p>{service.description}</p>
      <div className="service-card-footer">
        <span>
          {service.price_cents === null
            ? 'Cijena prema ponudi'
            : `Od ${money(service.price_cents)}`}
        </span>
        <Link to={`/usluge/${service.slug}`} aria-label={`Saznaj više: ${service.name}`}>
          Saznaj više <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
export function EmptyState({
  title = 'Još nema podataka',
  description = 'Novi podaci prikazat će se ovdje.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={36} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({ retry }: { retry?: () => void }) {
  return (
    <div role="alert" className="empty-state">
      <AlertCircle />
      <h3>Podatke nije moguće učitati</h3>
      <p>Provjerite vezu i konfiguraciju, pa pokušajte ponovno.</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Pokušaj ponovno
        </Button>
      )}
    </div>
  );
}
export function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Učitavanje" className="skeleton-grid">
      {[1, 2, 3].map((x) => (
        <div className="skeleton" key={x} />
      ))}
    </div>
  );
}
export function Unavailable({ children }: { children?: ReactNode }) {
  return (
    <div className="notice">
      <AlertCircle size={20} />
      <div>
        <strong>Usluga trenutačno nije dostupna</strong>
        <p>
          {children ||
            'Za ovu funkcionalnost potrebno je konfigurirati Supabase. Nisu kreirani računi, narudžbe ni uplate.'}
        </p>
      </div>
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = 'Pretraži…',
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-input">
      <Search size={19} />
      <span className="sr-only">{placeholder}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
export function StatCard({
  label,
  value,
  icon,
  tone = 'blue',
  description,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: string;
  description?: string;
}) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {description && <small>{description}</small>}
      </div>
      <span className="service-icon">{icon || <FileText />}</span>
    </article>
  );
}
export function OrderCard({ order, admin = false }: { order: Order; admin?: boolean }) {
  return (
    <Link className="order-card" to={`${admin ? '/admin' : '/app'}/narudzbe/${order.id}`}>
      <div>
        <span className="eyebrow">{order.number}</span>
        <h3>{order.title}</h3>
        <p>{localDate(order.created_at)}</p>
      </div>
      <div>
        <StatusBadge status={order.status} />
        <p>{order.total_cents === null ? 'Čeka ponudu' : money(order.total_cents)}</p>
      </div>
      <ChevronRight size={19} />
    </Link>
  );
}
export function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav aria-label="Putanja" className="breadcrumbs">
      <Link to="/">Početna</Link>
      <ChevronRight size={14} />
      <span>{current}</span>
    </nav>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && (
        <Button variant="outline" asChild>
          {action}
        </Button>
      )}
    </div>
  );
}
export function LinkButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button asChild>
      <Link to={to}>
        {children}
        <ArrowRight size={17} />
      </Link>
    </Button>
  );
}
