const NAV_KEY='willenaVocabNav';

function cleanRoute(route={}){
  const screen=['home','book','wordtest','activity'].includes(route.screen)?route.screen:'home';
  return {
    screen,
    bookId:route.bookId?String(route.bookId):'',
    unitId:route.unitId?String(route.unitId):'',
    parentScreen:['book','wordtest'].includes(route.parentScreen)?route.parentScreen:'',
    activityKind:route.activityKind?String(route.activityKind):'',
    teacherAssignmentId:route.teacherAssignmentId?String(route.teacherAssignmentId):''
  };
}
function stateFor(route){
  return {[NAV_KEY]:true,route:cleanRoute(route)};
}
export function createVocabHistoryNavigation({applyRoute}={}){
  if(typeof applyRoute!=='function')throw new Error('applyRoute callback is required');
  let started=false;
  let applying=false;

  async function apply(route,{fromPop=false}={}){
    applying=true;
    try{await applyRoute(cleanRoute(route),{fromPop})}
    finally{applying=false}
  }
  function replace(route){
    const clean=cleanRoute(route);
    history.replaceState(stateFor(clean),'',location.href);
    return clean;
  }
  function push(route){
    const clean=cleanRoute(route);
    history.pushState(stateFor(clean),'',location.href);
    return clean;
  }
  async function start(initialRoute={screen:'home'}){
    if(started)return;
    started=true;
    const existing=history.state?.[NAV_KEY]?cleanRoute(history.state.route):null;
    const route=existing||replace(initialRoute);
    window.addEventListener('popstate',async event=>{
      const route=event.state?.[NAV_KEY]?cleanRoute(event.state.route):{screen:'home'};
      await apply(route,{fromPop:true});
    });
    await apply(route,{fromPop:false});
  }
  function back(fallback={screen:'home'}){
    if(history.state?.[NAV_KEY])history.back();
    else {
      const route=replace(fallback);
      apply(route,{fromPop:false});
    }
  }
  return {
    start,
    push,
    replace,
    back,
    get applying(){return applying},
    current(){
      return history.state?.[NAV_KEY]?cleanRoute(history.state.route):{screen:'home'};
    },
    isActivity(){
      return this.current().screen==='activity';
    }
  };
}
