const NAV_KEY='willenaVocabNav';
const DEPTH_KEY='willenaVocabDepth';

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
function stateFor(route,depth){
  return {[NAV_KEY]:true,[DEPTH_KEY]:Math.max(0,Math.floor(depth)||0),route:cleanRoute(route)};
}
function sameRoute(a,b){
  return Object.keys(a).every(key=>a[key]===b[key]);
}
export function createVocabHistoryNavigation({applyRoute}={}){
  if(typeof applyRoute!=='function')throw new Error('applyRoute callback is required');
  let started=false,applying=false;
  const owned=()=>history.state?.[NAV_KEY]===true;
  const current=()=>owned()?cleanRoute(history.state.route):{screen:'home'};
  const depth=()=>owned()?Math.max(0,Number(history.state[DEPTH_KEY])||0):0;

  async function apply(route,{fromPop=false}={}){
    applying=true;
    try{await applyRoute(cleanRoute(route),{fromPop})}
    finally{applying=false}
  }
  function replace(route){
    const clean=cleanRoute(route);
    history.replaceState(stateFor(clean,depth()),'',location.href);
    return clean;
  }
  function push(route){
    const clean=cleanRoute(route),previous=current();
    // Repeated starts, retries and changes between practice modes should
    // update the active entry, not add one browser Back step per session.
    if(sameRoute(previous,clean)||(previous.screen==='activity'&&clean.screen==='activity')
       ||(previous.screen==='book'&&clean.screen==='book')){
      return replace(clean);
    }
    history.pushState(stateFor(clean,depth()+1),'',location.href);
    return clean;
  }
  async function start(initialRoute={screen:'home'}){
    if(started)return;
    started=true;
    const existing=owned()?cleanRoute(history.state.route):null;
    // Bring older Word Genius entries under the new depth counter without
    // changing the current screen. New entries will be fully tracked.
    const route=existing||cleanRoute(initialRoute);
    if(!existing||!Number.isFinite(Number(history.state?.[DEPTH_KEY])))replace(route);
    window.addEventListener('popstate',async event=>{
      const route=event.state?.[NAV_KEY]?cleanRoute(event.state.route):{screen:'home'};
      await apply(route,{fromPop:true});
    });
    await apply(route,{fromPop:false});
  }
  function back(fallback={screen:'home'}){
    if(owned()&&depth()>0){history.back();return}
    const route=replace(fallback);
    void apply(route,{fromPop:false});
  }
  function home(){
    if(owned()&&depth()>0){
      // One jump to the original Word Genius home, however many sessions
      // have been opened; the next push discards the forward activity trail.
      history.go(-depth());
      return;
    }
    const route=replace({screen:'home'});
    void apply(route,{fromPop:false});
  }
  return {
    start,push,replace,back,home,
    get applying(){return applying},
    current,
    isActivity(){return current().screen==='activity'},
    depth
  };
}
