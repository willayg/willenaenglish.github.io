const text=v=>v==null?null:String(v);

export function createStudentHistoryNavigation({appId,views,normalize,validate,render,onBeforeChange=null,guard=null}={}){
  if(!appId)throw new Error('Navigation requires appId.');
  if(typeof render!=='function')throw new Error('Navigation requires render(route).');
  const allowedViews=new Set(views||[]);
  const grammarFoundations=appId==='willena-grammar-foundations';
  const NAV_VERSION=grammarFoundations?'gf-hierarchy-v2':'default-v1';
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
  const unpack=state=>state?.app===appId&&(!grammarFoundations||state?.navVersion===NAV_VERSION)&&valid(state.route)?norm(state.route):null;
  const same=(a,b)=>JSON.stringify(norm(a))===JSON.stringify(norm(b));

  function depth(route){
    if(!grammarFoundations)return 0;
    const view=route?.view;
    if(view==='home')return 0;
    if(view==='group')return 1;
    if(view==='module')return 2;
    if(['guide','practice','result','challenge','challenge-result'].includes(view))return 3;
    return 0;
  }
  function fallbackParent(route){
    if(!grammarFoundations||!route)return null;
    if(['guide','practice','result','challenge','challenge-result'].includes(route.view)&&route.moduleId){
      return norm({view:'module',moduleId:route.moduleId});
    }
    if(route.view==='module')return norm({view:'home'});
    if(route.view==='group')return norm({view:'home'});
    return null;
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
    const prev=current;

    // Old Grammar Foundations history entries are deliberately discarded.
    // If the browser lands on one, replace it with the canonical parent instead
    // of exposing an old guide/result/question route to the student.
    if(grammarFoundations&&!next){
      const parent=fallbackParent(prev);
      if(!parent)return;
      if(!await allowed(prev,parent,'popstate')){reverting=true;history.forward();return}
      history.replaceState(pack(parent),'',location.href);
      accept(parent,'popstate',prev);
      return;
    }
    if(!next)return;
    if(!await allowed(prev,next,'popstate')){reverting=true;history.forward();return}
    accept(next,'popstate',prev);
  }

  function init(initialRoute){
    if(started)throw new Error(`${appId} navigation initialized twice.`);
    started=true;
    let route=unpack(history.state);
    if(!route){
      route=norm(initialRoute);
      history.replaceState(pack(route),'',location.href);
    }
    current=route;
    window.addEventListener('popstate',onPop);
    return route;
  }

  async function navigate(route,{replace=false}={}){
    const next=norm(route);
    if(!valid(next))throw new Error(`Invalid ${appId} route.`);
    if(same(current,next))return current;
    const prev=current;

    if(grammarFoundations&&!replace){
      const from=depth(prev),to=depth(next);

      // A level guide, the quiz itself and its result are one navigation tier.
      // Moving between them must never add browser history.
      if(to===from&&to===3){
        if(!await allowed(prev,next,'replace'))return prev;
        history.replaceState(pack(next),'',location.href);
        return accept(next,'replace',prev);
      }

      // Returning to an ancestor consumes history; it never pushes a new copy of
      // that ancestor after a result screen.
      if(to<from){
        if(!await allowed(prev,next,'back'))return prev;
        history.go(-(from-to));
        return prev;
      }
    }

    if(!await allowed(prev,next,replace?'replace':'push'))return prev;
    if(replace)history.replaceState(pack(next),'',location.href);
    else history.pushState(pack(next),'',location.href);
    return accept(next,replace?'replace':'push',prev);
  }

  function replace(route,{renderRoute=true}={}){
    const next=norm(route);
    if(!valid(next))throw new Error(`Invalid ${appId} route.`);
    const prev=current;
    history.replaceState(pack(next),'',location.href);
    current=next;
    return renderRoute?accept(next,'replace',prev):next;
  }

  function back(){
    if(!grammarFoundations){history.back();return}
    const parent=fallbackParent(current);
    if(!parent){history.back();return}
    const delta=Math.max(1,depth(current)-depth(parent));
    history.go(-delta);
  }
  function route(){return current?{...current}:null}
  function destroy(){window.removeEventListener('popstate',onPop);started=false;current=null}

  return {init,navigate,replace,back,currentRoute:route,isAppState:state=>Boolean(unpack(state)),destroy,text};
}
