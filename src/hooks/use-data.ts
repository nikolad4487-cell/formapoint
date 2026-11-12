import { useQuery } from '@tanstack/react-query';
import { db, requireDb } from '../lib/supabase';
import { catalog } from '../lib/catalog';
import type { Service, ServicePackage } from '../lib/domain';
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
      const enabledIds = data.filter((s) => s.packages_enabled).map((s) => s.id);
      let packages: ServicePackage[] = [];
      if (enabledIds.length) {
        const variants = await db
          .from('service_variants')
          .select('*')
          .in('service_id', enabledIds)
          .eq('active', true)
          .eq('archived', false)
          .order('sort_order');
        if (variants.error) throw variants.error;
        packages = variants.data as ServicePackage[];
      }
      return data.map(({ service_categories, ...service }) => ({
        ...service,
        packages: packages.filter((p) => p.service_id === service.id),
        ...(service.packages_enabled
          ? {
              price_cents: packages.filter((p) => p.service_id === service.id).length
                ? Math.min(
                    ...packages
                      .filter((p) => p.service_id === service.id)
                      .map((p) => p.price_cents),
                  )
                : null,
            }
          : {}),
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
