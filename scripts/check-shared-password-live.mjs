import {randomBytes,randomInt,randomUUID} from 'node:crypto';
if(process.env.WEBMAILHR_PASSWORD_PROBE!=='1')process.exit(0);
const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
if(base!=='https://heseilggogbtmqeuwlku.supabase.co'||!key)throw new Error('Password probe configuration is unavailable.');
const email='webmailhr-password-probe-'+randomUUID()+'@example.invalid';
const initial=randomBytes(24).toString('base64url'),candidate=String.fromCharCode(97+randomInt(26))+String.fromCharCode(65+randomInt(26))+Array.from({length:5},()=> 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[randomInt(62)]).join('')+String(randomInt(10));
let id,cleaned=false;
async function request(path,method,body,token,admin=false){
 const response=await fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(12000),headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:admin&&key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>null);return {response,data};
}
async function removeProbe(userId){
 if(!/^[a-f0-9-]{36}$/.test(userId))throw new Error('Invalid temporary account identifier.');
 // on_signup inserts this row with a restrictive auth.users FK (not CASCADE).
 const preferences=await request('/rest/v1/notification_preferences?user_id=eq.'+encodeURIComponent(userId),'DELETE',null,null,true);
 if(!preferences.response.ok)throw new Error('Password probe preference cleanup failed (HTTP '+preferences.response.status+').');
 const removed=await request('/auth/v1/admin/users/'+encodeURIComponent(userId),'DELETE',null,null,true);
 if(!removed.response.ok)throw new Error('Password probe temporary account cleanup failed (HTTP '+removed.response.status+').');
}
try{
 const previous=await request('/auth/v1/admin/users?page=1&per_page=100','GET',null,null,true);
 for(const account of previous.data?.users||[]){
  if(/^webmailhr-password-probe-[a-f0-9-]{36}@example\.invalid$/.test(account.email||'')&&account.user_metadata?.first_name==='WebmailHR'&&account.user_metadata?.last_name==='Verification')await removeProbe(account.id);
 }
 const created=await request('/auth/v1/admin/users','POST',{email,password:initial,email_confirm:true,user_metadata:{first_name:'WebmailHR',last_name:'Verification',marketing_consent:false}},null,true);
 if(!created.response.ok||typeof (created.data?.user??created.data)?.id!=='string')throw new Error('Password probe could not create its temporary account (HTTP '+created.response.status+').');
 id=(created.data.user??created.data).id;
 const first=await request('/auth/v1/token?grant_type=password','POST',{email,password:initial});
 if(!first.response.ok||first.data?.user?.id!==id||!first.data.access_token)throw new Error('Password probe initial login failed.');
 let chosen=candidate;
 let changed=await request('/auth/v1/user','PUT',{password:chosen,current_password:initial},first.data.access_token);
 if(!changed.response.ok){
  const code=String(changed.data?.error_code||changed.data?.code||'').replace(/[^a-zA-Z0-9_]/g,'');
  const detail=String(changed.data?.msg||changed.data?.message||'').split(initial).join('[redacted]').split(candidate).join('[redacted]').replace(/[\r\n]/g,' ').slice(0,300);
  console.log('FormaPoint: eight-character mixed-case/digit policy rejected HTTP '+changed.response.status+' code='+code+' detail='+detail);
  chosen='Aa1!'+randomBytes(12).toString('hex');
  changed=await request('/auth/v1/user','PUT',{password:chosen,current_password:initial},first.data.access_token);
 }
 if(!changed.response.ok||(changed.data?.user??changed.data)?.id!==id)throw new Error('Password probe source update failed (HTTP '+changed.response.status+').');
 const next=await request('/auth/v1/token?grant_type=password','POST',{email,password:chosen});
 if(!next.response.ok||next.data?.user?.id!==id)throw new Error('Password probe: updated password login failed.');
 const old=await request('/auth/v1/token?grant_type=password','POST',{email,password:initial});
 if(old.response.ok)throw new Error('Password probe: previous password was accepted.');
 console.log(chosen===candidate?'FormaPoint: live eight-character mixed-case/digit password change and login passed; previous password rejected.':'FormaPoint: source password change and login passed with stronger password; eight-character mixed-case/digit policy requires adjustment.');
}catch(error){
 console.error(error instanceof Error?error.message:'Password probe failed.');throw error;
}finally{
 if(!id){
  const found=await request('/auth/v1/admin/users?page=1&per_page=100','GET',null,null,true);
  id=found.data?.users?.find(user=>user.email===email)?.id;
 }
 if(id){
  await removeProbe(id);
  cleaned=true;
 }
 console.log('FormaPoint: password probe temporary account cleanup '+(cleaned?'completed.':'not required.'));
}
