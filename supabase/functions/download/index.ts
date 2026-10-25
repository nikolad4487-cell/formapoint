import { admin, checked, json, serve, user, uuid } from '../_shared/http.ts';
serve(async (req) => {
  const u = await user(req);
  const { file_id, action } = await req.json();
  const preview = action === 'preview';
  if (!uuid(file_id)) throw new Error('Neispravan zahtjev');
  const db = admin();
  const file = await checked(db.from('order_files').select('*').eq('id', file_id).single());
  const order = await checked(db.from('orders').select('*').eq('id', file.order_id).single());
  const roles = await checked(db.from('user_roles').select('role').eq('user_id', u.id));
  const isAdmin = (roles || []).some((r) => r.role === 'ADMIN');
  if (order.user_id !== u.id && !isAdmin) throw new Error('Nedopušten pristup');
  if (file.scan_status !== 'clean') throw new Error('Datoteka čeka sigurnosnu provjeru');
  if (
    file.kind === 'final' &&
    !isAdmin &&
    (!order.total_cents || order.paid_cents < order.total_cents)
  )
    return json(req, { error: 'Završna datoteka zaključana je do potvrde cijele uplate.' }, 403);
  if (preview && file.kind !== 'preview')
    return json(req, { error: 'Za pregled otvorite zaseban pregled rada.' }, 403);
  if (!isAdmin && file.kind === 'preview' && !preview)
    return json(req, { error: 'Pregled rada dostupan je kroz preglednik.' }, 403);
  const signed = await checked(
    db.storage
      .from('order-files')
      .createSignedUrl(file.path, 60, preview ? undefined : { download: file.name }),
  );
  await checked(
    db
      .from('audit_logs')
      .insert({
        actor_id: u.id,
        action: preview ? 'file.preview' : 'file.download',
        entity_id: file.id,
      }),
  );
  if (!signed) throw new Error('Poveznica nije kreirana');
  const signedUrl = new URL(signed.signedUrl);
  const publicOrigin = Deno.env.get('PUBLIC_SUPABASE_URL');
  if (publicOrigin) {
    const base = new URL(publicOrigin);
    if (base.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(base.hostname))
      throw new Error('Neispravna javna adresa');
    signedUrl.protocol = base.protocol;
    signedUrl.host = base.host;
  }
  return json(req, { url: signedUrl.toString() });
});
