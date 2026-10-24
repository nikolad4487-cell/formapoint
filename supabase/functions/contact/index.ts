import { admin, checked, json, serve } from '../_shared/http.ts';
import { z } from 'npm:zod@4.1.12';
serve(async (req) => {
  const value = z
    .object({
      name: z.string().trim().min(2).max(150),
      email: z.email().max(254),
      body: z.string().trim().min(10).max(5000),
      website: z.string().max(0),
    })
    .parse(await req.json());
  const address = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!address) throw new Error('Nije moguće provjeriti izvor zahtjeva');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
  const client = Array.from(new Uint8Array(hash))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
  await checked(
    admin().rpc('submit_contact', {
      p_name: value.name,
      p_email: value.email,
      p_body: value.body,
      p_client: client,
    }),
  );
  return json(req, { ok: true });
});
