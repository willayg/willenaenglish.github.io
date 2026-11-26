// Private teaching-resource files; requires a dedicated PRIVATE R2 binding.
// No use of public audio bucket or public download links.
const SCORE='https://fiieuiktlsivwfgyivai.supabase.co', KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function staff(request){let token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();if(!token){const m=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)sb_access=([^;]+)/);if(m)try{token=decodeURIComponent(m[1])}catch{}}if(!token)return null;const headers={apikey:KEY,Authorization:'Bearer '+token};const u=await fetch(SCORE+'/auth/v1/user',{headers,cache:'no-store'});if(!u.ok)return null;const user=await u.json();if(!uuid.test(user.id||''))return null;const p=await fetch(SCORE+'/rest/v1/profiles?select=id,role,approved&id=eq.'+user.id+'&limit=1',{headers,cache:'no-store'});if(!p.ok)return null;const profile=(await p.json())[0];return profile?.approved===true&&['teacher','admin'].includes(String(profile.role).toLowerCase())?{id:user.id,headers}:null}
async function getRow(id,auth){const r=await fetch(SCORE+'/rest/v1/teacher_resources_v1?select=id,name,type,source&id=eq.'+id+'&limit=1',{headers:auth.headers,cache:'no-store'});if(!r.ok)throw Error('Catalogue verification failed');return (await r.json())[0]}
export async function onRequest({request,env}){
 try{
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return reply(403,{error:'Origin rejected'});
 const auth=await staff(request);if(!auth)return reply(403,{error:'Approved teacher login required'});
 const url=new URL(request.url),action=url.searchParams.get('action'),bucket=env.TEACHER_RESOURCES_PRIVATE;
 const service=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SERVICE_KEY;
 if(action==='config'&&request.method==='GET')return reply(200,{r2Ready:!!bucket&&!!service,driveClientId:env.TEACHER_RESOURCES_GOOGLE_CLIENT_ID||''});
 if(!bucket||!service)return reply(503,{error:'Private teacher resource R2 binding and database service key are not configured'});
 const id=url.searchParams.get('id')||'',kind=url.searchParams.get('kind')||'';if(!uuid.test(id)||!['pdf','audio'].includes(kind))return reply(400,{error:'Invalid resource or file type'});
 const row=await getRow(id,auth);if(!row)return reply(404,{error:'Resource not found'});
 const ext=kind==='pdf'?'pdf':'mp3',mime=kind==='pdf'?'application/pdf':'audio/mpeg';
 const prefix='teacher-resources/v1/'+id+'/'+kind+'/';
 if(request.method==='GET'){
 const meta=await fetch(SCORE+'/rest/v1/teacher_resource_assets_v1?select=object_key&resource_id=eq.'+id+'&kind=eq.'+kind+'&limit=1',{headers:auth.headers,cache:'no-store'});if(!meta.ok)return reply(502,{error:'Asset catalogue unavailable'});const objKey=(await meta.json())[0]?.object_key;if(!objKey||!objKey.startsWith(prefix))return reply(404,{error:'No optimised copy yet'});const o=await bucket.get(objKey);if(!o)return reply(404,{error:'File unavailable'});return new Response(o.body,{headers:{'Content-Type':mime,'Content-Length':String(o.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="resource.'+ext+'"'}});
 }
 if(request.method!=='PUT')return reply(405,{error:'Unsupported method'});
 if(request.headers.get('X-Resource-Rights')!=='confirmed')return reply(400,{error:'Confirm permission to store the file'});
 if(kind==='audio'&&row.type!=='Listening')return reply(400,{error:'Not a listening resource'});
 const max=20*1024*1024,declared=Number(request.headers.get('Content-Length')||0);if(declared>max)return reply(413,{error:'20 MB file limit'});
 if(!request.body)return reply(400,{error:'File missing'});
 const reader=request.body.getReader(),chunks=[];let len=0;while(true){const {value,done}=await reader.read();if(done)break;len+=value.byteLength;if(len>max){await reader.cancel();return reply(413,{error:'20 MB file limit'})}chunks.push(value)}
 const bytes=new Uint8Array(len);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 const valid=kind==='pdf'?new TextDecoder().decode(bytes.slice(0,5))==='%PDF-':(bytes[0]===73&&bytes[1]===68&&bytes[2]===51)||(bytes[0]===255&&(bytes[1]&224)===224);if(!valid||len<20)return reply(400,{error:'Invalid '+ext.toUpperCase()+' file'});
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');const key=prefix+hash+'.'+ext;
 // Content-addressed keys prevent an accidental overwrite of a previous version.
 await bucket.put(key,bytes,{httpMetadata:{contentType:mime,cacheControl:'private, no-store'}});
 const saved=await fetch(SCORE+'/rest/v1/teacher_resource_assets_v1?on_conflict=resource_id,kind',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({resource_id:id,kind,object_key:key,bytes:len,created_by:auth.id})});
 if(!saved.ok)return reply(502,{error:'File stored but catalogue write failed; retry to repair'});
 return reply(200,{success:true,resource_id:id,kind,bytes:len});
 }catch(e){console.error('teacher-resource-assets',String(e?.message||e).slice(0,160));return reply(502,{error:'Resource service unavailable'})}
}
