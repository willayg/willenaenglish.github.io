(function(){
  'use strict';
  const ENDPOINT='https://supabase-auth.willena.workers.dev?action=refresh';
  const INTERVAL_MS=35*60*1000;
  let inFlight=null;

  async function refreshGrammarFoundationAuth(){
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      try{
        const res=await fetch(`${ENDPOINT}&_=${Date.now()}`,{
          method:'GET',
          credentials:'include',
          cache:'no-store'
        });
        const data=await res.json().catch(()=>({}));
        if(res.ok&&data?.success&&data.access_token){
          window.WillenaAPI?.setLocalTokens?.(data.access_token,data.refresh_token||'');
          return data.access_token;
        }
      }catch(e){
        console.warn('[grammar-foundations] auth refresh failed',e);
      }finally{
        inFlight=null;
      }
      return '';
    })();
    return inFlight;
  }

  window.refreshGrammarFoundationAuth=refreshGrammarFoundationAuth;
  refreshGrammarFoundationAuth();
  setInterval(refreshGrammarFoundationAuth,INTERVAL_MS);
})();
