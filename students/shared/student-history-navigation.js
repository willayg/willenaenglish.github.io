const text=v=>v==null?null:String(v);

export function createStudentHistoryNavigation({appId,views,normalize,validate,render,onBeforeChange=null,guard=null}={}){
  if(!appId)throw new Error('Navigation requires appId.');
  if(typeof render!=='function')throw new Error('Navigation requires render(route).');
  const allowedViews=new Set(views||[]);
  const grammarFoundations=appId==='willena-grammar-foundations';
  const NAV_VERSION=grammarFoundations?'gf-history-v3':'default-v1';
  let current=null;
  let started=false;
  let reverting=false;

  const defaultNormalize=route=>{
    const view=allowedViews.has(String(route?.view||''))?String(route.view):[...allowedViews][0];
    return {view};
  };
  const norm=route=>(normalize||defaultNormalize)(route||{});
  const valid=route=>Boolean(route&&allowedViews.has(route.view)&&(typeof validate!=='function'||validate(route)!==false));
  const pack=route=>({app:appId,navVersion:NAV_VERSION,route:norm(route)});
  // Accept older states for this app so an already-open tab can migrate cleanly.
  const unpack=state=>state?.app===appId&&valid(state.route)?norm(state.route):null;
  const same=(a,b)=>JSON.stringify(norm(a))===JSON.stringify(norm(b));

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
    const next=unpack(event.state);
    const prev=current;
    // A popstate that belongs to another page/app is browser history, not ours.
    // Do not manufacture a replacement route or alter the history stack.
    if(!next)return;
    if(!await allowed(prev,next,'popstate')){
      reverting=true;
      history.forward();
      return;
    }
    // Migrate older same-app state in place without adding another entry.
    if(event.state?.navVersion!==NAV_VERSION)history.replaceState(pack(next),'',location.href);
    return accept(next,'popstate',prev);
  }

  function init(initialRoute){
    if(started)throw new Error(`${appId} navigation initialized twice.`);
    started=true;
    let route=unpack(history.state);
    if(!route){
      route=norm(initialRoute);
      history.replaceState(pack(route),'',location.href);
    }else if(history.state?.navVersion!==NAV_VERSION){
      history.replaceState(pack(route),'',location.href);
    }
    current=route;
    window.addEventListener('popstate',onPop);
    return route;
  }

  function completionReplacement(prev,next){
    if(!grammarFoundations||!prev||!next)return false;
    if(prev.view==='practice'&&next.view==='result'){
      return String(prev.moduleId)===String(next.moduleId)&&String(prev.stageId)===String(next.stageId);
    }
    if(prev.view==='challenge'&&next.view==='challenge-result'){
      return String(prev.moduleId)===String(next.moduleId);
    }
    if(prev.view==='guide'&&next.view==='practice'){
      return String(prev.moduleId)===String(next.moduleId)&&String(prev.stageId)===String(next.stageId);
    }
    return false;
  }

  async function navigate(route,{replace=false}={}){
    const next=norm(route);
    if(!valid(next))throw new Error(`Invalid ${appId} route.`);
    if(same(current,next))return current;
    const prev=current;
    const shouldReplace=replace||completionReplacement(prev,next);
    if(!await allowed(prev,next,shouldReplace?'replace':'push'))return prev;
    if(shouldReplace)history.replaceState(pack(next),'',location.href);
    else history.pushState(pack(next),'',location.href);
    return accept(next,shouldReplace?'replace':'push',prev);
  }

  function replace(route,{renderRoute=true}={}){
    const next=norm(route);
    if(!valid(next))throw new Error(`Invalid ${appId} route.`);
    const prev=current;
    history.replaceState(pack(next),'',location.href);
    current=next;
    return renderRoute?accept(next,'replace',prev):next;
  }

  // In-app Back intentionally delegates to the browser. There is one history
  // source of truth for UI buttons, Android Back, browser Back and swipe-back.
  function back(){history.back()}
  function route(){return current?{...current}:null}
  function destroy(){window.removeEventListener('popstate',onPop);started=false;current=null}

  const api={init,navigate,replace,back,currentRoute:route,isAppState:state=>Boolean(unpack(state)),destroy,text};
  if(grammarFoundations)window.__willenaGrammarFoundationsNavigation=api;
  return api;
}
