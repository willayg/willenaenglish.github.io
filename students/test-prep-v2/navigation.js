import {confirmSessionExit,setSessionProtection} from './session-protection.js?v=1.1.0';

const APP='willena-test-prep-v2';
const VIEWS=new Set(['home','plan','lesson','practice','result','review','mock']);
let renderRoute=null,beforeChange=null,current=null,started=false,navigationGuard=null;

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
function allowed(prev,next,source){
  if(prev?.view==='practice'&&next?.view!=='practice'&&!confirmSessionExit())return false;
  if(!navigationGuard)return true;
  try{return navigationGuard(prev,next,{source})!==false}
  catch(e){console.warn('[test-prep-v2 navigation] guard failed',e);return true}
}
function notifyBefore(prev,next,source){
  try{beforeChange?.(prev,next,{source})}catch(e){console.warn('[test-prep-v2 navigation] leave hook failed',e)}
}
function renderAccepted(next,source,prev){
  current=next;setSessionProtection(next.view==='practice');notifyBefore(prev,next,source);return renderRoute?.(next,{source,previous:prev});
}
function onPop(event){
  const next=fromHistory(event.state);if(!next)return;
  const prev=current;
  if(!allowed(prev,next,'popstate')){
    history.pushState(packed(prev||{view:'home'}),'',location.href);return;
  }
  renderAccepted(next,'popstate',prev);
}

export function initNavigation({render,beforeRouteChange,initialRoute={view:'home'}}={}){
  if(started)throw new Error('Test Prep navigation was initialized twice.');
  if(typeof render!=='function')throw new Error('Test Prep navigation needs one route renderer.');
  renderRoute=render;beforeChange=typeof beforeRouteChange==='function'?beforeRouteChange:null;started=true;
  let route=fromHistory(history.state);
  if(!route){route=normalize(initialRoute);history.replaceState(packed(route),'',location.href)}
  current=route;setSessionProtection(route.view==='practice');window.addEventListener('popstate',onPop);return route;
}
export function navigate(route){
  const next=normalize(route);if(!valid(next))throw new Error('Invalid Test Prep route.');
  if(same(current,next))return Promise.resolve(current);
  const prev=current;if(!allowed(prev,next,'push'))return Promise.resolve(prev);
  history.pushState(packed(next),'',location.href);return Promise.resolve(renderAccepted(next,'push',prev));
}
export function replaceRoute(route,{render=true}={}){
  const next=normalize(route);if(!valid(next))throw new Error('Invalid Test Prep route.');
  const prev=current;if(!allowed(prev,next,'replace'))return Promise.resolve(prev);
  history.replaceState(packed(next),'',location.href);
  if(!render){current=next;setSessionProtection(next.view==='practice');return Promise.resolve(next)}
  return Promise.resolve(renderAccepted(next,'replace',prev));
}
export function back(){history.back()}
export function currentRoute(){return current?{...current}:{view:'home'}}
export function isAppHistoryState(state=history.state){return !!fromHistory(state)}
export function setNavigationGuard(fn){
  navigationGuard=typeof fn==='function'?fn:null;
  return()=>{if(navigationGuard===fn)navigationGuard=null};
}
