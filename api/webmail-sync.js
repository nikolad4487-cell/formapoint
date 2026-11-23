import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const batchSize = 10;
class SyncError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function settings() {
  const secret = process.env.WEBMAILHR_SYNC_SECRET?.trim();
  const url = new URL(process.env.SUPABASE_URL || '');
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (
    !secret ||
    secret.length < 32 ||
    !key ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === 'https:' ||
      (process.env.NODE_ENV === 'test' && url.hostname === '127.0.0.1')
    )
  )
    throw new SyncError(503, 'Povezivanje sandučića nije konfigurirano.');
  const target =
    process.env.WEBMAILHR_PROVISION_URL ||
    'https://webmailhr.com/api/integrations/formapoint/provision';
  if (target !== 'https://webmailhr.com/api/integrations/formapoint/provision')
    throw new SyncError(503, 'Povezivanje sandučića nije konfigurirano.');
  return {
    secret,
    url,
    key,
    target,
    project: process.env.WEBMAILHR_SOURCE_PROJECT || url.hostname.split('.')[0],
  };
}
function sameSecret(value, expected) {
  const a = Buffer.from(value),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function eligible(user) {
  return (
    typeof user?.id === 'string' &&
    /^[0-9a-f-]{36}$/i.test(user.id) &&
    typeof user.email === 'string' &&
    /^[^\s<>@]+@[^\s<>@]+$/.test(user.email) &&
    user.email_confirmed_at &&
    !user.is_anonymous &&
    !(user.banned_until && Date.parse(user.banned_until) > Date.now())
  );
}
function person(user) {
  const meta = user.user_metadata || {};
  const full =
    meta.full_name ||
    meta.name ||
    [meta.first_name, meta.last_name].filter((x) => typeof x === 'string').join(' ') ||
    user.email;
  return {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    name: String(full).trim().slice(0, 240) || user.email,
    confirmed: true,
    anonymous: false,
  };
}
async function authGet(config, path, token) {
  const response = await fetch(new URL(path, config.url), {
    headers: {
      apikey: config.key,
      ...(token
        ? { Authorization: 'Bearer ' + token }
        : config.key.startsWith('eyJ')
          ? { Authorization: 'Bearer ' + config.key }
          : {}),
    },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if ([400, 401, 403].includes(response.status)) throw new SyncError(401, 'Prijava nije valjana.');
  if (!response.ok) throw new SyncError(503, 'Izvor korisnika trenutačno nije dostupan.');
  return response.json();
}
async function forward(config, users, setup = false, includeDelivery = false) {
  const body = JSON.stringify({ project: config.project, setup, users });
  const timestamp = String(Date.now()),
    hash = createHash('sha256').update(body).digest('hex');
  const signature = createHmac('sha256', config.secret)
    .update(timestamp + '\n' + hash)
    .digest('hex');
  let response;
  // Provisioning and welcome claims are idempotent by verified source UUID.
  // Retry one temporary failure, including a lost response after a committed write.
  for(let attempt=0;attempt<2;attempt++){
    try{
      response = await fetch(config.target, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      'X-Webmail-Sync-Timestamp': timestamp,
      'X-Webmail-Sync-Hash': hash,
      'X-Webmail-Sync-Signature': signature,
    },
    body,
  });
      if(![429,500,502,503,504].includes(response.status)||attempt===1)break;
    }catch{
      if(attempt===1)throw new SyncError(503,'Sandučić trenutačno nije moguće povezati.');
    }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  if (!response.ok) throw new SyncError(503, 'Sandučić trenutačno nije moguće povezati.');
  const result = await response.json();
  if (result?.ok !== true || !Array.isArray(result.results))
    throw new SyncError(503, 'Potvrda povezivanja nije dostupna.');
  return includeDelivery ? {results:result.results,welcomes:result.welcomes} : result.results;
}
// Server-only operator repair: inspect one named account without exposing Auth keys.
export async function inspectRegistration(email,apply=false){
 const config=settings();
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY&&!process.env.SUPABASE_SECRET_KEY)throw new SyncError(503,'Serverski pristup nije dostupan.');
 if(typeof email!=='string'||! /^[^\s<>@]+@[^\s<>@]+$/.test(email))throw new SyncError(400,'Neispravna adresa.');
 for(let page=1;page<=100;page++){
  const data=await authGet(config,`/auth/v1/admin/users?page=${page}&per_page=50`);
  if(!Array.isArray(data.users))throw new SyncError(503,'Izvor nije dostupan.');
  const matches=data.users.filter(u=>u.email?.toLowerCase()===email.toLowerCase());
  if(matches.length>1)throw new SyncError(409,'Više izvornih računa.');
  if(matches.length){const user=matches[0];return {found:true,confirmed:!!user.email_confirmed_at,eligible:!!eligible(user),...(apply&&eligible(user)?await forward(config,[person(user)],false,true):{})};}
  if(data.users.length<50)return {found:false};
 }
 throw new SyncError(503,'Previše stranica za ovu provjeru.');
}
async function bodyOf(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      if (req.body.length > 1024) throw new SyncError(413, 'Prevelik zahtjev.');
      return JSON.parse(req.body);
    }
    if (Buffer.isBuffer(req.body)) {
      if (req.body.length > 1024) throw new SyncError(413, 'Prevelik zahtjev.');
      return JSON.parse(req.body.toString());
    }
    return req.body;
  }
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1024) throw new SyncError(413, 'Prevelik zahtjev.');
  }
  return body ? JSON.parse(body) : {};
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, body) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(405, { error: 'Metoda nije dopuštena.' });
  }
  try {
    const config = settings();
    const origin = req.headers.origin;
    if (
      origin &&
      !['https://formapoint.online', 'https://www.formapoint.online'].includes(origin) &&
      !(process.env.NODE_ENV === 'test' && origin.startsWith('http://127.0.0.1:'))
    )
      throw new SyncError(403, 'Izvor nije dopušten.');
    const authorization = req.headers.authorization || '';
    if (!authorization.startsWith('Bearer ') || authorization.length > 8192)
      throw new SyncError(401, 'Prijavite se.');
    const token = authorization.slice(7);
    const body = await bodyOf(req);
    if (sameSecret(token, config.secret)) {
      if (origin) throw new SyncError(403, 'Servisni uvoz nije dostupan pregledniku.');
      if (body.mode === 'setup') {
        await forward(config, [], true);
        return send(200, { ok: true });
      }
      if (
        body.mode !== 'import' ||
        !Number.isSafeInteger(body.page) ||
        body.page < 1 ||
        body.page > 100000
      )
        throw new SyncError(400, 'Neispravan uvoz.');
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SECRET_KEY)
        throw new SyncError(503, 'Serverski pristup uvozu nije dostupan.');
      const data = await authGet(
        config,
        `/auth/v1/admin/users?page=${body.page}&per_page=${batchSize}`,
      );
      if (!Array.isArray(data.users))
        throw new SyncError(503, 'Izvor korisnika trenutačno nije dostupan.');
      const users = data.users.filter(eligible).map(person),
        results = await forward(config, users);
      return send(200, {
        ok: true,
        accounts: data.users.length,
        eligible: users.length,
        skipped: data.users.length - users.length,
        created: results.filter((r) => r.status === 'created').length,
        existing: results.filter((r) => r.status === 'existing').length,
        needsActivation: results.filter((r) => r.status === 'needs_activation').length,
        conflicts: results.filter((r) => r.status === 'conflict').length,
        nextPage: data.users.length === batchSize ? body.page + 1 : null,
        results,
      });
    }
    if (Object.keys(body).length)
      throw new SyncError(400, 'Osobni zahtjev ne prihvaća korisničke identitete.');
    const user = await authGet(config, '/auth/v1/user', token);
    if (!eligible(user)) throw new SyncError(403, 'Potreban je potvrđen korisnički račun.');
    const results = await forward(config, [person(user)]),
      result = results.find((r) => r.sourceId === user.id);
    if (
      !result ||
      !['created', 'existing'].includes(result.status) ||
      typeof result.address !== 'string'
    )
      throw new SyncError(409, 'Administrator treba dovršiti povezivanje sandučića.');
    return send(200, {
      address: result.address,
      status: result.status,
      loginUrl: 'https://webmailhr.com',
    });
  } catch (error) {
    return send(error instanceof SyncError ? error.status : 503, {
      error: error instanceof SyncError ? error.message : 'Sandučić trenutačno nije dostupan.',
    });
  }
}
