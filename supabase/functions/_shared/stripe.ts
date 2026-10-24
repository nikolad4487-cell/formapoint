import Stripe from 'npm:stripe@18.5.0';
import { env } from './http.ts';
export function stripe() {
  const key = env('STRIPE_SECRET_KEY');
  if (!key.startsWith('sk_test_') && Deno.env.get('STRIPE_LIVE_ENABLED') !== 'true')
    throw new Error('Produkcijsko plaćanje nije aktivirano');
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}
export { Stripe };
