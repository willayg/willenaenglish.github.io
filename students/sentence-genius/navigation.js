// Sentence Genius navigation; same shallow back/home semantics as Word Genius,
// with independent history keys so switching apps cannot restore the wrong screen.
const TAG='willenaSentenceGeniusNav';
const route=r=>({screen:['home','book','activity'].includes(r?.screen)?r.screen:'home',
  bookId:String(r?.bookId||''),unitId:String(r?.unitId||''),
  mode:['coach','unscramble','speaking'].includes(r?.mode)?r.mode:''});
export function createNavigation(onRoute){
  const ours=()=>history.state?.[TAG]===true;
  let ready=false;
  const current=()=>ours()?route(history.state.route):route({screen:'home'});
  function replace(to){history.replaceState({[TAG]:true,depth:ours()?history.state.depth:0,route:route(to)},'');}
  function push(to){
    const next=route(to),prev=current();
    if(prev.screen===next.screen ||(prev.screen==='book'&&next.screen==='activity'&&history.state?.depth>1)){
      replace(next);return;
    }
    history.pushState({[TAG]:true,depth:(ours()?Number(history.state.depth):0)+1,route:next},'');
  }
  async function start(){
    if(ready)return;ready=true;
    const initial=ours()?current():route({screen:'home'});
    if(!ours())replace(initial);
    window.addEventListener('popstate',()=>void onRoute(current()));
    await onRoute(initial);
  }
  function home(){
    const depth=ours()?Math.max(0,Number(history.state.depth)||0):0;
    if(depth>0)history.go(-depth);
    else {replace({screen:'home'});void onRoute(current());}
  }
  function back(){
    const depth=ours()?Math.max(0,Number(history.state.depth)||0):0;
    if(depth>0)history.back();
    else {replace({screen:'home'});void onRoute(current());}
  }
  return {current,start,push,replace,home,back};
}
