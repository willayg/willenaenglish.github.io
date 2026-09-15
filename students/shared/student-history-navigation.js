const text=v=>v==null?null:String(v);

export function createStudentHistoryNavigation({appId,views,normalize,validate,render,onBeforeChange=null,guard=null}={}){
  if(!appId)throw new Error('Navigation requires appId.');
  if(typeof render!=='function')throw new Error('Navigation requires render(route).');
  const allowedViews=new Set(views||[]);
  let current=null;
  let started=false;
  let reverting=false;

  const defaultNormalize=route=>{
    const view=allowedViews.has(String(route?.view||''))?String(route.view):[...allowedViews][0];
    return {view};
  };
  const norm=route=>(normalize||defaultNormalize)(route||{});
  const valid=route=>Boolean(route&&allowedViews.has(route.view)&&(typeof validate!=='function'||validate(route)!==false));
  const pack=route=>({app:appId,route:norm(route)});
  const unpack=state=>state?.app===appId&&valid(state.route)?norm(state.route):null;
  const same=(a,b)=>JSON.stringify(norm(a))===JSON.stringify(norm(b));
  const isGrammarFoundations=appId==='willena-grammar-foundations';

  function compactTransition(prev,next,requestedReplace){
    if(!isGrammarFoundations||requestedReplace)return requestedReplace;
    const a=prev?.view,b=next?.view;
    return (a==='guide'&&b==='practice')||
      (a==='practice'&&b==='result')||
      (a==='result'&&b==='guide')||
      (a==='challenge'&&b==='challenge-result')||
      (a==='challenge-result'&&b==='challenge');
  }

  function compactPoppedRoute(prev,next){
    if(!isGrammarFoundations||!prev||!next)return next;
    const shouldReturnToModule=(
      (prev.view==='practice'&&next.view==='guide')||
      (prev.view==='result'&&(next.view==='practice'||next.view==='guide'))||
      (prev.view==='challenge-result'&&next.view==='challenge')
    );
    if(shouldReturnToModule&&prev.moduleId){
      return norm({view:'module',moduleId:prev.moduleId});
    }
    return next;
  }

  async function allowed(prev,next,source){
    if(typeof guard!=='function')return true;
    try{return await guard(prev,next,{source})!==false}
    catch(e){console.warn(`[${appId} navigation] guard failed`,e);return true}
  }
  function accept(next,source,prev){
    current=next;
    try{onBeforeChange?.(prev,next,{source})}catch(e){console.warn(`[${appId} navigation] before-change failed`,e)}
    return render(next,{source,previous:prev});
  }
  async function onPop(event){
    if(reverting){reverting=false;return}
    let next=unpack(event.state);
    if(!next)return;
    const prev=current;
    if(!await allowed(prev,next,'popstate')){reverting=true;history.forward();return}
    const compacted=compactPoppedRoute(prev,next);
    if(!same(compacted,next)){
      next=compacted;
      history.replaceState(pack(next),'',location.href);
    }
    accept(next,'popstate',prev);
  }

  function init(initialRoute){
    if(started)throw new Error(`${appId} navigation initialized twice.`);
    started=true;
    let route=unpack(history.state);
    if(!route){route=norm(initialRoute);history.replaceState(pack(route),'',location.href)}
    current=route;
    window.addEventListener('popstate',onPop);
    return route;
  }
  async function navigate(route,{replace=false}={}){
    const next=norm(route);
    if(!valid(next))throw new Error(`Invalid ${appId} route.`);
    if(same(current,next))return current;
    const prev=current;
    const useReplace=compactTransition(prev,next,replace);
    if(!await allowed(prev,next,useReplace?'replace':'push'))return prev;
    if(useReplace)history.replaceState(pack(next),'',location.href);else history.pushState(pack(next),'',location.href);
    return accept(next,useReplace?'replace':'push',prev);
  }
  function replace(route,{renderRoute=true}={}){
    const next=norm(route);
    if(!valid(next))throw new Error(`Invalid ${appId} route.`);
    const prev=current;
    history.replaceState(pack(next),'',location.href);
    current=next;
    return renderRoute?accept(next,'replace',prev):next;
  }
  function back(){history.back()}
  function route(){return current?{...current}:null}
  function destroy(){window.removeEventListener('popstate',onPop);started=false;current=null}

  return {init,navigate,replace,back,currentRoute:route,isAppState:state=>Boolean(unpack(state)),destroy,text};
}
