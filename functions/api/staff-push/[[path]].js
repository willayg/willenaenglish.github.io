// Willena Teachers Web Push. No service-role key. All device access is scoped
// to authenticated, approved staff; only admins may send test pushes to themselves.
const SUPABASE='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ORIGIN='https://teachers.willenaenglish.com';
const PUBLIC_VAPID='BAhm5cXChKsELu3bvXM50fATJ4843vk_K8snrIphP3E3II_YzvbLK05OOrVt1VXK8WX8HpV9KBnmJ2G1qeINEF8';
const textEncoder=new TextEncoder();
const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=v=>Uint8Array.from(atob(String(v).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(v).length/4)*4,'=')),x=>x.charCodeAt(0));
function concat(...parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length}return out}
async function db(token,path,method='GET',body){
 const result=await fetch(SUPABASE+'/rest/v1/'+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+token,'content-type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const json=await result.json().catch(()=>null);
 if(!result.ok){console.error('Willena Push DB',result.status,json?.code||'');throw Object.assign(new Error('Push database request failed ('+result.status+')'),{status:result.status===401||result.status===403?result.status:502})}
 return json;
}
async function identity(request){
 const tokens=[];
 const match=(request.headers.get('cookie')||'').match(/(?:^|;\s*)sb_access=([^;]+)/);
 if(match)try{tokens.push(decodeURIComponent(match[1]))}catch{}
 const bearer=(request.headers.get('authorization')||'').match(/^Bearer\s+(\S+)$/i);
 if(bearer&&!tokens.includes(bearer[1]))tokens.push(bearer[1]);
 for(const token of tokens){
  const auth=await fetch(SUPABASE+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+token},cache:'no-store'});
  if(!auth.ok)continue;
  const user=await auth.json().catch(()=>({}));if(!user.id)continue;
  const check=await db(token,'rpc/willena_is_approved_staff','POST',{});
  if(check!==true)return {error:'Approved staff access required',status:403};
  return {token,id:user.id};
 }
 return {error:'Please sign in to Willena Teachers',status:401};
}
function allowedEndpoint(value){
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return false;
  const h=u.hostname.toLowerCase();
  return h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||
   h==='web.push.apple.com'||h.endsWith('.push.apple.com')||
   h==='wns2-pn1p.notify.windows.com'||h.endsWith('.notify.windows.com');
 }catch{return false}
}
async function hkdf(input,salt,info,length){
 const key=await crypto.subtle.importKey('raw',input,'HKDF',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8));
}
async function vapidJwt(env,audience){
 const privateBytes=unb64(String(env.WILLENA_PUSH_VAPID_PRIVATE_KEY||'').trim());
 if(privateBytes.length!==32)throw new Error('Push signing key configuration invalid');
 const pub=unb64(PUBLIC_VAPID);
 const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:b64(pub.slice(1,33)),y:b64(pub.slice(33)),d:b64(privateBytes),ext:false}, {name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const head=b64(textEncoder.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const payload=b64(textEncoder.encode(JSON.stringify({aud:audience,exp:Math.floor(Date.now()/1000)+3600,sub:'mailto:willenaenglish@gmail.com'})));
 const jwt=head+'.'+payload;
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,textEncoder.encode(jwt));
 return jwt+'.'+b64(sig);
}
async function encryptPayload(sub,data){
 const clientPub=unb64(sub.p256dh),auth=unb64(sub.auth_secret);
 if(clientPub.length!==65||auth.length!==16)throw new Error('Stored subscription key invalid');
 const receiver=await crypto.subtle.importKey('raw',clientPub,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const senderKeys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const senderPub=new Uint8Array(await crypto.subtle.exportKey('raw',senderKeys.publicKey));
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:receiver},senderKeys.privateKey,256));
 const info=concat(textEncoder.encode('WebPush: info\0'),clientPub,senderPub);
 const ikm=await hkdf(shared,auth,info,32);
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const cek=await hkdf(ikm,salt,textEncoder.encode('Content-Encoding: aes128gcm\0'),16);
 const nonce=await hkdf(ikm,salt,textEncoder.encode('Content-Encoding: nonce\0'),12);
 const key=await crypto.subtle.importKey('raw',cek,{name:'AES-GCM'},false,['encrypt']);
 const message=concat(textEncoder.encode(JSON.stringify(data)),new Uint8Array([2]));
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,message));
 return concat(salt,new Uint8Array([0,0,16,0,65]),senderPub,encrypted);
}
async function deliver(env,sub,payload){
 const endpoint=new URL(sub.endpoint);
 const jwt=await vapidJwt(env,endpoint.origin);
 const bytes=await encryptPayload(sub,payload);
 const result=await fetch(sub.endpoint,{method:'POST',headers:{
  Authorization:'vapid t='+jwt+', k='+PUBLIC_VAPID,
  'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream','TTL':'300',
  'Urgency':'normal'
 },body:bytes});
 return {status:result.status,success:result.status===201||result.status===202,expired:result.status===404||result.status===410};
}
export async function onRequest({request,env}){
 try{
  const u=new URL(request.url);if(u.hostname!=='teachers.willenaenglish.com')return respond({error:'Host not permitted'},403);
  const part=u.pathname.replace(/^\/api\/staff-push\/?/,'').replace(/\/$/,'');
  if(!['GET','POST','DELETE'].includes(request.method))return respond({error:'Method not allowed'},405);
  if(request.method!=='GET'&&part!=='enquiry-event'&&part!=='reminder-event'&&request.headers.get('origin')!==ORIGIN)return respond({error:'Invalid request origin'},403);
  // New website enquiry: one-time short-lived database claim. No public caller
  // can enumerate devices or send arbitrary messages without the random token.
  if(part==='enquiry-event'&&request.method==='POST'){
   if(!env.WILLENA_PUSH_VAPID_PRIVATE_KEY)return respond({error:'Push signing not configured'},503);
   const data=await request.json().catch(()=>({}));
   if(!/^[a-f0-9-]{36}$/i.test(String(data.id||''))||!/^[a-f0-9-]{36}$/i.test(String(data.token||'')))return respond({error:'Invalid event'},400);
   const claim=await fetch(SUPABASE+'/rest/v1/rpc/willena_claim_enquiry_push',{
    method:'POST',headers:{apikey:KEY,'content-type':'application/json'},
    body:JSON.stringify({p_id:data.id,p_token:data.token}),cache:'no-store'
   });
   if(!claim.ok){console.error('Website enquiries push claim',claim.status);return respond({error:'Claim unavailable'},503)}
   const claimed=await claim.json().catch(()=>({}));
   if(!claimed.ok)return respond({error:'Event already processed or invalid'},409);
   const devices=Array.isArray(claimed.devices)?claimed.devices:[];
   const payload={title:'Willena · 새 상담 문의',body:'새로운 상담 문의가 접수되었습니다. 문의 관리에서 확인하세요.',url:'/Teachers/admin-v2/?view=enquiries',tag:'willena-new-enquiry-'+String(data.id)};
   const results=await Promise.allSettled(devices.filter(x=>allowedEndpoint(x.endpoint)).map(sub=>deliver(env,sub,payload)));
   const successful=results.filter(x=>x.status==='fulfilled'&&x.value.success).length;
   return respond({success:true,subscribed_devices:devices.length,delivered:successful});
  }
  if(part==='reminder-event'&&request.method==='POST'){
   if(!env.WILLENA_PUSH_VAPID_PRIVATE_KEY)return respond({error:'Push signing not configured'},503);
   const data=await request.json().catch(()=>({}));
   if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(data.id||''))||
      !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(data.token||'')))return respond({error:'Invalid reminder'},400);
   // A random one-time secret, issued by the scheduled database job, is
   // consumed atomically. Public callers cannot choose recipients or content.
   const claim=await fetch(SUPABASE+'/rest/v1/rpc/willena_claim_calendar_reminder',{
    method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_id:data.id,p_token:data.token}),cache:'no-store'
   });
   if(!claim.ok){console.error('Calendar reminder claim',claim.status);return respond({error:'Reminder claim unavailable'},503)}
   const claimed=await claim.json().catch(()=>({}));
   if(claimed.ok!==true)return respond({error:'Reminder unavailable or already sent'},409);
   const recipients=Array.isArray(claimed.devices)?claimed.devices.filter(x=>allowedEndpoint(x.endpoint)):[];
   const payload={
    title:'Willena Calendar · '+String(claimed.title||'Event').slice(0,100),
    body:'Starts in '+Number(claimed.minutes||5)+' minutes · '+String(claimed.event_time||'')+' · '+String(claimed.event_date||''),
    url:'/Teachers/?view=staff-calendar',tag:'willena-reminder-'+String(data.id)
   };
   const results=await Promise.allSettled(recipients.map(sub=>deliver(env,sub,payload)));
   const accepted=results.filter(x=>x.status==='fulfilled'&&x.value.success).length;
   console.log('Willena reminder',data.id,'accepted',accepted,'of',recipients.length);
   return respond({success:true,devices:recipients.length,accepted});
  }
  const staff=await identity(request);if(staff.error)return respond({error:staff.error},staff.status);
  if(part==='status'&&request.method==='GET'){
   const devices=await db(staff.token,'willena_push_subscriptions?select=endpoint,device_label,created_at,updated_at&order=updated_at.desc&limit=30');
   const admin=await db(staff.token,'rpc/willena_push_is_admin','POST',{});
   return respond({supported:true,configured:!!env.WILLENA_PUSH_VAPID_PRIVATE_KEY,publicKey:PUBLIC_VAPID,admin:admin===true,devices:devices.map(x=>({endpoint:x.endpoint,device_label:x.device_label,updated_at:x.updated_at}))});
  }
  if(part==='subscribe'&&request.method==='POST'){
   if(!env.WILLENA_PUSH_VAPID_PRIVATE_KEY)return respond({error:'Push service not yet configured by admin'},503);
   const body=await request.json().catch(()=>({}));
   const endpoint=String(body.endpoint||''),p256dh=String(body.keys?.p256dh||''),auth=String(body.keys?.auth||'');
   if(!allowedEndpoint(endpoint)||!/^[-_A-Za-z0-9]{80,160}$/.test(p256dh)||!/^[-_A-Za-z0-9]{16,60}$/.test(auth))return respond({error:'Invalid push device subscription'},400);
   await db(staff.token,'rpc/willena_push_register','POST',{p_endpoint:endpoint,p_p256dh:p256dh,p_auth_secret:auth,p_device_label:String(body.device_label||'').slice(0,180)});
   return respond({success:true});
  }
  if(part==='unsubscribe'&&request.method==='POST'){
   const body=await request.json().catch(()=>({}));
   const endpoint=String(body.endpoint||'');
   if(!allowedEndpoint(endpoint))return respond({error:'Invalid device'},400);
   await db(staff.token,'willena_push_subscriptions?endpoint=eq.'+encodeURIComponent(endpoint),'DELETE');
   return respond({success:true});
  }
  if(part==='test'&&request.method==='POST'){
   const admin=await db(staff.token,'rpc/willena_push_is_admin','POST',{});
   if(admin!==true)return respond({error:'Admin access required'},403);
   if(!env.WILLENA_PUSH_VAPID_PRIVATE_KEY)return respond({error:'Cloudflare WILLENA_PUSH_VAPID_PRIVATE_KEY secret is missing'},503);
   const records=await db(staff.token,'willena_push_subscriptions?select=endpoint,p256dh,auth_secret&limit=20');
   if(!records.length)return respond({error:'Enable notifications on this device first'},409);
   const body=await request.json().catch(()=>({}));
   const match=String(body.endpoint||'');
   const targets=records.filter(x=>x.endpoint===match);
   if(targets.length!==1)return respond({error:'The selected device is not registered to your account'},404);
   if(!allowedEndpoint(targets[0].endpoint))return respond({error:'Invalid subscription endpoint'},400);
   const result=await deliver(env,targets[0],{title:'Willena Teachers',body:'Test notification delivered from Willena.',url:'/Teachers/?view=staff-calendar',tag:'willena-push-test'});
   if(result.expired)await db(staff.token,'willena_push_subscriptions?endpoint=eq.'+encodeURIComponent(targets[0].endpoint),'DELETE');
   if(!result.success)return respond({error:result.expired?'Device subscription expired; enable notifications again':'Push service returned '+result.status},502);
   return respond({success:true,provider_status:result.status});
  }
  return respond({error:'Not found'},404);
 }catch(err){console.error('Willena push',err.message);return respond({error:err.message||'Push unavailable'},err.status||502)}
}


// Invoked only by the authenticated native calendar API after a successful
// event save. The database claim makes one dispatch per saved revision.
export async function queueCalendarEventPush(env,token,event){
 if(!env.WILLENA_PUSH_VAPID_PRIVATE_KEY)throw new Error('Cloudflare push signing secret is not configured');
 const devices=await db(token,'rpc/willena_claim_calendar_push','POST',{p_event_id:event.id});
 const list=Array.isArray(devices)?devices.filter(x=>allowedEndpoint(x.endpoint)):[];
 if(!list.length)return {devices:0,accepted:0,errors:['No registered staff devices found (or this event revision was already notified).']};
 const date=String(event.event_date||'').slice(0,10);
 const time=event.event_time?String(event.event_time).slice(0,5):'';
 const payload={
  title:'Willena Calendar · '+String(event.title||'Event').slice(0,100),
  body:'New calendar event: '+date+(time?' at '+time:'')+(event.notes?' · '+String(event.notes).slice(0,90):''),
  url:'/Teachers/?view=staff-calendar',
  tag:'willena-calendar-'+event.id+'-'+String(event.updated_at||Date.now())
 };
 // Wait for provider acknowledgements, so the event form does not falsely say
 // notification queued when all endpoints rejected the message.
 const results=await Promise.allSettled(list.map(sub=>deliver(env,sub,payload)));
 const accepted=results.filter(x=>x.status==='fulfilled'&&x.value.success).length;
 const errors=results.filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||x.reason).slice(0,140))
  .concat(results.filter(x=>x.status==='fulfilled'&&!x.value.success).map(x=>'Push provider HTTP '+x.value.status));
 console.log('Willena Calendar push',event.id,'accepted',accepted,'of',list.length,errors.slice(0,4).join('; '));
 return {devices:list.length,accepted,errors:errors.slice(0,3)};
}
