import { admin, checked, env, json, serve, user, uuid } from '../_shared/http.ts';
import { stripe } from '../_shared/stripe.ts';
serve(async (req) => {
  const u = await user(req);
  const body = await req.json();
  if (!uuid(body.order_id)) throw new Error('Neispravna narudžba');
  const db = admin();
  await checked(db.rpc('rate_limit', { k: `checkout:${u.id}`, max_hits: 20, seconds: 60 }));
  const payment = await checked(
    db.rpc('reserve_payment', { p_order: body.order_id, p_user: u.id }),
  );
  const provider = stripe();
  if (payment.provider_session_id) {
    const existing = await provider.checkout.sessions.retrieve(payment.provider_session_id);
    if (existing.status === 'open' && existing.url) return json(req, { url: existing.url });
    return json(
      req,
      {
        error:
          'Plaćanje se obrađuje ili je sesija istekla. Osvježite narudžbu nakon potvrde pružatelja.',
      },
      409,
    );
  }
  const app = env('APP_URL');
  const session = await provider.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: payment.id,
      metadata: { payment_id: payment.id },
      payment_intent_data: { metadata: { payment_id: payment.id } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: payment.amount_cents,
            product_data: {
              name: `FormaPoint – ${payment.installment === 1 ? 'početna' : 'završna'} uplata`,
            },
          },
        },
      ],
      success_url: `${app}/app/narudzbe/${body.order_id}?uplata=obrada`,
      cancel_url: `${app}/app/narudzbe/${body.order_id}`,
      expires_at: Math.floor(new Date(payment.created_at).getTime() / 1000) + 3600,
    },
    { idempotencyKey: `checkout-${payment.id}` },
  );
  await checked(
    db.from('payments').update({ provider_session_id: session.id }).eq('id', payment.id),
  );
  return json(req, { url: session.url });
});
