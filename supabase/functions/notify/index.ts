import { processPromotions } from '../_shared/promotion-delivery.ts';
import { admin, checked, env, json, serve } from '../_shared/http.ts';
serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${env('CRON_SECRET')}`)
    return json(req, { error: 'Nedopušten pristup' }, 401);
  const db = admin();
  const jobs = await checked(db.rpc('claim_notifications'));
  let sent = 0;
  for (const job of jobs) {
    try {
      const { data, error } = await db.auth.admin.getUserById(job.user_id);
      if (error || !data.user) throw new Error('Primatelj nije dostupan');
      let recipient = data.user.email;
      if (data.user.is_anonymous) {
        const profile = await checked(
          db.from('profiles').select('contact_email').eq('id', job.user_id).single(),
        );
        recipient = profile?.contact_email;
      }
      if (!recipient) throw new Error('Primatelj nije dostupan');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': job.id,
        },
        body: JSON.stringify({
          from: env('EMAIL_FROM'),
          to: [recipient],
          subject: 'FormaPoint – nova obavijest',
          html: '<div style="font-family:Arial;color:#10183f"><h1 style="color:#3155F6">FormaPoint</h1><p>Imate novu obavijest u svojem radnom prostoru.</p><p>Otvorite FormaPoint u pregledniku u kojem ste naručili i pogledajte svoje obavijesti.</p></div>',
        }),
      });
      if (!response.ok) throw new Error('Slanje nije uspjelo');
      await checked(
        db
          .from('notification_outbox')
          .update({ status: 'sent', last_error: null })
          .eq('id', job.id),
      );
      sent++;
    } catch {
      await checked(
        db
          .from('notification_outbox')
          .update({ status: 'failed', last_error: 'Slanje nije uspjelo; provjerite integraciju.' })
          .eq('id', job.id),
      );
    }
  }
  return json(req, { sent, promotions: await processPromotions() });
});
