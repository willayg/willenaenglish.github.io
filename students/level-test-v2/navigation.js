const STATE_KEY='willenaLevelTestV2Route';

export function createNavigator({onRoute,initialRoute='welcome'}={}){
  if(typeof onRoute!=='function') throw new Error('Navigator requires onRoute');
  let current=initialRoute;
  let started=false;

  function emit(route,{replace=false,fromPop=false}={}){
    current=route;
    if(!fromPop){
      const state={...(history.state||{}),[STATE_KEY]:route};
      if(replace) history.replaceState(state,'',location.href);
      else history.pushState(state,'',location.href);
    }
    onRoute(route,{fromPop});
  }

  function start(route=initialRoute){
    if(started) return;
    started=true;
    current=history.state?.[STATE_KEY]||route;
    history.replaceState({...(history.state||{}),[STATE_KEY]:current},'',location.href);
    addEventListener('popstate',handlePop);
    onRoute(current,{fromPop:true});
  }

  function handlePop(event){
    const route=event.state?.[STATE_KEY]||initialRoute;
    current=route;
    onRoute(route,{fromPop:true});
  }

  return {
    start,
    go(route){if(route===current){onRoute(route,{fromPop:false});return;}emit(route);},
    replace(route){emit(route,{replace:true});},
    back(){history.back();},
    current(){return current;},
    destroy(){if(started) removeEventListener('popstate',handlePop);started=false;}
  };
}
