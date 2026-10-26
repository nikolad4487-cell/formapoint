import { readFileSync, readdirSync } from 'node:fs';
import { loadEnv } from 'vite';
const saved = JSON.parse(
  readFileSync(new URL('../src/config/supabase.public.json', import.meta.url), 'utf8'),
);
const env = loadEnv('production', process.cwd(), 'VITE_');
function publicKey(key) {
  if (key.startsWith('sb_publishable_')) return true;
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon';
  } catch {
    return false;
  }
}
if (!publicKey(saved.publishableKey))
  throw new Error('Projektna konfiguracija smije sadržavati samo javni Supabase ključ.');
const explicit = Boolean(
  env.VITE_SUPABASE_URL?.trim() ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  env.VITE_SUPABASE_ANON_KEY?.trim(),
);
const url = explicit ? env.VITE_SUPABASE_URL : saved.url;
const key = explicit
  ? env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
  : saved.publishableKey;
if (key && !publicKey(key))
  throw new Error('Serverski ili nevaljan ključ ne smije se ugraditi u frontend.');
if (env.VITE_SUPABASE_DISABLED !== 'true') {
  let valid = false;
  try {
    const parsed = new URL(url);
    valid = ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {}
  if (!valid || !key)
    throw new Error(
      'Za objavu postavite zajedno VITE_SUPABASE_URL i javni ključ ili uklonite oba overridea.',
    );
}
if (process.argv.includes('--dist')) {
  const text = readdirSync('dist/assets')
    .filter((p) => p.endsWith('.js'))
    .map((p) => readFileSync(`dist/assets/${p}`, 'utf8'))
    .join('\n');
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'FORMAPOINT_ADMIN_PASSWORD', 'GEMINI_API_KEY']) {
    const value = process.env[name];
    if (value && value.length >= 12 && text.includes(value))
      throw new Error(
        'Privatna vrijednost pronađena je u frontend buildu; objava je zaustavljena.',
      );
  }
  for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url')).role === 'service_role')
        throw new Error('Privilegirani JWT pronađen je u frontend buildu.');
    } catch (e) {
      if (e.message.includes('Privilegirani')) throw e;
    }
  }
}
console.log('Javna Supabase konfiguracija provjerena; privatne vrijednosti nisu ispisane.');
