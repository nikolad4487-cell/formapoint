import { admin, env } from '../_shared/http.ts';
import { stripe, Stripe } from '../_shared/stripe.ts';
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });
  let event: Stripe.Event;
  const provider = stripe();
  try {
    event = await provider.webhooks.constructEventAsync(
      await req.text(),
      signature,
      env('STRIPE_WEBHOOK_SECRET'),
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }
  try {
    const db = admin();
    let session: Stripe.Checkout.Session;
    let status: string;
    let refunded = 0;
    let paymentId: string | undefined;
    let fee: number | null = null;
    let intentId: string | null = null;
    if (
      [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
        'checkout.session.async_payment_failed',
        'checkout.session.expired',
      ].includes(event.type)
    ) {
      const value = event.data.object as Stripe.Checkout.Session;
      session = await provider.checkout.sessions.retrieve(value.id, {
        expand: ['payment_intent.latest_charge.balance_transaction'],
      });
      paymentId = session.metadata?.payment_id;
      status =
        session.payment_status === 'paid'
          ? 'succeeded'
          : event.type === 'checkout.session.expired'
            ? 'expired'
            : event.type === 'checkout.session.async_payment_failed'
              ? 'failed'
              : 'pending';
      if (status === 'pending') return new Response('Waiting for payment');
      const intent = session.payment_intent;
      if (intent && typeof intent !== 'string') {
        intentId = intent.id;
        const charge = intent.latest_charge;
        if (charge && typeof charge !== 'string') {
          const bt = charge.balance_transaction;
          if (bt && typeof bt !== 'string') fee = bt.fee;
        }
      } else intentId = typeof intent === 'string' ? intent : null;
    } else if (event.type === 'charge.refunded') {
      const charge = await provider.charges.retrieve((event.data.object as Stripe.Charge).id);
      intentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id || null;
      if (!intentId) throw new Error('Missing intent');
      const { data: p, error } = await db
        .from('payments')
        .select('*')
        .eq('provider_payment_id', intentId)
        .single();
      if (error || !p) throw new Error('Payment not processed yet');
      session = await provider.checkout.sessions.retrieve(p.provider_session_id);
      paymentId = p.id;
      refunded = charge.amount_refunded;
      status = refunded >= charge.amount ? 'refunded' : 'partially_refunded';
      const refunds = await provider.refunds.list({ charge: charge.id, limit: 100 });
      for (const refund of refunds.data) {
        const { error } = await db
          .from('refunds')
          .upsert({
            id: refund.id,
            payment_id: p.id,
            amount_cents: refund.amount,
            status: refund.status || 'pending',
          });
        if (error) throw error;
      }
    } else return new Response('Ignored');
    if (!paymentId) throw new Error('Missing payment');
    const { error } = await db.rpc('apply_stripe_event', {
      p_event: event.id,
      p_type: event.type,
      p_payment: paymentId,
      p_session: session.id,
      p_intent: intentId,
      p_amount: session.amount_total,
      p_currency: session.currency,
      p_status: status,
      p_refunded: refunded,
      p_fee: fee,
    });
    if (error) throw error;
    return new Response('OK');
  } catch {
    console.error('StripeEventProcessingFailed', event.id);
    return new Response('Retry required', { status: 500 });
  }
});
