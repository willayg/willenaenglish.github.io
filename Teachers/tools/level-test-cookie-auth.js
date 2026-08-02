(function(){
  'use strict';

  const EDGE_PREFIX='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/level-test-admin';
  const GATEWAY='https://api.willenaenglish.com/level-test-admin';
  const AUTH='https://api.willenaenglish.com/.netlify/functions/supabase_auth?action=whoami_teacher';
  const nativeFetch=window.fetch.bind(window);
  let repairInFlight=null;

  // Legacy page scripts check for a token before making a request. This marker
  // is not an access token; authentication is performed exclusively by the
  // shared HttpOnly teacher cookies at the gateway.
  try{localStorage.setItem('willena_level_test_admin_token','cookie-session');}catch{}

  async function repairTeacherSession(){
    if(repairInFlight)return repairInFlight;
    repairInFlight=(async()=>{
      const response=await nativeFetch(AUTH+'&_='+Date.now(),{
        method:'GET',
        credentials:'include',
        cache:'no-store'
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success){
        const redirect=encodeURIComponent(location.pathname+location.search);
        location.replace('/Teachers/signin.html?redirect='+redirect);
        throw new Error('Teacher login required');
      }
      return true;
    })().finally(()=>{repairInFlight=null;});
    return repairInFlight;
  }

  window.fetch=async function(input,init){
    const raw=typeof input==='string'?input:(input&&input.url)||'';
    if(!raw.startsWith(EDGE_PREFIX))return nativeFetch(input,init);

    await repairTeacherSession();
    const source=new URL(raw);
    const target=GATEWAY+source.search;
    const options={...(init||{}),credentials:'include',cache:'no-store'};
    const headers=new Headers(options.headers||{});
    headers.delete('Authorization');
    headers.delete('apikey');
    options.headers=headers;
    return nativeFetch(target,options);
  };
})();