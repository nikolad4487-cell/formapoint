import { strict as assert } from 'node:assert';
import { normalizeAppUrl, allowedAppOrigin } from '../_shared/app-url.ts';
Deno.test('APP_URL prihvaća završnu kosu crtu, a povratna adresa ostaje ispravna', () => {
  assert.equal(normalizeAppUrl('https://www.formapoint.online/'), 'https://www.formapoint.online');
  const app = normalizeAppUrl(' https://www.formapoint.online/ ');
  assert.equal(`${app}/app/narudzbe/primjer`, 'https://www.formapoint.online/app/narudzbe/primjer');
  assert.equal(
    allowedAppOrigin('https://www.formapoint.online', 'https://www.formapoint.online/'),
    'https://www.formapoint.online',
  );
});
Deno.test('poznate produkcijske domene rade s istim postavkama', () => {
  assert.equal(
    allowedAppOrigin('https://formapoint.online', 'https://www.formapoint.online/'),
    'https://formapoint.online',
  );
  assert.equal(
    allowedAppOrigin('https://www.formapoint.online', 'https://formapoint.online'),
    'https://www.formapoint.online',
  );
});
Deno.test('CORS odbija druge domene, oponašanje naziva i neispravnu konfiguraciju', () => {
  for (const origin of [
    'https://evil.invalid',
    'https://www.formapoint.online.evil.invalid',
    'http://formapoint.online',
    'null',
  ])
    assert.equal(allowedAppOrigin(origin, 'https://www.formapoint.online/'), 'null');
  assert.equal(allowedAppOrigin('https://formapoint.online', undefined), 'null');
  assert.equal(
    allowedAppOrigin('https://preview.example.invalid', 'https://preview.example.invalid/'),
    'https://preview.example.invalid',
  );
  assert.equal(
    allowedAppOrigin('https://formapoint.online', 'https://preview.example.invalid'),
    'null',
  );
  for (const url of [
    'javascript:alert(1)',
    'https://user:password@example.invalid',
    'https://example.invalid/path',
    'https://example.invalid/?token=secret',
    'http://example.invalid',
  ])
    assert.throws(() => normalizeAppUrl(url));
});
Deno.test('razvojni localhost ostaje ograničen na konfigurirani origin', () => {
  assert.equal(
    allowedAppOrigin('http://localhost:5173', 'http://localhost:5173/'),
    'http://localhost:5173',
  );
  assert.equal(allowedAppOrigin('http://localhost:5174', 'http://localhost:5173/'), 'null');
});
