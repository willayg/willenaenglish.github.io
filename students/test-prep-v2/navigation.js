const APP='willena-test-prep-v2';
const VIEWS=new Set(['home','plan','lesson','practice','result','review','mock']);
let renderRoute=null,beforeChange=null,current=null,started=false;

const text=v=>v==null?null:String(v);
function normalize(route={}){
  const view=VIEWS.has(String(route.view||''))?String(route.view):'home';
  const out={view};
  if(view!=='home')out.planId=text(route.planId);
  if(['lesson','practice','result'].includes(view))out.lesson=text(route.lesson);
  if(['practice','result'].includes(view))out.practice=text(route.practice);
  return out;
}
function valid(route){
  if(!route||!VIEWS.has(route.view))return false;
  if(route.view!=='home'&&!route.planId)return false;
  if(['lesson','practice','result'].includes(route.view)&&!route.lesson)return false;
  if(['practice','result'].includes(route.view)&&!route.practice)return false;
  return true;
}
function packed(route){return{app:APP,route:normalize(route)}}
function fromHistory(state){return state?.app===APP&&valid(state.route)?normalize(state.route):null}
function same(a,b){return JSON.stringify(normalize(a))===JSON.stringify(normalize(b))}
function dispatch(route,source){
  const next=normalize(route),prev=current;current=next;
  try{beforeChange?.(prev,next,{source})}catch(e){console.warn('[test-prep-v2 navigation] leave hook failed',e)}
  return renderRoute?.(next,{source,previous:prev});
}
function onPop(event){const route=fromHistory(event.state);if(!route)return;dispatch(route,'popstate')}

export function initNavigation({render,beforeRouteChange,initialRoute={view:'home'}}={}){
  if(started)throw new Error('Test Prep navigation was initialized twice.');
  if(typeof render!=='function')throw new Error('Test Prep navigation needs one route renderer.');
  renderRoute=render;beforeChange=typeof beforeRouteChange==='function'?beforeRouteChange:null;started=true;
  let route=fromHistory(history.state);
  if(!route){route=normalize(initialRoute);history.replaceState(packed(route),'',location.href)}
  current=route;window.addEventListener('popstate',onPop);return route;
}
export function navigate(route){
  const next=normalize(route);if(!valid(next))throw new Error('Invalid Test Prep route.');
  if(same(current,next))return Promise.resolve(current);
  history.pushState(packed(next),'',location.href);return Promise.resolve(dispatch(next,'push'));
}
export function replaceRoute(route,{render=true}={}){
  const next=normalize(route);if(!valid(next))throw new Error('Invalid Test Prep route.');
  history.replaceState(packed(next),'',location.href);if(!render){current=next;return Promise.resolve(next)}return Promise.resolve(dispatch(next,'replace'));
}
export function back(){history.back()}
export function currentRoute(){return current?{...current}:{view:'home'}}
export function isAppHistoryState(state=history.state){return !!fromHistory(state)}
