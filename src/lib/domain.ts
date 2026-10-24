export type Role = 'CUSTOMER' | 'ADMIN' | 'STAFF' | 'SUPPORT';
export type OrderStatus =
  | 'received'
  | 'quote_pending'
  | 'quote_sent'
  | 'deposit_pending'
  | 'ready'
  | 'in_progress'
  | 'needs_info'
  | 'work_done'
  | 'final_pending'
  | 'delivered'
  | 'revision'
  | 'completed'
  | 'cancelled';
export const statuses: Record<OrderStatus, string> = {
  received: 'Zahtjev zaprimljen',
  quote_pending: 'Čeka ponudu',
  quote_sent: 'Ponuda poslana',
  deposit_pending: 'Čeka uplatu',
  ready: 'Spremno za izradu',
  in_progress: 'U izradi',
  needs_info: 'Čeka dodatne informacije',
  work_done: 'Rad dovršen',
  final_pending: 'Čeka završnu uplatu',
  delivered: 'Dostavljeno',
  revision: 'Revizija',
  completed: 'Završeno',
  cancelled: 'Otkazano',
};
export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  price_cents: number | null;
  unit_label: string;
  delivery_days: number;
  revisions: number;
  split_enabled: boolean;
  split_min_cents: number;
  active: boolean;
  popular: boolean;
  included: string[];
  excluded: string[];
}
export interface Order {
  id: string;
  number: string;
  user_id: string;
  title: string;
  description: string;
  status: OrderStatus;
  total_cents: number | null;
  paid_cents: number;
  payment_model: 'full' | 'split';
  due_at: string | null;
  created_at: string;
}
export interface CartItem {
  id: string;
  service_id: string;
  quantity: number;
  services: Service | null;
}
export interface OrderFile {
  id: string;
  order_id: string;
  name: string;
  path: string;
  kind: 'attachment' | 'preview' | 'final';
  size: number;
  scan_status: string;
  created_at: string;
}
export interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
  internal: boolean;
  created_at: string;
}
export interface Payment {
  id: string;
  order_id: string;
  amount_cents: number;
  refunded_cents: number;
  fee_cents: number | null;
  provider: string;
  status: string;
  created_at: string;
}
export interface Quote {
  id: string;
  order_id: string;
  version: number;
  description: string;
  total_cents: number;
  expires_at: string;
  accepted_at: string | null;
  split_enabled: boolean;
}
export const transitions: Record<OrderStatus, OrderStatus[]> = {
  received: ['quote_pending', 'cancelled'],
  quote_pending: ['quote_sent', 'cancelled'],
  quote_sent: ['cancelled'],
  deposit_pending: ['cancelled'],
  ready: ['in_progress', 'cancelled'],
  in_progress: ['needs_info', 'work_done', 'cancelled'],
  needs_info: ['in_progress', 'cancelled'],
  work_done: ['final_pending', 'delivered'],
  final_pending: [],
  delivered: ['revision', 'completed'],
  revision: ['in_progress'],
  completed: [],
  cancelled: [],
};
export function installments(total: number, split: boolean): number[] {
  if (!Number.isSafeInteger(total) || total < 1)
    throw new Error('Iznos mora biti pozitivan cijeli broj centi.');
  return split ? [Math.ceil(total / 2), Math.floor(total / 2)] : [total];
}
export function discount(total: number, kind: 'percent' | 'fixed', value: number) {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    (kind === 'percent' && value > 100)
  )
    throw new Error('Neispravan popust.');
  return Math.max(0, total - (kind === 'percent' ? Math.floor((total * value) / 100) : value));
}
export function canDownloadFinal(total: number | null, paid: number, override = false) {
  return override || (total !== null && total > 0 && paid >= total);
}
