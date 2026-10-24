import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const name = `fp-test-${randomUUID().slice(0, 8)}`;
const image =
  'postgres:17-alpine@sha256:eee6c6e1b0894fa4fe0075eb054af9fd1cf39a35321c2d4110626cfe506411fb';
function sql(text) {
  const r = spawnSync(
    'docker',
    ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
    { input: text, encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(r.stderr + r.stdout);
  return (r.stderr.match(/NOTICE:  PASS: .*/g) || []).join('\n');
}
try {
  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '-d',
      '--network',
      'none',
      '--name',
      name,
      '-e',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      image,
    ],
    { stdio: 'pipe' },
  );
  let ready = false;
  for (let n = 0; n < 50; n++) {
    const r = spawnSync(
      'docker',
      ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'],
      { stdio: 'ignore' },
    );
    if (r.status === 0) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw new Error('PostgreSQL nije spreman');
  sql(readFileSync('tests/db-bootstrap.sql', 'utf8'));
  for (const file of readdirSync('supabase/migrations')
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    sql(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    console.log(`Migracija: ${file}`);
  }
  console.log(sql(readFileSync('tests/database.sql', 'utf8')));
  console.log(
    'PostgreSQL integracijske provjere su prošle. Auth i Storage sheme su minimalni testni adapteri, ne puni Supabase.',
  );
} finally {
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
}
