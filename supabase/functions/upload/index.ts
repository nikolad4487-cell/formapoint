import { admin, checked, json, serve, user, uuid } from '../_shared/http.ts';
const formats: Record<string, { mime: string; magic?: number[] }> = {
  pdf: { mime: 'application/pdf', magic: [37, 80, 68, 70, 45] },
  png: { mime: 'image/png', magic: [137, 80, 78, 71, 13, 10, 26, 10] },
  jpg: { mime: 'image/jpeg', magic: [255, 216, 255] },
  jpeg: { mime: 'image/jpeg', magic: [255, 216, 255] },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    magic: [80, 75, 3, 4],
  },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    magic: [80, 75, 3, 4],
  },
  pptx: {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    magic: [80, 75, 3, 4],
  },
  doc: { mime: 'application/msword', magic: [208, 207, 17, 224, 161, 177, 26, 225] },
  xls: { mime: 'application/vnd.ms-excel', magic: [208, 207, 17, 224, 161, 177, 26, 225] },
  ppt: { mime: 'application/vnd.ms-powerpoint', magic: [208, 207, 17, 224, 161, 177, 26, 225] },
  txt: { mime: 'text/plain' },
};
serve(async (req) => {
  const u = await user(req);
  if (Number(req.headers.get('content-length') || 0) > 22000000)
    throw new Error('Prevelika datoteka');
  const form = await req.formData();
  const oid = form.get('order_id');
  const file = form.get('file');
  const kind = String(form.get('kind') || 'attachment');
  if (
    !uuid(oid) ||
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > 20971520 ||
    !['attachment', 'preview', 'final'].includes(kind)
  )
    throw new Error('Neispravna datoteka');
  const db = admin();
  const order = await checked(db.from('orders').select('user_id').eq('id', oid).single());
  const roles = await checked(db.from('user_roles').select('role').eq('user_id', u.id));
  const isAdmin = (roles || []).some((r) => r.role === 'ADMIN');
  if (!order) throw new Error('Narudžba ne postoji');
  if ((order.user_id !== u.id && !isAdmin) || (kind !== 'attachment' && !isAdmin))
    throw new Error('Nemate pristup');
  await checked(
    db.rpc('rate_limit', { k: `upload:${u.id}`, max_hits: isAdmin ? 500 : 20, seconds: 3600 }),
  );
  const ext = file.name.split('.').at(-1)?.toLowerCase() || '';
  const fmt = formats[ext];
  if (!fmt) throw new Error('Format nije dopušten');
  if (kind === 'preview' && !['png', 'jpg', 'jpeg'].includes(ext))
    throw new Error('Pregled mora biti zasebna slika rada.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (fmt.magic && !fmt.magic.every((v, i) => bytes[i] === v))
    throw new Error('Sadržaj se ne podudara s formatom');
  if (
    ext === 'txt' &&
    (bytes.includes(0) || new TextDecoder('utf-8', { fatal: true }).decode(bytes).length > 20971520)
  )
    throw new Error('Neispravan tekst');
  const path = `${oid}/${crypto.randomUUID()}.${ext}`;
  const safeName = file.name.replace(/[\x00-\x1f/\\<>:"|?*]/g, '_').slice(0, 150);
  await checked(
    db.storage.from('order-files').upload(path, bytes, { contentType: fmt.mime, upsert: false }),
  );
  const { data, error } = await db
    .from('order_files')
    .insert({
      order_id: oid,
      uploader_id: u.id,
      path,
      name: safeName,
      kind,
      size: file.size,
      scan_status: 'quarantined',
    })
    .select('id')
    .single();
  if (error) {
    await db.storage.from('order-files').remove([path]);
    throw error;
  }
  return json(req, {
    ok: true,
    file_id: data.id,
    message: 'Datoteka zaprimljena i čeka sigurnosnu provjeru.',
  });
});
