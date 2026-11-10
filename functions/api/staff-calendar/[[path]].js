// Willena Staff Calendar — Google OAuth + Google Calendar API.
// Cloudflare Pages route /api/staff-calendar/*; Google tokens never enter browser JS.
const SUPABASE = 'https://fiieuiktlsivwfgyivai.supabase.co';
const TABLE = 'staff_calendar_google_connection';
const CALLBACK = 'https://teachers.willenaenglish.com/api/staff-calendar/callback';
const ORIGIN = 'https://teachers.willenaenglish.com';
const GOOGLE = 'https://www.googleapis.com/calendar/v3';
const fmt = (data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
function token(req){const m=(req.headers.get('cookie')||'').match(/(?:^|;\s*)sb_access=([^;]+)/);if(!m)return '';try{return decodeURIComponent(m[1])}catch{return ''}}
function b64(buf){return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64(str){const s=str.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0))}
async function key(env){const raw=new TextEncoder().encode(env.GOOGLE_CLIENT_SECRET);const hashed=await crypto.subtle.digest('SHA-256',raw);return crypto.subtle.importKey('raw',hashed,{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function encrypt(env,text){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(text));return {refresh_cipher:b64(cipher),refresh_iv:b64(iv)}}
async function decrypt(env,record){const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(record.refresh_iv)},await key(env),unb64(record.refresh_cipher));return new TextDecoder().decode(bytes)}
function config(env){return Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.SUPABASE_SERVICE_ROLE_KEY)}
async function sb(env,path,opts={}){const r=await fetch(SUPABASE+path,{...opts,headers:{'apikey':env.SUPABASE_SERVICE_ROLE_KEY,'authorization':'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json','accept':'application/json',...(opts.headers||{})}});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text};if(!r.ok)throw Error('Storage request failed ('+r.status+')');return data}
async function staff(req,env){const jwt=token(req);if(!jwt)return null;
 const r=await fetch(SUPABASE+'/auth/v1/user',{headers:{'apikey':env.SUPABASE_SERVICE_ROLE_KEY,'authorization':'Bearer '+jwt}});
 if(!r.ok)return null;const identity=await r.json().catch(()=>({}));if(!identity.id)return null;
 const p=await sb(env,'/rest/v1/profiles?select=role,approved&id=eq.'+encodeURIComponent(identity.id)+'&limit=1');const x=p?.[0];
 return x?.approved===true&&['teacher','admin'].includes(String(x.role).toLowerCase())?{id:identity.id,admin:String(x.role).toLowerCase()==='admin'}:null;
}
async function connection(env){const list=await sb(env,'/rest/v1/'+TABLE+'?select=*&id=eq.1&limit=1');return list?.[0]||null}
async function writeConnection(env,calendar_id,refresh,uid){const enc=await encrypt(env,refresh);
 await sb(env,'/rest/v1/'+TABLE+'?on_conflict=id',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:1,calendar_id,...enc,connected_by:uid,updated_at:new Date().toISOString()})})}
async function access(env,record){const refresh=await decrypt(env,record);
 const form=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'});
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});
 const j=await r.json();if(!r.ok||!j.access_token)throw Error('Google connection needs reauthorization');return j.access_token}
async function google(accessToken,path,method='GET',data){const r=await fetch(GOOGLE+path,{method,headers:{authorization:'Bearer '+accessToken,'content-type':'application/json'},body:data?JSON.stringify(data):undefined});const t=await r.text();let json;try{json=JSON.parse(t)}catch{json={}};if(!r.ok)throw Error(json.error?.message||'Google Calendar API error '+r.status);return json}
function clean(e){return {id:e.id,title:e.summary||'',date:e.start?.date||e.start?.dateTime?.slice(0,10)||'',time:e.start?.dateTime?new Date(e.start.dateTime).toLocaleTimeString('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):'',endTime:e.end?.dateTime?new Date(e.end.dateTime).toLocaleTimeString('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):'',notes:e.description||'',category:e.extendedProperties?.private?.willena_category||'events',repeat:e.recurrence?.some(v=>v.includes('FREQ=WEEKLY'))?'weekly':e.recurrence?.some(v=>v.includes('FREQ=MONTHLY'))?'monthly':'none',recurringEventId:e.recurringEventId||null}};
function allowedDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T00:00:00Z'))}
function normalized(body){
 const title=String(body.title||'').trim(),date=String(body.date||''),time=String(body.time||''),endTime=String(body.endTime||'');
 const category=String(body.category||'events'),repeat=String(body.repeat||'none'),notes=String(body.notes||'');
 if(title.length<1||title.length>120||!allowedDate(date)||time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||endTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)||!['events','staff','academic','deadline'].includes(category)||!['none','weekly','monthly'].includes(repeat)||notes.length>1200)throw Error('Invalid event details');
 let start,end;if(time){start={dateTime:date+'T'+time+':00+09:00',timeZone:'Asia/Seoul'};const to=endTime||String((Number(time.slice(0,2))+1)%24).padStart(2,'0')+time.slice(2);
 const next=to<=time?new Date(Date.parse(date+'T00:00:00+09:00')+86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}):date;
 end={dateTime:next+'T'+to+':00+09:00',timeZone:'Asia/Seoul'}}else{start={date};const x=new Date(date+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+1);end={date:x.toISOString().slice(0,10)}}
 return {summary:title,description:notes,start,end,extendedProperties:{private:{willena_category:category}},...(repeat!=='none'?{recurrence:['RRULE:FREQ='+repeat.toUpperCase()]}:{})};
}
const oauthCookie=(val,maxAge)=>'willena_calendar_state='+val+'; Path=/api/staff-calendar; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;
async function respond(req,env){
 const url=new URL(req.url),part=url.pathname.replace(/^\/api\/staff-calendar\/?/,'').replace(/\/$/,'');
 if(url.hostname!=='teachers.willenaenglish.com')return fmt({error:'Invalid host'},403);
 if(!config(env))return fmt({error:'Calendar server configuration incomplete. GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SUPABASE_SERVICE_ROLE_KEY are required.'},503);
 const user=await staff(req,env);if(!user)return fmt({error:'Approved Willena teacher login required'},401);
 if(part==='connect'){
   if(req.method!=='GET'||!user.admin)return fmt({error:'Admin access required'},403);
   const nonce=b64(crypto.getRandomValues(new Uint8Array(24)));
   const q=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:CALLBACK,response_type:'code',scope:'https://www.googleapis.com/auth/calendar',access_type:'offline',prompt:'consent',state:nonce,include_granted_scopes:'true'});
   return new Response(null,{status:302,headers:{location:'https://accounts.google.com/o/oauth2/v2/auth?'+q,'set-cookie':oauthCookie(nonce,600),'cache-control':'no-store'}});
 }
 if(part==='callback'){
   if(!user.admin)return fmt({error:'Admin access required'},403);
   const state=(req.headers.get('cookie')||'').match(/(?:^|;\s*)willena_calendar_state=([^;]+)/)?.[1]||'';
   if(!state||!url.searchParams.get('state')||state!==url.searchParams.get('state')||url.searchParams.get('error'))return fmt({error:'Google authorization cancelled or state invalid'},400,{'set-cookie':oauthCookie('',0)});
   const code=url.searchParams.get('code');if(!code)return fmt({error:'Authorization code missing'},400);
   const form=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:CALLBACK,grant_type:'authorization_code',code});
   const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});const tj=await tr.json();if(!tr.ok||!tj.access_token||!tj.refresh_token)throw Error('Google did not grant offline calendar access. Try connecting again.');
   const previous=await connection(env);let calendarId=previous?.calendar_id;
   // Reuse the originally created calendar on reconnection; never duplicate by accident.
   if(calendarId){try{await google(tj.access_token,'/calendars/'+encodeURIComponent(calendarId))}catch{calendarId=null}}
   if(!calendarId){const made=await google(tj.access_token,'/calendars','POST',{summary:'Willena Staff Calendar',timeZone:'Asia/Seoul',description:'Shared academy schedule managed through Willena staff tools'});calendarId=made.id}
   await writeConnection(env,calendarId,tj.refresh_token,user.id);
   return new Response(null,{status:302,headers:{location:ORIGIN+'/Teachers/tools/staff-calendar/?connected=1','set-cookie':oauthCookie('',0),'cache-control':'no-store'}});
 }
 const record=await connection(env);
 if(part==='status')return fmt({connected:!!record,admin:user.admin,calendarId:record&&user.admin?record.calendar_id:null});
 if(!record)return fmt({error:'Google Calendar not yet connected by admin',code:'NOT_CONNECTED'},409);
 const auth=await access(env,record),calendarPath='/calendars/'+encodeURIComponent(record.calendar_id)+'/events';
 if(part==='events'){
   if(req.method==='GET'){
     const from=url.searchParams.get('from'),to=url.searchParams.get('to');
     if(!allowedDate(from||'')||!allowedDate(to||'')||Date.parse(to)-Date.parse(from)>370*86400000)return fmt({error:'Invalid date range'},400);
     let page='',items=[];do{const query=new URLSearchParams({timeMin:from+'T00:00:00+09:00',timeMax:to+'T23:59:59+09:00',maxResults:'250',singleEvents:'true',orderBy:'startTime',...(page?{pageToken:page}:{})});const list=await google(auth,calendarPath+'?'+query);items.push(...(list.items||[]));page=list.nextPageToken||''}while(page&&items.length<1500);
     return fmt({events:items.filter(e=>e.status!=='cancelled').map(clean)});
   }
   if(!['POST','PATCH','DELETE'].includes(req.method))return fmt({error:'Method not allowed'},405);
   const body=await req.json().catch(()=>({}));const id=String(body.id||'');
   if(req.method==='POST'){const input=normalized(body);const created=await google(auth,calendarPath,'POST',input);return fmt({event:clean(created)},201)}
   if(!/^[a-zA-Z0-9_@.-]{3,200}$/.test(id))return fmt({error:'Invalid event ID'},400);
   if(req.method==='DELETE'){await google(auth,calendarPath+'/'+encodeURIComponent(id),'DELETE');return fmt({success:true})}
   const input=normalized(body);const updated=await google(auth,calendarPath+'/'+encodeURIComponent(id),'PUT',input);return fmt({event:clean(updated)});
 }
 return fmt({error:'Not found'},404);
}
export async function onRequest({request,env}){try{return await respond(request,env)}catch(e){console.error('staff-calendar',e?.message);return fmt({error:e?.message||'Calendar connection failed'},502)}}
