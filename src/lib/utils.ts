import { formatInTimeZone } from 'date-fns-tz';
import { hr } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function money(cents: number) {
  return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
export function localDate(value: string) {
  return formatInTimeZone(new Date(value), 'Europe/Zagreb', 'd. MMM yyyy. HH:mm', { locale: hr });
}
