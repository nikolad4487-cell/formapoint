import { execFileSync } from 'node:child_process';
// --use-api avoids local Docker/Deno dependency downloads in Codespaces.
for (const name of ['checkout', 'stripe-webhook']) {
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
console.log('Obje Stripe funkcije su objavljene. Provjerite njihove Secrets i testnu naplatu.');
