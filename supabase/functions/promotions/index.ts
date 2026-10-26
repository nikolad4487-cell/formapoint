import { promotionThemes, type PromotionOccasion } from '../_shared/promotion-email.ts';
import { normalizeAppUrl } from '../_shared/app-url.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { admin, checked, env, json, serve, user, uuid } from '../_shared/http.ts';
import { processPromotions } from '../_shared/promotion-delivery.ts';
serve(async (req) => {
  const multipart = req.headers.get('content-type')?.startsWith('multipart/form-data');
  const body = multipart ? await req.formData() : await req.json();
  const action = multipart ? (body as FormData).get('action') : body.action;
  let cron =
    action === 'process' &&
    Boolean(Deno.env.get('CRON_SECRET')) &&
    req.headers.get('authorization') === `Bearer ${Deno.env.get('CRON_SECRET')}`;
  const db = admin();
  if (!cron && action === 'process') {
    const token = req.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    if (/^[a-f0-9]{64}$/.test(token)) {
      const verified = await db.rpc('promotion_worker_authorized', { p_secret: token });
      cron = !verified.error && verified.data === true;
    }
  }
  if (!cron) {
    const caller = await user(req);
    const roles = await checked(
      db.from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'ADMIN'),
    );
    if (!roles?.length) return json(req, { error: 'Nedopušten pristup' }, 403);
    await checked(
      db.rpc('rate_limit', { k: `promotions:${caller.id}`, max_hits: 30, seconds: 60 }),
    );
  }
  if (action === 'health') {
    const schema = await db.from('promotion_campaigns').select('id').limit(1);
    const missing = ['RESEND_API_KEY', 'EMAIL_FROM', 'APP_URL'].filter(
      (name) => !Deno.env.get(name)?.trim(),
    );
    return json(req, {
      schema_ready: !schema.error,
      worker_ready: (await db.rpc('promotion_worker_ready')).data === true,
      scheduled_sending_ready: (await db.rpc('promotion_schedule_ready')).data === true,
      birthday_ready: !(await db.from('birthday_promotion_settings').select('id').limit(1)).error,
      email_configured: missing.length === 0,
      missing_email_settings: missing,
    });
  }
  if (action === 'upload-image') {
    const file = (body as FormData).get('file');
    if (
      !(file instanceof File) ||
      file.size < 8 ||
      file.size > 2097152 ||
      file.type !== 'image/png'
    )
      return json(req, { error: 'Odaberite PNG sliku do 2 MB.' }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value))
      return json(req, { error: 'Datoteka nije PNG slika.' }, 400);
    const path = `${crypto.randomUUID()}.png`;
    await checked(
      db.storage
        .from('promotion-images')
        .upload(path, bytes, { contentType: 'image/png', upsert: false }),
    );
    return json(req, {
      url: db.storage.from('promotion-images').getPublicUrl(path).data.publicUrl,
    });
  }
  if (action === 'create' || action === 'birthday-save') {
    if (action === 'create' && body.occasion === 'birthday')
      return json(
        req,
        {
          error: 'Za rođendane spremite automatsku rođendansku promociju, bez zajedničkih datuma.',
        },
        400,
      );
    if (!Deno.env.get('RESEND_API_KEY') || !Deno.env.get('EMAIL_FROM') || !Deno.env.get('APP_URL'))
      return json(
        req,
        { error: 'Slanje e-pošte nije konfigurirano. Promocija nije kreirana.' },
        503,
      );
    if (action === 'create' && body.starts_at && new Date(body.starts_at).getTime() > Date.now()) {
      const schedule = await db.rpc('promotion_schedule_ready');
      if (schedule.error || schedule.data !== true)
        return json(
          req,
          { error: 'Za zakazano slanje najprije primijenite SQL nadogradnju 015.' },
          400,
        );
    }
    if (action === 'create' && !uuid(body.request_id))
      return json(req, { error: 'Nedostaje identifikator promocije.' }, 400);
    const theme = promotionThemes[body.occasion as PromotionOccasion];
    if (!theme) return json(req, { error: 'Odaberite prigodu promocije.' }, 400);
    const imageUrl =
      body.image_url || new URL(theme.image, normalizeAppUrl(env('APP_URL'))).toString();
    let image: URL;
    try {
      image = new URL(imageUrl);
      if (image.protocol !== 'https:' || image.username || image.password) throw new Error();
    } catch {
      return json(req, { error: 'Odaberite valjanu HTTPS sliku.' }, 400);
    }
    const caller = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: req.headers.get('authorization')! } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (action === 'birthday-save') {
      const result = await caller.rpc('save_birthday_promotion', {
        p_name: body.name,
        p_kind: body.kind,
        p_value: body.value,
        p_subject: body.subject,
        p_message: body.message,
        p_image_url: imageUrl,
        p_days: body.validity_days ?? 30,
        p_active: body.active ?? true,
      });
      if (result.error)
        return json(
          req,
          {
            error:
              result.error.code === 'PGRST202'
                ? 'Najprije primijenite SQL nadogradnju 016.'
                : result.error.message,
          },
          400,
        );
      return json(req, { saved: true });
    }
    const result = await caller.rpc('create_personal_promotion', {
      p_request: body.request_id,
      p_name: body.name,
      p_occasion: body.occasion,
      p_kind: body.kind,
      p_value: body.value,
      p_subject: body.subject,
      p_message: body.message,
      p_image_url: imageUrl,
      p_users: body.user_ids ?? null,
      p_starts: body.starts_at || null,
      p_expires: body.expires_at || null,
    });
    if (result.error)
      return json(
        req,
        {
          error:
            result.error.code === 'PGRST202'
              ? 'Najprije primijenite SQL nadogradnju 014.'
              : result.error.message,
        },
        400,
      );
    return json(req, { campaign_id: result.data, ...(await processPromotions(result.data)) });
  }
  if (action === 'process') {
    if (body.campaign_id && !uuid(body.campaign_id))
      return json(req, { error: 'Neispravna promocija.' }, 400);
    if (body.retry === true && !cron && body.campaign_id) {
      // An explicit administrator retry reuses the same delivery IDs and the
      // original idempotency window; it never restarts that time window.
      await checked(
        db
          .from('promotion_deliveries')
          .update({ status: 'pending', attempts: 0, last_error: null })
          .eq('campaign_id', body.campaign_id)
          .eq('status', 'failed')
          .gt('first_attempt_at', new Date(Date.now() - 23 * 3600000).toISOString()),
      );
    }
    return json(req, await processPromotions(body.campaign_id || null));
  }
  return json(req, { error: 'Nepoznata radnja' }, 400);
});
