import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error('Integracija nije konfigurirana');
  return value;
}
export function admin() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function headers(req: Request) {
  const origin = req.headers.get('origin');
  const app = Deno.env.get('APP_URL');
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin === app ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}
export async function user(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) throw new Error('Prijava je potrebna');
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new Error('Sesija nije važeća');
  return data.user;
}
export function serve(fn: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: headers(req) });
    if (req.method !== 'POST') return json(req, { error: 'Metoda nije dopuštena' }, 405);
    try {
      return await fn(req);
    } catch (e) {
      console.error(e instanceof Error ? e.name : 'RequestError');
      return json(
        req,
        { error: 'Zahtjev nije uspio. Provjerite ovlasti, podatke i dostupnost integracije.' },
        400,
      );
    }
  });
}
export async function checked<T>(result: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await result;
  if (error) throw new Error('Operacija baze nije uspjela');
  return data;
}
export const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
