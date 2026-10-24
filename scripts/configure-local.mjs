import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
const binary = process.env.SUPABASE_CLI || '/workspace/.tools/formapoint/supabase';
try {
  const config = JSON.parse(
    execFileSync(binary, ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
  const url = config.API_URL;
  const key = config.ANON_KEY;
  if (!url || !key || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
    throw new Error('Potreban je lokalni Supabase.');
  if (existsSync('.env.local')) {
    console.log('.env.local već postoji; postojeće vrijednosti su sačuvane.');
  } else {
    writeFileSync(
      '.env.local',
      `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${key}\n`,
      { mode: 0o600 },
    );
    console.log('Lokalna javna konfiguracija spremljena, vrijednosti nisu ispisane.');
  }
  if (!existsSync('.env.edge.local'))
    writeFileSync(
      '.env.edge.local',
      `APP_URL=http://127.0.0.1:5173\nPUBLIC_SUPABASE_URL=${url}\n`,
      { mode: 0o600 },
    );
} catch {
  console.error('Lokalni Supabase nije dostupan. Pokrenite ga prije konfiguracije.');
  process.exitCode = 1;
}
