// Wrapper for Cloudflare Pages Functions default directory
// Delegates to the implementation in cloudflare-workers/api/analyze-sentence.js

import {
	onRequestPost as implOnRequestPost,
	onRequestOptions as implOnRequestOptions,
} from '../../cloudflare-workers/api/analyze-sentence.js';

export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  if (url.searchParams.get('mode') === 'stt-lab') return handleSttLab(context);
  return implOnRequestPost(context);
}

export async function onRequestOptions(context) {
	return implOnRequestOptions(context);
}


/**
 * Same-origin, staff-only STT comparison. Independent of Netlify and OpenAI
 * regional egress. Retains neither audio nor transcripts.
 */
async function handleSttLab({ request, env }) {
  const json=(body,status=200)=>new Response(JSON.stringify(body),{
    status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
  if(!env.AI)return json({error:'Cloudflare Workers AI binding is not configured for this site.'},503);
  const token=/^Bearer (.+)$/.exec(request.headers.get('Authorization')||'')?.[1];
  if(!token)return json({error:'Teacher login required.'},401);
  try{
    const authBase='https://fiieuiktlsivwfgyivai.supabase.co';
    const key=env.SUPABASE_ANON_KEY||'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
    const authHeaders={apikey:key,Authorization:'Bearer '+token};
    const userResponse=await fetch(authBase+'/auth/v1/user',{headers:authHeaders});
    if(!userResponse.ok)return json({error:'Teacher login expired; please sign in again.'},401);
    const user=await userResponse.json();
    if(!user?.id)return json({error:'Teacher authentication failed.'},401);
    const profileResponse=await fetch(authBase+'/rest/v1/profiles?id=eq.'+encodeURIComponent(user.id)+'&select=role,approved&limit=1',{headers:authHeaders});
    if(!profileResponse.ok)return json({error:'Cannot verify teacher role.'},403);
    const [profile]=await profileResponse.json();
    if(!profile?.approved||!['admin','teacher'].includes(profile.role))return json({error:'Staff permission required.'},403);
    if(Number(request.headers.get('content-length')||0)>3_800_000)return json({error:'Recording too large.'},413);
    const body=await request.json().catch(()=>null);
    const raw=body?.audio;
    const mime=body?.mime||'';
    if(typeof raw!=='string'||!raw.length||raw.length>3_700_000)return json({error:'Audio is empty or too large.'},400);
    if(!/^audio\/(webm|mp4|ogg|wav|mpeg|x-m4a)(;.*)?$/i.test(mime))return json({error:'Unsupported audio format.'},400);
    // Existing Willena Whisper implementation passes base64 audio to Workers AI.
    const models=[
      {model:'whisper-v3-turbo',id:'@cf/openai/whisper-large-v3-turbo'},
      {model:'whisper-standard',id:'@cf/openai/whisper'},
      {model:'whisper-tiny-en',id:'@cf/openai/whisper-tiny-en'}
    ];
    const results=await Promise.all(models.map(async m=>{
      const start=Date.now();
      try{
        const output=await env.AI.run(m.id,{audio:raw,task:'transcribe',language:'en'});
        return {model:m.model,transcript:String(output?.text||'').trim(),latency_ms:Date.now()-start};
      }catch(e){
        console.warn('[stt-lab] Model failed:',m.id,String(e?.message||e).slice(0,180));
        return {model:m.model,error:'Recognition unavailable: '+String(e?.message||e).slice(0,110),latency_ms:Date.now()-start};
      }
    }));
    return json({results});
  }catch(error){
    console.error('[stt-lab]',error);
    return json({error:'STT connection error. '+String(error?.message||error).slice(0,90)},502);
  }
}
