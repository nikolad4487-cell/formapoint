import { admin, checked } from './http.ts';
import { normalizeAppUrl } from './app-url.ts';
import { promotionEmail } from './promotion-email.ts';
export async function processPromotions(campaign: string | null = null) {
  const totals = { sent: 0, failed: 0, skipped: 0, claimed: 0, available: true };
  const key = Deno.env.get('RESEND_API_KEY'),
    from = Deno.env.get('EMAIL_FROM'),
    origin = Deno.env.get('APP_URL');
  if (!key || !from || !origin) return { ...totals, available: false };
  const app = normalizeAppUrl(origin),
    db = admin();
  const claimed = await db.rpc('claim_promotions', { p_campaign: campaign, p_limit: 10 });
  if (claimed.error) return { ...totals, available: false };
  const jobs = claimed.data || [];
  totals.claimed = jobs.length;
  for (const [index, claim] of jobs.entries()) {
    if (index) await new Promise((resolve) => setTimeout(resolve, 550));
    const finish = (status: string, error: string | null = null, provider: string | null = null) =>
      checked(
        db.rpc('finish_promotion_delivery', {
          p_id: claim.id,
          p_claim: claim.claim_token,
          p_status: status,
          p_error: error,
          p_provider: provider,
        }),
      );
    try {
      // Check current consent, current e-mail, coupon state and unsubscribe token
      // immediately before sending, even when the campaign was queued earlier.
      const job = await checked(
        db.rpc('promotion_delivery_data', { p_id: claim.id, p_claim: claim.claim_token }),
      );
      if (!job) continue;
      if (!job.allowed || !job.token) {
        await finish(
          'skipped',
          'Korisnik se odjavio, adresa je promijenjena ili kod više nije dostupan.',
        );
        totals.skipped++;
        continue;
      }
      const optout = new URL('/odjava-newslettera', app);
      optout.searchParams.set('token', job.token);
      const mail = promotionEmail(job, app, optout.toString());
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `promotion-${job.id}`,
        },
        body: JSON.stringify({ from, to: [job.email], ...mail }),
      });
      if (!response.ok) throw new Error('MailProviderUnavailable');
      const result = await response.json();
      if (typeof result.id !== 'string' || !result.id) throw new Error('MissingProviderReceipt');
      await finish('sent', null, result.id);
      totals.sent++;
    } catch {
      await finish(
        'failed',
        'Slanje nije potvrđeno. Provjerite e-mail integraciju i ponovite obradu.',
      );
      totals.failed++;
    }
  }
  return totals;
}
