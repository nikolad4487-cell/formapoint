import { admin, checked, env, json, serve, user, uuid } from '../_shared/http.ts';
serve(async (req) => {
  const { id } = await req.json();
  if (!uuid(id)) throw new Error('InvalidId');
  const db = admin();
  const item = await checked(db.from('portfolio_items').select('*').eq('id', id).single());
  if (!item.published || !item.publication_rights || item.scan_status !== 'clean') {
    const u = await user(req);
    const roles = await checked(
      db.from('user_roles').select('role').eq('user_id', u.id).eq('role', 'ADMIN'),
    );
    if (!roles?.length) return json(req, { error: 'Nedopušten pristup' }, 403);
  }
  if (!item.file_path) throw new Error('MissingFile');
  const signed = await checked(
    db.storage.from('portfolio-files').createSignedUrl(item.file_path, 60),
  );
  if (!signed) throw new Error('MissingSignedUrl');
  const url = new URL(signed.signedUrl);
  const external = Deno.env.get('PUBLIC_SUPABASE_URL');
  if (external) {
    const target = new URL(external);
    url.protocol = target.protocol;
    url.host = target.host;
  } else {
    env('SUPABASE_URL');
  }
  return json(req, { url: url.toString() });
});
