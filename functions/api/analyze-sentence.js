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
  // Binding availability is determined after staff authentication. A binding
  // attached to another Worker or preview environment is not available here.
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
    const candidateNames=['AI','Ai','ai','WORKERS_AI','WorkersAI'];
    const matched=candidateNames.find(name=>typeof env?.[name]?.run==='function');
    const ai=matched?env[matched]:null;
    if(!ai){
      // This Pages deployment has no Workers AI binding. Reuse the existing
      // staff-authenticated Netlify STT endpoint server-to-server. Browser
      // CORS is not involved; do not expose API keys or modify student routes.
      const size=Number(request.headers.get('content-length')||0);
      if(size>3_800_000)return json({error:'Recording too large.'},413);
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),40000);
      try {
        const upstream=await fetch('https://willenaenglish.netlify.app/.netlify/functions/analyze-sentence?mode=stt-lab',{
          method:'POST',
          headers:{
            'Content-Type':request.headers.get('Content-Type')||'application/json',
            'Authorization':'Bearer '+token,
            'Origin':'https://teachers.willenaenglish.com'
          },
          body:request.body,
          signal:controller.signal
        });
        const payload=await upstream.json().catch(()=>null);
        if(!upstream.ok)return json({
          code:'FALLBACK_STT_ERROR',
          error:payload?.error||('Existing Netlify STT returned HTTP '+upstream.status)
        },502);
        if(!Array.isArray(payload?.results))return json({code:'FALLBACK_INVALID_RESPONSE',error:'Existing transcription function returned no model results.'},502);
        const aliases={
          'whisper-1':['whisper-v3-turbo','Whisper 1 (OpenAI)'],
          'gpt-4o-mini-transcribe':['whisper-standard','GPT-4o Mini Transcribe (OpenAI)'],
          'gpt-4o-transcribe':['whisper-tiny-en','GPT-4o Transcribe (OpenAI)']
        };
        return json({
          provider:'existing-netlify-openai',
          results:payload.results.map(x=>({
            ...x,model:aliases[x.model]?.[0]||x.model,
            engine_name:aliases[x.model]?.[1]||x.model
          }))
        });
      }catch(error){
        return json({code:'FALLBACK_UNREACHABLE',error:'Existing STT backend could not be reached: '+String(error.message||error).slice(0,110)},502);
      }finally{clearTimeout(timer)}
    }
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
        const output=await ai.run(m.id,{audio:raw,task:'transcribe',language:'en'});
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
