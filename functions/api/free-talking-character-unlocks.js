import {CHARACTER_REGISTRY} from '../../shared/free-talking-character-catalog.js';
// One-time Free Talking character unlock celebrations.
// All point checks are server-side, tied to the authenticated student token.
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const headers=token=>({apikey:KEY,Authorization:'Bearer '+token});
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const thresholds=Object.fromEntries(CHARACTER_REGISTRY.filter(c=>c.status==='published'&&c.unlockPoints>0).map(c=>[c.id,c.unlockPoints]));
export async function onRequestPost({request}){
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json(415,{error:'JSON required'});
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json(403,{error:'Invalid origin'});
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(token.length<40)return json(401,{error:'Sign in first'});
 const body=await request.json().catch(()=>null);
 if(!body||!['status','claim'].includes(body.action))return json(400,{error:'Invalid action'});
 if(body.action==='claim'&&!Object.hasOwn(thresholds,String(body.character||'')))return json(400,{error:'Invalid character'});
 try{
  const profileRes=await fetch(ROOT+'/auth/v1/user',{headers:headers(token),signal:AbortSignal.timeout(9000)});
  if(!profileRes.ok)return json(401,{error:'Session expired'});
  const user=await profileRes.json();
  const auth={...headers(token)};
  const res=await fetch(ROOT+'/rest/v1/profiles?select=role,approved&id=eq.'+encodeURIComponent(user.id)+'&limit=1',{headers:auth,signal:AbortSignal.timeout(9000)});
  const p=res.ok?(await res.json())[0]:null;
  if(!p||p.role!=='student'||p.approved!==true)return json(403,{error:'Student account required'});
  const pointsRes=await fetch(ROOT+'/rest/v1/rpc/student_own_total_points',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(11000)});
  const points=pointsRes.ok?Number(await pointsRes.json().catch(()=>NaN)):NaN;
  if(!Number.isFinite(points)||points<0)return json(503,{error:'Could not verify points'});
  const base=ROOT+'/rest/v1/free_talking_character_unlocks';
  if(body.action==='claim'){
   const character=String(body.character);
   if(points<thresholds[character])return json(403,{error:'Not unlocked yet'});
   const save=await fetch(base,{method:'POST',headers:{...auth,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({student_id:user.id,character}),signal:AbortSignal.timeout(9000)});
   if(!save.ok)return json(503,{error:'Could not save unlock celebration'});
   return json(200,{success:true,character});
  }
  const previous=await fetch(base+'?select=character&student_id=eq.'+encodeURIComponent(user.id),{headers:auth,signal:AbortSignal.timeout(9000)});
  if(!previous.ok)return json(503,{error:'Could not load unlock history'});
  const celebrated=(await previous.json()).map(r=>r.character).filter(x=>Object.hasOwn(thresholds,x));
  const pending=Object.entries(thresholds).filter(([character,min])=>points>=min&&!celebrated.includes(character)).map(([character])=>character);
  return json(200,{points,pending,celebrated});
 }catch(error){console.warn('[Free Talking] unlock status',String(error));return json(503,{error:'Unlock status temporarily unavailable'})}
}
