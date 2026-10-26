import { useQuery } from '@tanstack/react-query';
import { db, requireDb } from '../lib/supabase';
import { catalog } from '../lib/catalog';
import type { Service } from '../lib/domain';
export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      if (!db) return catalog;
      const { data, error } = await db
        .from('services')
        .select('*,service_categories(slug)')
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data.map(({ service_categories, ...service }) => ({
        ...service,
        category_slug: service_categories?.slug,
      })) as Service[];
    },
  });
}
export function useRows<T>(
  table: string,
  filters: Record<string, string> = {},
  order = 'created_at',
) {
  return useQuery({
    queryKey: [table, filters, order],
    queryFn: async () => {
      let q = requireDb().from(table).select('*').order(order, { ascending: false }).limit(200);
      for (const [key, value] of Object.entries(filters)) q = q.eq(key, value);
      const { data, error } = await q;
      if (error) throw error;
      return data as T[];
    },
  });
}
