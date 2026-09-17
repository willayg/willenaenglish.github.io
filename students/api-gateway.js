/**
 * CF Pages API Gateway Configuration
 * Routes Cloudflare Pages API calls through api.willenaenglish.com.
 * MUST load before /js/api-config.js.
 */
(function(){
  'use strict';

  const NETLIFY_ORIGIN='https://students.willenaenglish.com';
  const SENTENCE_GATEWAY='https://willena-proxy.willena.workers.dev';
  const NETLIFY_ONLY_FUNCTIONS=new Set([
    'verify_student','set_student_password','debug_student_data','openai_proxy',
    'google_vision_proxy','supabase_proxy','supabase_proxy_fixed','teacher_admin',
    'test_admin','eleven_labs_proxy','translate','define_word'
  ]);
  const FORCE_GATEWAY_FUNCTIONS=new Set(['upsert_sentences_batch','get_sentence_audio_urls']);

  function extractFunctionName(input){
    const m=String(input||'').match(/\/\.netlify\/functions\/([^\/?#]+)/);
    return m?m[1]:'';
  }

  const host=typeof window!=='undefined'?window.location.hostname:'';
  const isCFPages=host==='staging.willenaenglish.com'||host==='cf.willenaenglish.com'||
    host==='teachers.willenaenglish.com'||host==='students.willenaenglish.com'||host.endsWith('.pages.dev');

  if(!isCFPages){
    window.__STUDENTS_GATEWAY_PATCHED=true;
    return;
  }

  window.__CF_API_GATEWAY='https://api.willenaenglish.com';
  window.__CF_GATEWAY_PATCHED=false;
  window.__STUDENTS_GATEWAY_PATCHED=false;

  if(window.location.pathname.startsWith('/Teachers/admin-v2/')){
    const stampRevision=()=>{
      const el=document.querySelector('.admin-v2-rev');
      if(el)el.textContent='Admin V2 · 1.14';
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',stampRevision,{once:true});
    else stampRevision();

    // Legacy Admin modules call window.api(...). For admin_classes, bypass
    // WillenaAPI.fetch so a stale localStorage bearer cannot override the fresh
    // shared sb_access cookie. The API gateway will derive Authorization from
    // the cookie when forwarding to ADMIN_CLASSES. Retry once after session repair.
    if(typeof window.api!=='function'){
      window.api=async function(path,options={}){
        const raw=String(path||'');
        const isAdminClasses=extractFunctionName(raw)==='admin_classes';
        let response;

        if(isAdminClasses){
          const absolute=/^https?:\/\//i.test(raw)?raw:window.__CF_API_GATEWAY+raw;
          const requestOptions={credentials:'include',cache:'no-store',...options};
          if(requestOptions.headers){
            const headers=new Headers(requestOptions.headers);
            headers.delete('Authorization');
            headers.delete('authorization');
            requestOptions.headers=headers;
          }
          response=await window.fetch(absolute,requestOptions);

          if(response.status===401&&typeof window.ensureTeacherSession==='function'){
            const repaired=await window.ensureTeacherSession();
            if(repaired?.success)response=await window.fetch(absolute,requestOptions);
          }
        }else{
          const fn=window.WillenaAPI?.fetch||window.fetch.bind(window);
          response=await fn(path,{credentials:'include',cache:'no-store',...options});
        }

        let data={};
        try{data=await response.json()}catch{}
        if(!response.ok||data?.success===false){
          const error=new Error(data?.error||`Request failed (${response.status})`);
          error.status=response.status;
          throw error;
        }
        return data;
      };
    }
  }

  const maxWaitTime=5000;
  const startTime=Date.now();

  function patchWillenaAPI(){
    if(window.__CF_GATEWAY_PATCHED)return;
    if(!window.WillenaAPI||!window.WillenaAPI.getApiUrl){
      if(Date.now()-startTime<maxWaitTime){setTimeout(patchWillenaAPI,10);return;}
      console.error('[CFGateway] WillenaAPI failed to load after 5s');
      return;
    }

    const origGetApiUrl=window.WillenaAPI.getApiUrl;
    window.WillenaAPI.getApiUrl=function(path){
      const url=origGetApiUrl(path);
      const fn=extractFunctionName(path)||extractFunctionName(url);

      if(fn&&FORCE_GATEWAY_FUNCTIONS.has(fn)){
        const qIndex=url.indexOf('?');
        return SENTENCE_GATEWAY+'/.netlify/functions/'+fn+(qIndex>=0?url.slice(qIndex):'');
      }

      if(fn&&NETLIFY_ONLY_FUNCTIONS.has(fn)){
        if(/^https?:\/\//i.test(url))return url;
        if(url.startsWith('/.netlify/functions/'))return NETLIFY_ORIGIN+url;
        if(String(path||'').startsWith('/.netlify/functions/'))return NETLIFY_ORIGIN+String(path);
      }

      if(url.startsWith('/.netlify/functions/'))return window.__CF_API_GATEWAY+url;
      return url;
    };

    window.WillenaAPI.BASE_URL=window.__CF_API_GATEWAY;
    window.__CF_GATEWAY_PATCHED=true;
    window.__STUDENTS_GATEWAY_PATCHED=true;
  }

  patchWillenaAPI();
  const rapidPatch=setInterval(()=>{
    if(window.__CF_GATEWAY_PATCHED){clearInterval(rapidPatch);return;}
    patchWillenaAPI();
  },5);
  setTimeout(()=>clearInterval(rapidPatch),500);
})();
