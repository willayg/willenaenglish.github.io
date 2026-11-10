// Google Calendar bridge for native Willena Staff Calendar.
// Staff access verified with same Supabase JWT as Teachers Dashboard.
// Google OAuth refresh token is encrypted and accessible only to server-side service role.
const SUPABASE='https://fiieuiktlsivwfgyivai.supabase.co';
const PUBKEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ORIGIN='https://teachers.willenaenglish.com';
const CALLBACK=ORIGIN+'/api/staff-calendar/callback';
const GOOGLE='https://www.googleapis.com/calendar/v3';
const TABLE='staff_calendar_google_connection';
const respond=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const pad=n=>String(n).padStart(2,'0');
function dateOk(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v}
function b64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64(text){const v=text.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(v.padEnd(Math.ceil(v.length/4)*4,'=')),ch=>ch.charCodeAt(0))}
const utf8=new TextEncoder();
async function secretKey(env){const digest=await crypto.subtle.digest('SHA-256',utf8.encode(env.GOOGLE_CLIENT_SECRET));return crypto.subtle.importKey('raw',digest,{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function encrypt(env,value){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await secretKey(env),utf8.encode(value));return {refresh_cipher:b64(cipher),refresh_iv:b64(iv)}}
async function decrypt(env,record){const cipher=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(record.refresh_iv)},await secretKey(env),unb64(record.refresh_cipher));return new TextDecoder().decode(cipher)}
async function signingKey(env){return crypto.subtle.importKey('raw',utf8.encode(env.GOOGLE_CLIENT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function makeState(env,uid){const data=b64(utf8.encode(JSON.stringify({uid,nonce:b64(crypto.getRandomValues(new Uint8Array(24))),exp:Date.now()+600000})));const sig=b64(await crypto.subtle.sign('HMAC',await signingKey(env),utf8.encode(data)));return data+'.'+sig}
async function readState(env,raw){const parts=String(raw||'').split('.');if(parts.length!==2||parts[0].length>1000)return null;let ok=false;try{ok=await crypto.subtle.verify('HMAC',await signingKey(env),unb64(parts[1]),utf8.encode(parts[0]))}catch{}if(!ok)return null;try{const p=JSON.parse(new TextDecoder().decode(unb64(parts[0])));return p.uid&&p.nonce&&p.exp>Date.now()?p:null}catch{return null}}
function cookie(raw,age){return 'willena_calendar_state='+raw+'; Path=/api/staff-calendar; Secure; HttpOnly; SameSite=Lax; Max-Age='+age}
function config(env){return ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','SUPABASE_SERVICE_ROLE_KEY'].filter(n=>!env[n])}
async function db(env,route,method='GET',body,prefer='return=representation'){
 const r=await fetch(SUPABASE+'/rest/v1/'+route,{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await r.json().catch(()=>null);
 if(!r.ok){console.error('google calendar storage',r.status,data?.code||'');throw Error('Google calendar storage request failed ('+r.status+')')}return data
}
async function approvedStaff(req,env){
 const candidates=[],m=(req.headers.get('cookie')||'').match(/(?:^|;\s*)sb_access=([^;]+)/);
 if(m)try{candidates.push(decodeURIComponent(m[1]))}catch{}
 const bearer=(req.headers.get('authorization')||'').match(/^Bearer\s+(\S+)$/i);
 if(bearer&&!candidates.includes(bearer[1]))candidates.push(bearer[1]);
 for(const token of candidates){
  const r=await fetch(SUPABASE+'/auth/v1/user',{headers:{apikey:PUBKEY,Authorization:'Bearer '+token},cache:'no-store'});
  if(!r.ok)continue;const identity=await r.json().catch(()=>({}));if(!identity.id)continue;
  const role=await db(env,'profiles?select=role,approved&id=eq.'+encodeURIComponent(identity.id)+'&limit=1');
  const p=role?.[0];if(p?.approved===true&&['admin','teacher'].includes(String(p.role||'').toLowerCase()))return {id:identity.id,admin:String(p.role).toLowerCase()==='admin'};
  return {error:'Approved teacher or admin access required',status:403};
 }
 return {error:'Dashboard session could not be verified. Refresh the Teachers Dashboard.',status:401};
}
async function connection(env){const rows=await db(env,TABLE+'?select=*&id=eq.1&limit=1');return rows[0]||null}
async function saveConnection(env,calendarId,refreshToken,uid){const encrypted=await encrypt(env,refreshToken);await db(env,TABLE+'?on_conflict=id','POST',{id:1,calendar_id:calendarId,...encrypted,connected_by:uid,updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=representation')}
async function google(token,route,method='GET',body){
 const response=await fetch(GOOGLE+route,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 if(response.status===204)return {ok:true};
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(json.error?.message||'Google Calendar API error ('+response.status+')'),{status:502});
 return json;
}
async function access(env,record){
 const form=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:await decrypt(env,record),grant_type:'refresh_token'});
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});
 const json=await r.json().catch(()=>({}));if(!r.ok||!json.access_token)throw Error('Google authorization expired or revoked. An admin must reconnect.');
 return json.access_token;
}
function koreaDate(iso){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso))}
function koreaTime(iso){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso))}
function normalizeEvent(e){
 const d=e.start?.date||koreaDate(e.start?.dateTime||new Date().toISOString());
 return {id:e.id,title:e.summary||'(Untitled)',event_date:d,event_time:e.start?.dateTime?koreaTime(e.start.dateTime):null,category:e.extendedProperties?.private?.willena_category||'events',repeat_rule:'none',notes:e.description||'',google_event_id:e.id,recurring_event_id:e.recurringEventId||null,html_link:e.htmlLink||null};
}
function validEvent(body){
 const title=String(body.title||'').trim(),date=String(body.date||''),time=String(body.time||''),category=String(body.category||'events'),repeat=String(body.repeat||'none'),notes=String(body.notes||'').trim();
 if(title.length<1||title.length>120||!dateOk(date)||time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!['events','staff','academic','deadline'].includes(category)||!['none','weekly','monthly'].includes(repeat)||notes.length>1200)throw Object.assign(new Error('Invalid event details'),{status:400});
 const following=new Date(date+'T12:00:00Z');following.setUTCDate(following.getUTCDate()+1);const dayAfter=following.toISOString().slice(0,10);
 const start=time?{dateTime:date+'T'+time+':00+09:00',timeZone:'Asia/Seoul'}:{date};
 const hour=time?new Date(Date.parse(date+'T'+time+':00+09:00')+3600000):null;
 const end=time?{dateTime:hour.toISOString(),timeZone:'Asia/Seoul'}:{date:dayAfter};
 const reminder=time?[{method:'popup',minutes:10},{method:'popup',minutes:60}]:[{method:'popup',minutes:1440}];
 return {summary:title,description:notes,start,end,extendedProperties:{private:{willena_category:category}},reminders:{useDefault:false,overrides:reminder},...(repeat!=='none'?{recurrence:['RRULE:FREQ='+repeat.toUpperCase()]}:{})};
}
async function migrateNative(env,auth,calendarId){
 // Existing native events are imported once, tracked by their original UUID.
 const records=await db(env,'willena_staff_events?select=id,title,event_date,event_time,category,repeat_rule,notes,google_event_id&google_event_id=is.null&limit=500');
 const base='/calendars/'+encodeURIComponent(calendarId)+'/events';
 let imported=0;
 for(const e of records){
  try{
   const data=validEvent({title:e.title,date:e.event_date,time:e.event_time?.slice(0,5)||'',category:e.category,repeat:e.repeat_rule,notes:e.notes});
   data.extendedProperties.private.willena_native_id=e.id;
   const created=await google(auth,base,'POST',data);
   await db(env,'willena_staff_events?id=eq.'+encodeURIComponent(e.id)+'&google_event_id=is.null','PATCH',{google_event_id:created.id});
   imported++;
  }catch(err){console.error('native calendar import failed',e.id,err.message)}
 }
 return {imported,remaining:Math.max(0,records.length-imported)};
}
export async function onRequest({request,env}){
 try{
  const url=new URL(request.url),part=url.pathname.replace(/^\/api\/staff-calendar\/?/,'').replace(/\/$/,'');
  if(url.hostname!=='teachers.willenaenglish.com')return respond({error:'Host not permitted'},403);
  if(!['GET','POST','PATCH','DELETE'].includes(request.method))return respond({error:'Method not allowed'},405);
  const missing=config(env);if(missing.length)return respond({error:'Google integration configuration incomplete: '+missing.join(', ')},503);
  if(part==='callback'){
   const raw=(request.headers.get('cookie')||'').match(/(?:^|;\s*)willena_calendar_state=([^;]+)/)?.[1]||'';
   const state=await readState(env,raw);
   if(!state||url.searchParams.get('state')!==state.nonce||url.searchParams.get('error'))return respond({error:'Google authorization cancelled or expired; restart from Staff Calendar.'},400,{'set-cookie':cookie('',0)});
   const code=url.searchParams.get('code');if(!code)return respond({error:'Authorization code missing'},400);
   const form=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:CALLBACK,grant_type:'authorization_code',code});
   const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});
   const result=await r.json().catch(()=>({}));if(!r.ok||!result.access_token||!result.refresh_token)throw Error('Google did not grant offline Calendar access; reconnect and approve permissions.');
   const old=await connection(env);let calendarId=old?.calendar_id||'';
   if(calendarId){try{await google(result.access_token,'/calendars/'+encodeURIComponent(calendarId))}catch{calendarId=''}}
   if(!calendarId){const newCal=await google(result.access_token,'/calendars','POST',{summary:'Willena Staff Calendar',timeZone:'Asia/Seoul',description:'Shared Willena staff schedule and event reminders'});calendarId=newCal.id}
   await saveConnection(env,calendarId,result.refresh_token,state.uid);
   const migrated=await migrateNative(env,result.access_token,calendarId);
   const destination=ORIGIN+'/Teachers/?calendar='+ (migrated.remaining?'import-warning':'connected');
   return new Response(null,{status:302,headers:{location:destination,'set-cookie':cookie('',0),'cache-control':'no-store'}});
  }
  if(request.method!=='GET'&&request.headers.get('origin')!==ORIGIN)return respond({error:'Invalid request origin'},403);
  const user=await approvedStaff(request,env);if(user.error)return respond({error:user.error},user.status);
  if(part==='connect'){
   if(request.method!=='POST'||!user.admin)return respond({error:'Admin access required'},403);
   const signed=await makeState(env,user.id),state=await readState(env,signed);
   const q=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:CALLBACK,response_type:'code',scope:'https://www.googleapis.com/auth/calendar',access_type:'offline',prompt:'consent',include_granted_scopes:'true',state:state.nonce});
   return respond({authorization_url:'https://accounts.google.com/o/oauth2/v2/auth?'+q},200,{'set-cookie':cookie(signed,600)});
  }
  const linked=await connection(env);
  if(part==='status')return respond({connected:!!linked,admin:user.admin,calendarId:linked&&user.admin?linked.calendar_id:undefined});
  if(!linked)return respond({error:'Google Calendar not connected',code:'NOT_CONNECTED'},409);
  const token=await access(env,linked),base='/calendars/'+encodeURIComponent(linked.calendar_id)+'/events';
  if(part==='events'){
   if(request.method==='GET'){
    const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
    if(!dateOk(from)||!dateOk(to)||from>to||Date.parse(to)-Date.parse(from)>370*86400000)return respond({error:'Invalid date range'},400);
    let next='',all=[];
    do{
     const q=new URLSearchParams({timeMin:from+'T00:00:00+09:00',timeMax:to+'T23:59:59+09:00',maxResults:'250',singleEvents:'true',orderBy:'startTime',...(next?{pageToken:next}:{})});
     const page=await google(token,base+'?'+q);
     all.push(...(page.items||[]));next=page.nextPageToken||'';
    }while(next&&all.length<1500);
    return respond({events:all.filter(e=>e.status!=='cancelled').map(normalizeEvent),source:'google'});
   }
   const body=await request.json().catch(()=>({}));
   if(request.method==='POST'){const result=await google(token,base,'POST',validEvent(body));return respond({event:normalizeEvent(result)},201)}
   const id=String(body.id||'');if(!/^[a-zA-Z0-9_@.-]{3,200}$/.test(id))return respond({error:'Invalid Google event ID'},400);
   if(request.method==='DELETE'){await google(token,base+'/'+encodeURIComponent(id),'DELETE');return respond({success:true})}
   if(request.method==='PATCH'){
    const payload=validEvent(body);
    // Expanded recurring instances are edited individually, not the entire series.
    if(body.recurring_event_id)delete payload.recurrence;
    const updated=await google(token,base+'/'+encodeURIComponent(id),'PATCH',payload);
    return respond({event:normalizeEvent(updated)});
   }
   return respond({error:'Method not allowed'},405);
  }
  return respond({error:'Not found'},404);
 }catch(error){console.error('staff google calendar',error.message);return respond({error:error.message||'Google sync unavailable'},error.status||502)}
}
