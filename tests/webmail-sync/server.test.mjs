import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import handler,{inspectRegistration} from '../../api/webmail-sync.js';
const secret='local-webmail-sync-shared-secret-0123456789';
Object.assign(process.env,{NODE_ENV:'test',SUPABASE_URL:'https://source-test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-key-must-stay-private',WEBMAILHR_SYNC_SECRET:secret});
const user={id:'a22f722c-62b7-42eb-ab97-5dca30b91c98',email:'alice@example.test',email_confirmed_at:'2026-01-01',is_anonymous:false,user_metadata:{first_name:'Alice',last_name:'Test',role:'ADMIN'}};
const originalFetch=globalThis.fetch;afterEach(()=>{globalThis.fetch=originalFetch;});
async function call({token='valid-user-token',body={},origin='https://formapoint.online',method='POST'}={}){
  let output;const headers={};const res={setHeader:(key,value)=>headers[key]=value,end:raw=>output=JSON.parse(raw)};
  await handler({method,body,headers:{...(origin?{origin}:{}),...(token?{authorization:'Bearer '+token}:{})}},res);return {status:res.statusCode,body:output,headers};
}
function mock({account=user,users,upstreamStatus=200}={}){
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url:String(url),options});
    if(String(url).startsWith('https://source-test.supabase.co/')){
      assert.equal(options.headers.apikey,'server-key-must-stay-private');
      if(String(url).includes('/admin/users'))return Response.json({users:users??[user]});
      assert.equal(options.headers.Authorization,'Bearer valid-user-token');return Response.json(account);
    }
    assert.equal(url,'https://webmailhr.com/api/integrations/formapoint/provision');
    assert.equal(options.headers.Authorization,undefined);
    const raw=options.body,hash=createHash('sha256').update(raw).digest('hex');assert.equal(options.headers['X-Webmail-Sync-Hash'],hash);
    assert.equal(options.headers['X-Webmail-Sync-Signature'],createHmac('sha256',secret).update(options.headers['X-Webmail-Sync-Timestamp']+'\n'+hash).digest('hex'));
    assert.ok(!raw.includes('server-key'));assert.ok(!raw.includes('valid-user-token'));
    if(upstreamStatus!==200)return new Response('PRIVATE UPSTREAM DETAILS',{status:upstreamStatus});
    const data=JSON.parse(raw);return Response.json({ok:true,results:data.users.map(p=>({sourceId:p.id,address:'alice.123456789abcdef0@formapoint.online',status:'created'}))});
  };return calls;
}
test('Own verified session provisions only its live source identity without trusting metadata roles',async()=>{
  const calls=mock();const r=await call();assert.equal(r.status,200);assert.equal(r.body.address,'alice.123456789abcdef0@formapoint.online');
  const forwarded=JSON.parse(calls[1].options.body);assert.equal(forwarded.project,'source-test');assert.deepEqual(forwarded.users,[{id:user.id,email:user.email,name:'Alice Test',confirmed:true,anonymous:false}]);
  assert.equal(r.headers['Cache-Control'],'no-store');
});
test('Unauthenticated, cross-origin, guest and unconfirmed calls cannot provision',async()=>{
  const calls=mock();assert.equal((await call({token:null})).status,401);assert.equal((await call({origin:'https://evil.test'})).status,403);assert.equal(calls.length,0);
  for(const account of [{...user,is_anonymous:true},{...user,email_confirmed_at:null},{...user,banned_until:'2099-01-01'}]){
    const recorded=mock({account});assert.equal((await call()).status,403);assert.equal(recorded.length,1);
  }
});
test('Browser users cannot request other identities, import, setup or use service secret',async()=>{
  const calls=mock();for(const body of [{users:[user]},{mode:'setup'},{mode:'import',page:1}])assert.equal((await call({body})).status,400);
  assert.equal((await call({token:secret,body:{mode:'setup'}})).status,403);assert.equal(calls.length,0);
});
test('Protected server setup and import filter accounts and report pagination',async()=>{
  const users=Array.from({length:10},(_,i)=>i<2?user:{...user,is_anonymous:true});const calls=mock({users});
  assert.equal((await call({token:secret,origin:null,body:{mode:'setup'}})).status,200);assert.equal(JSON.parse(calls[0].options.body).setup,true);
  const r=await call({token:secret,origin:null,body:{mode:'import',page:1}});assert.equal(r.status,200);assert.equal(r.body.created,2);assert.equal(r.body.skipped,8);assert.equal(r.body.nextPage,2);
  assert.match(calls[1].url,/page=1&per_page=10$/);
});
test('Upstream failures are retryable and never expose source responses or server keys',async()=>{
  mock({upstreamStatus:500});const r=await call();assert.equal(r.status,503);assert.ok(!JSON.stringify(r).includes('PRIVATE'));assert.ok(!JSON.stringify(r).includes('server-key'));
  assert.equal((await call({method:'GET'})).status,405);
});

test('A temporary receiver failure retries the same verified identity and succeeds',async()=>{
 mock();const normal=globalThis.fetch;const forwards=[];
 globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('https://webmailhr.com/')){forwards.push(options.body);if(forwards.length===1)return new Response('{}',{status:503});}
  return normal(url,options);
 };
 const result=await call();assert.equal(result.status,200);assert.equal(forwards.length,2);assert.equal(forwards[0],forwards[1]);
});
test('Targeted registration inspection never forwards unconfirmed accounts or other users',async()=>{
 for(const confirmed of [true,false]){
  const selected={...user,email_confirmed_at:confirmed?'2026-01-01':null};
  const calls=mock({users:[{...user,id:'b22f722c-62b7-42eb-ab97-5dca30b91c98',email:'other@example.test'},selected]});
  const result=await inspectRegistration(user.email,true);assert.equal(result.found,true);assert.equal(result.confirmed,confirmed);
  const forwarded=calls.filter(c=>c.url.startsWith('https://webmailhr.com/'));
  assert.equal(forwarded.length,confirmed?1:0);
  if(confirmed)assert.deepEqual(JSON.parse(forwarded[0].options.body).users.map(u=>u.email),[user.email]);
 }
});
