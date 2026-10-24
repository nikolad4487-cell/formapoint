import { admin, checked, env, json, serve, user, uuid } from '../_shared/http.ts';
const configured = () =>
  Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('EMAIL_FROM') && Deno.env.get('APP_URL'));
async function sendEmail(to: string, subject: string, html: string, key: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify({ from: env('EMAIL_FROM'), to: [to], subject, html }),
  });
  if (!r.ok) throw new Error('EmailProviderError');
}
async function process() {
  const db = admin();
  const jobs = await checked(db.rpc('claim_newsletter', { p_limit: 20 }));
  let sent = 0,
    failed = 0,
    skipped = 0;
  for (const job of jobs) {
    try {
      const delivery = await checked(
        db.from('newsletter_deliveries').select('subscriber_id').eq('id', job.id).single(),
      );
      if (!delivery) throw new Error('MissingDelivery');
      const sub = await checked(
        db
          .from('newsletter_subscribers')
          .select('status,user_id,email,confirmed_at')
          .eq('id', delivery.subscriber_id)
          .single(),
      );
      if (!sub) throw new Error('MissingSubscriber');
      const profile = await checked(
        db.from('profiles').select('marketing_consent').eq('id', sub.user_id).single(),
      );
      if (
        !job.allowed ||
        sub.status !== 'subscribed' ||
        !sub.confirmed_at ||
        !profile?.marketing_consent
      ) {
        await checked(
          db
            .from('newsletter_deliveries')
            .update({ status: 'skipped', last_error: null })
            .eq('id', job.id),
        );
        skipped++;
        continue;
      }
      const link = new URL('/odjava-newslettera', env('APP_URL'));
      link.searchParams.set('token', job.token);
      await sendEmail(
        sub.email,
        job.subject,
        `${job.html}<hr><p><a href="${link.toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Odjava s newslettera</a></p>`,
        job.id,
      );
      await checked(
        db
          .from('newsletter_deliveries')
          .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
          .eq('id', job.id),
      );
      sent++;
    } catch {
      await checked(
        db
          .from('newsletter_deliveries')
          .update({
            status: 'failed',
            last_error: 'Pružatelj nije potvrdio slanje; provjerite integraciju.',
          })
          .eq('id', job.id),
      );
      failed++;
    }
  }
  return { sent, failed, skipped };
}
serve(async (req) => {
  const multipart = req.headers.get('content-type')?.startsWith('multipart/form-data');
  const body = multipart ? await req.formData() : await req.json();
  const action = multipart ? (body as FormData).get('action') : body.action;
  const cron =
    action === 'process-newsletter' &&
    Boolean(Deno.env.get('CRON_SECRET')) &&
    req.headers.get('authorization') === `Bearer ${Deno.env.get('CRON_SECRET')}`;
  const db = admin();
  let uid = '';
  if (!cron) {
    const u = await user(req);
    uid = u.id;
    const roles = await checked(
      db.from('user_roles').select('role').eq('user_id', u.id).eq('role', 'ADMIN'),
    );
    if (!roles?.length) return json(req, { error: 'Nedopušten pristup' }, 403);
    await checked(db.rpc('rate_limit', { k: `admin-tools:${uid}`, max_hits: 30, seconds: 60 }));
  }
  if (action === 'health')
    return json(req, {
      email_configured: configured(),
      invites_available: Boolean(Deno.env.get('APP_URL')),
    });
  if (action === 'invite') {
    const email = String(body.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new Error('InvalidEmail');
    const { error } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: new URL('/potvrda-emaila', env('APP_URL')).toString(),
    });
    if (error) throw new Error('InviteFailed');
    return json(req, { ok: true });
  }
  if (action === 'test-email') {
    const settings = await checked(
      db.from('business_settings').select('notification_email').eq('id', true).single(),
    );
    if (!settings?.notification_email) throw new Error('MissingRecipient');
    await sendEmail(
      settings.notification_email,
      'FormaPoint – provjera e-pošte',
      '<p>Probna poruka: administratorska e-pošta uspješno je povezana.</p>',
      crypto.randomUUID(),
    );
    return json(req, { ok: true });
  }
  if (action === 'portfolio-upload') {
    const form = body as FormData,
      file = form.get('file');
    const title = String(form.get('title') || '').trim(),
      description = String(form.get('description') || '').trim();
    if (
      !(file instanceof File) ||
      file.size > 20971520 ||
      file.size < 5 ||
      title.length < 3 ||
      title.length > 150 ||
      description.length < 10 ||
      description.length > 10000
    )
      throw new Error('InvalidPdf');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('InvalidPdf');
    const path = `${crypto.randomUUID()}.pdf`;
    await checked(
      db.storage
        .from('portfolio-files')
        .upload(path, bytes, { contentType: 'application/pdf', upsert: false }),
    );
    try {
      await checked(
        db.from('portfolio_items').insert({
          title,
          description,
          file_path: path,
          scan_status: 'quarantined',
          publication_rights: false,
          published: false,
        }),
      );
    } catch (e) {
      await db.storage.from('portfolio-files').remove([path]);
      throw e;
    }
    return json(req, { ok: true });
  }
  if (action === 'send-newsletter') {
    if (!configured() || !uuid(body.template_id) || !uuid(body.campaign_id))
      throw new Error('NotConfigured');
    const template = await checked(
      db.from('newsletter_templates').select('*').eq('id', body.template_id).single(),
    );
    if (
      (template.valid_from && new Date(template.valid_from) > new Date()) ||
      (template.valid_until && new Date(template.valid_until) < new Date())
    )
      throw new Error('TemplateExpired');
    const existing = await checked(
      db
        .from('newsletter_campaigns')
        .select('id,template_id,status')
        .eq('id', body.campaign_id)
        .maybeSingle(),
    );
    if (existing && existing.template_id !== template.id) throw new Error('CampaignMismatch');
    if (existing && existing.status !== 'draft')
      return json(req, { campaign_id: existing.id, already_queued: true });
    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const campaign =
      existing ||
      (await checked(
        db
          .from('newsletter_campaigns')
          .insert({
            id: body.campaign_id,
            template_id: template.id,
            subject: template.subject,
            html: `${template.image_url ? `<img src="${escape(template.image_url)}" alt="">` : ''}${template.html}`,
          })
          .select('id')
          .single(),
      ));
    if (!campaign) throw new Error('MissingCampaign');
    // Invoke as the actual administrator so the RPC enforces its role and rate limit.
    const { createClient } = await import('npm:@supabase/supabase-js@2.118.0');
    const caller = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: req.headers.get('authorization')! } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      await checked(caller.rpc('queue_newsletter', { p_campaign: campaign.id }));
    } catch (e) {
      await db.from('newsletter_campaigns').delete().eq('id', campaign.id).eq('status', 'draft');
      throw e;
    }
    return json(req, { campaign_id: campaign.id, ...(await process()) });
  }
  if (action === 'process-newsletter') {
    if (!configured()) throw new Error('NotConfigured');
    return json(req, await process());
  }
  return json(req, { error: 'Nepoznata radnja' }, 400);
});
