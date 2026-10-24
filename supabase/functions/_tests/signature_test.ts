import { Stripe } from '../_shared/stripe.ts';
// Sintetička lokalna kriptografska proba; ne kontaktira Stripe i ne naplaćuje ništa.
const payload = JSON.stringify({
  id: 'evt_local_test',
  object: 'event',
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_local_test' } },
});
const secret = 'whsec_local_signature_fixture_only';
const provider = new Stripe('sk_test_local_fixture_only', {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
Deno.test('Stripe SDK prihvaća valjan lokalni potpis', async () => {
  const signature = await provider.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
    cryptoProvider,
  });
  const event = await provider.webhooks.constructEventAsync(
    payload,
    signature,
    secret,
    undefined,
    cryptoProvider,
  );
  if (event.id !== 'evt_local_test') throw new Error('Događaj se ne podudara.');
});
Deno.test('Izmijenjeno tijelo webhooka je odbijeno', async () => {
  const signature = await provider.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
    cryptoProvider,
  });
  let rejected = false;
  try {
    await provider.webhooks.constructEventAsync(
      payload + ' ',
      signature,
      secret,
      undefined,
      cryptoProvider,
    );
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error('Nevaljan potpis nije odbijen.');
});
Deno.test('Prestara potpisana poruka je odbijena', async () => {
  const signature = await provider.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
    timestamp: Math.floor(Date.now() / 1000) - 1000,
    cryptoProvider,
  });
  let rejected = false;
  try {
    await provider.webhooks.constructEventAsync(
      payload,
      signature,
      secret,
      undefined,
      cryptoProvider,
    );
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error('Zastarjela poruka nije odbijena.');
});
