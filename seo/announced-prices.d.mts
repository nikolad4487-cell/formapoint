import type { Service } from '../src/lib/domain';
export const priceList2027StartsAt: number;
export const prices2027: Readonly<Record<string, number>>;
export function announcedPrice(
  service: Pick<Service, 'id' | 'slug' | 'category' | 'active' | 'packages_enabled'>,
  now?: number,
): string | null;
