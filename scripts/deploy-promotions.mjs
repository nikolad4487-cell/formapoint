import { execFileSync } from 'node:child_process';
for (const name of ['promotions', 'notify']) {
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
console.log(
  'Promocije i postojeći worker obavijesti su objavljeni. Provjerite RESEND_API_KEY, EMAIL_FROM, APP_URL i raspored pozivanja notify.',
);
