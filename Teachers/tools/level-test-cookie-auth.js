(function(){
  'use strict';

  const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/level-test-admin';
  const SUPABASE_AUTH='https://fiieuiktlsivwfgyivai.supabase.co/auth/v1/token?grant_type=refresh_token';
  const ANON_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
  const TEACHER_SESSION='https://api.willenaenglish.com/.netlify/functions/supabase_auth?action=whoami_teacher';
  const nativeFetch=window.fetch.bind(window);
  let sessionCheck=null;
  let tokenRefresh=null;

  function redirectToLogin(){
    const target=encodeURIComponent(location.pathname+location.search);
    location.replace('/Teachers/signin.html?redirect='+target);
  }

  async function verifyTeacherCookie(){
    if(sessionCheck)return sessionCheck;
    sessionCheck=(async()=>{
      const response=await nativeFetch(TEACHER_SESSION+'&_='+Date.now(),{
        method:'GET',credentials:'include',cache:'no-store'
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success){redirectToLogin();throw new Error('Teacher login required');}
      return true;
    })().finally(()=>{sessionCheck=null;});
    return sessionCheck;
  }

  function storedAccess(){try{return localStorage.getItem('sb_access_token')||'';}catch{return '';}}
  function storedRefresh(){try{return localStorage.getItem('sb_refresh_token')||'';}catch{return '';}}
  function saveSession(data){
    try{
      if(data.access_token)localStorage.setItem('sb_access_token',data.access_token);
      if(data.refresh_token)localStorage.setItem('sb_refresh_token',data.refresh_token);
    }catch{}
  }

  async function refreshStoredToken(){
    if(tokenRefresh)return tokenRefresh;
    tokenRefresh=(async()=>{
      const refreshToken=storedRefresh();
      if(!refreshToken)throw new Error('Teacher session needs a fresh sign-in');
      const response=await nativeFetch(SUPABASE_AUTH,{
        method:'POST',cache:'no-store',
        headers:{apikey:ANON_KEY,'content-type':'application/json'},
        body:JSON.stringify({refresh_token:refreshToken})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.access_token)throw new Error(data.error_description||'Could not refresh teacher session');
      saveSession(data);
      return data.access_token;
    })().finally(()=>{tokenRefresh=null;});
    return tokenRefresh;
  }

  async function edgeRequest(input,init,token){
    const options={...(init||{}),cache:'no-store'};
    const headers=new Headers(options.headers||{});
    headers.set('apikey',ANON_KEY);
    headers.set('Authorization','Bearer '+token);
    options.headers=headers;
    return nativeFetch(input,options);
  }

  window.fetch=async function(input,init){
    const raw=typeof input==='string'?input:(input&&input.url)||'';
    if(!raw.startsWith(EDGE))return nativeFetch(input,init);

    await verifyTeacherCookie();
    let token=storedAccess();
    if(!token){
      try{token=await refreshStoredToken();}
      catch(error){redirectToLogin();throw error;}
    }

    let response=await edgeRequest(input,init,token);
    if(response.status!==401&&response.status!==403)return response;

    try{
      token=await refreshStoredToken();
      response=await edgeRequest(input,init,token);
      return response;
    }catch(error){
      redirectToLogin();
      throw error;
    }
  };
})();