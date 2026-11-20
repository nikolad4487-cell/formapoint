import {randomBytes,randomInt,randomUUID} from 'node:crypto';
if(process.env.WEBMAILHR_PASSWORD_PROBE!=='1')process.exit(0);
const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
if(base!=='https://heseilggogbtmqeuwlku.supabase.co'||!key)throw new Error('Password probe configuration is unavailable.');
const email='webmailhr-password-probe-'+randomUUID()+'@example.invalid';
const initial=randomBytes(24).toString('base64url'),numeric=String(randomInt(10000000,100000000));
let id,cleaned=false;
async function request(path,method,body,token,admin=false){
 const response=await fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(12000),headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:admin&&key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>null);return {response,data};
}
try{
 const created=await request('/auth/v1/admin/users','POST',{email,password:initial,email_confirm:true,user_metadata:{first_name:'WebmailHR',last_name:'Verification',marketing_consent:false}},null,true);
 if(!created.response.ok||typeof created.data?.id!=='string')throw new Error('Password probe could not create its temporary account (HTTP '+created.response.status+').');
 id=created.data.id;
 const first=await request('/auth/v1/token?grant_type=password','POST',{email,password:initial});
 if(!first.response.ok||first.data?.user?.id!==id||!first.data.access_token)throw new Error('Password probe initial login failed.');
 const changed=await request('/auth/v1/user','PUT',{password:numeric,current_password:initial},first.data.access_token);
 if(!changed.response.ok||changed.data?.id!==id)throw new Error('Password probe: eight numeric characters rejected (HTTP '+changed.response.status+').');
 const next=await request('/auth/v1/token?grant_type=password','POST',{email,password:numeric});
 if(!next.response.ok||next.data?.user?.id!==id)throw new Error('Password probe: numeric password login failed.');
 const old=await request('/auth/v1/token?grant_type=password','POST',{email,password:initial});
 if(old.response.ok)throw new Error('Password probe: previous password was accepted.');
 console.log('FormaPoint: live eight-digit password change and login passed; previous password rejected.');
}finally{
 if(!id){
  const found=await request('/auth/v1/admin/users?page=1&per_page=100','GET',null,null,true);
  id=found.data?.users?.find(user=>user.email===email)?.id;
 }
 if(id){
  const removed=await request('/auth/v1/admin/users/'+encodeURIComponent(id),'DELETE',null,null,true);
  if(!removed.response.ok)throw new Error('Password probe temporary account cleanup failed (HTTP '+removed.response.status+').');
  cleaned=true;
 }
 console.log('FormaPoint: password probe temporary account cleanup '+(cleaned?'completed.':'not required.'));
}
