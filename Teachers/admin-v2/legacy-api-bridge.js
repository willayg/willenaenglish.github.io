// Compatibility bridge for legacy Admin modules reused inside Admin V2.
// Routes their historical window.api(...) contract through the shared Willena API layer.
(function(){
  'use strict';
  if(typeof window.api==='function')return;
  window.api=async function(path,options={}){
    const fn=window.WillenaAPI?.fetch||window.fetch.bind(window);
    const response=await fn(path,{credentials:'include',cache:'no-store',...options});
    let data={};
    try{data=await response.json()}catch{}
    if(!response.ok||data?.success===false){
      const error=new Error(data?.error||`Request failed (${response.status})`);
      error.status=response.status;
      throw error;
    }
    return data;
  };
})();
