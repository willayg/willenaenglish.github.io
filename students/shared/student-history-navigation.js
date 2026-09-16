const text=v=>v==null?null:String(v);

export function createStudentHistoryNavigation({appId,views,normalize,validate,render,onBeforeChange=null,guard=null}={}){
  if(!appId)throw new Error('Navigation requires appId.');
  if(typeof render!=='function')throw new Error('Navigation requires render(route).');
  const allowedViews=new Set(views||[]);
  const grammarFoundations=appId==='willena-grammar-foundations';
  const NAV_VERSION=grammarFoundations?'gf-history-v4':'default-v1';
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
  const same=(a,b)=>JSON.stringify(norm(a))===JSON.stringify(norm(b));

  // Only current-version interactive states are trusted. Older GF quiz/guide
  // entries can contain a route without the live JS/session state required to
  // render it correctly, so they must never be resurrected as activities.
  const unpack=state=>{
    if(state?.app!==appId||!valid(state.route))return null;
    if(!grammarFoundations||state?.navVersion===NAV_VERSION)return norm(state.route);
    const legacy=norm(state.route);
    if(['home','group','module'].includes(legacy.view))return legacy;
    return null;
  };

  function safeLegacyTarget(state,prev){
    if(!grammarFoundations||state?.app!==appId)return null;
    const raw=state?.route;
    if(!raw||!valid(raw))return null;
    const legacy=norm(raw);
    if(['home','group','module'].includes(legacy.view))return legacy;
    const moduleId=legacy.moduleId||prev?.moduleId;
    return moduleId?norm({view:'module',moduleId}):null;
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
    const prev=current;
    let next=unpack(event.state);
    let recoveredLegacy=false;

    // If Back lands on an old GF activity entry, convert that history slot to
    // the lesson journey instead of rendering a dead/stale quiz shell.
    if(!next&&grammarFoundations){
      next=safeLegacyTarget(event.state,prev);
      recoveredLegacy=Boolean(next);
    }
    if(!next)return;

    if(!await allowed(prev,next,'popstate')){
      reverting=true;
      history.forward();
      return;
    }
    if(recoveredLegacy||event.state?.navVersion!==NAV_VERSION){
      history.replaceState(pack(next),'',location.href);
    }
    return accept(next,'popstate',prev);
  }

  function init(initialRoute){
    if(started)throw new Error(`${appId} navigation initialized twice.`);
    started=true;
    let route=unpack(history.state);
    if(!route){
      // A reload on an obsolete activity route starts from the supplied safe
      // initial/resume route and replaces that obsolete history entry in place.
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

  // One history source of truth for UI Back, Android Back, browser Back and
  // swipe-back. No screen-depth arithmetic and no synthetic popstate events.
  function back(){history.back()}
  function route(){return current?{...current}:null}
  function destroy(){window.removeEventListener('popstate',onPop);started=false;current=null}

  const api={init,navigate,replace,back,currentRoute:route,isAppState:state=>Boolean(unpack(state)),destroy,text};
  if(grammarFoundations)window.__willenaGrammarFoundationsNavigation=api;
  return api;
}
