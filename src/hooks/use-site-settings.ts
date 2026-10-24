import { useQuery } from '@tanstack/react-query';
import { configured, requireDb } from '../lib/supabase';
import type { ContentPage, SiteSettings } from '../lib/admin-tools';
export function useSiteSettings() {
  return useQuery({
    queryKey: ['site_settings', 'public'],
    enabled: configured,
    queryFn: async () => {
      const { data, error } = await requireDb()
        .from('site_settings')
        .select('*')
        .eq('id', true)
        .single();
      if (error) throw error;
      return data as SiteSettings;
    },
  });
}
export function usePublishedPage(slug: string) {
  return useQuery({
    queryKey: ['content_pages', 'published', slug],
    enabled: configured,
    queryFn: async () => {
      const { data, error } = await requireDb()
        .from('content_pages')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (error) {
        if (error.code === 'PGRST205') return null;
        throw error;
      }
      return data as ContentPage | null;
    },
  });
}
