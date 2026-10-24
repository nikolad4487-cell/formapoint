import { createClient } from '@supabase/supabase-js';
import publicConfig from '../config/supabase.public.json';
import { resolveSupabaseConfig } from './supabase-config';
const {
  url,
  key,
  configured: ready,
} = resolveSupabaseConfig(
  {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_DISABLED: import.meta.env.VITE_SUPABASE_DISABLED,
  },
  publicConfig,
);
export const configured = ready;
export const db = configured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
export function requireDb() {
  if (!db) throw new Error('Supabase nije konfiguriran. Ova mogućnost trenutačno nije dostupna.');
  return db;
}
export async function rpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await requireDb().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireDb().functions.invoke(name, { body });
  if (error)
    throw new Error(
      'Zahtjev nije uspio. Provjerite konfiguraciju integracije i pokušajte ponovno.',
    );
  if (data?.error) throw new Error(data.error);
  return data as T;
}
