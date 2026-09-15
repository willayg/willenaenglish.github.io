const EDGE_MATCH='/functions/v1/grammar-foundations-student-v1';
const nativeFetch=window.fetch.bind(window);

window.fetch=async function(input,init){
  const url=typeof input==='string'?input:input?.url||'';
  const res=await nativeFetch(input,init);
  if(res.ok&&url.includes(EDGE_MATCH)&&url.includes('action=save_stage')){
    res.clone().json().then(data=>{
      const delta=Number(data?.awarded_points||0);
      if(delta>0)window.dispatchEvent(new CustomEvent('points:optimistic-bump',{detail:{delta,source:'grammar_foundations'}}));
    }).catch(()=>{});
  }
  return res;
};
