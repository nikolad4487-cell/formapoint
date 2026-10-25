import { execFileSync } from 'node:child_process';
// --use-api avoids local Docker/Deno dependency downloads in Codespaces.
for (const name of ['upload', 'download']) {
  console.log(`Objavljujem ${name} pomoću Supabase API pakiranja…`);
  try {
    execFileSync(
      'npx',
      [
        'supabase',
        'functions',
        'deploy',
        name,
        '--project-ref',
        'heseilggogbtmqeuwlku',
        '--use-api',
      ],
      { stdio: 'inherit' },
    );
  } catch (error) {
    process.exit(typeof error.status === 'number' ? error.status : 1);
  }
}
console.log('Funkcije za prijenos i zaštićeni pregled/preuzimanje rada su objavljene.');
