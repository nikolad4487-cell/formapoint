import { execFileSync } from 'node:child_process';
try {
  execFileSync(
    'npx',
    [
      'supabase',
      'functions',
      'deploy',
      'ai-assistant',
      '--project-ref',
      'heseilggogbtmqeuwlku',
      '--use-api',
    ],
    { stdio: 'inherit' },
  );
} catch (error) {
  process.exit(typeof error.status === 'number' ? error.status : 1);
}
console.log(
  'Funkcija AI asistenta je objavljena. U Supabase Secrets postavite GEMINI_API_KEY; APP_URL treba biti javna adresa aplikacije.',
);
