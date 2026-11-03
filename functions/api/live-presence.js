// Live Classroom read-only proxy for the teachers.willenaenglish.com Pages project.
// Keep this separate from the production API gateway. Auth is enforced again by
// the dedicated presence Worker; only approved teachers may read its snapshot.
const UPSTREAM = "https://willena-live-presence.willena.workers.dev";
const TRUSTED_HOSTS = new Set(["teachers.willenaenglish.com","staging.willenaenglish.com"]);
const json=(data,status)=>new Response(JSON.stringify(data),{
  status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
});
export async function onRequestGet({request,env}) {
  const url=new URL(request.url);
  if(!TRUSTED_HOSTS.has(url.hostname))return json({success:false,error:"Host not permitted"},403);
  // Never accept upstream URL, user IDs or role from a browser.
  const cookie=request.headers.get("Cookie")||"";
  const authorization=request.headers.get("Authorization")||"";
  if(!/(?:^|;\s*)sb_access=/.test(cookie) && !/^Bearer\s+/i.test(authorization)) {
    return json({success:false,error:"Not signed in"},401);
  }
  const upstream=env.LIVE_PRESENCE_WORKER_URL || UPSTREAM;
  if(!/^https:\/\/[-a-z0-9.]+\.workers\.dev$/i.test(upstream))return json({success:false,error:"Invalid presence configuration"},503);
  try{
    const headers=new Headers({"Origin":"https://teachers.willenaenglish.com","Accept":"application/json"});
    if(cookie)headers.set("Cookie",cookie);
    if(authorization)headers.set("Authorization",authorization);
    const response=await fetch(upstream+"/v1/presence",{method:"GET",headers,redirect:"manual"});
    const out=new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Willena-Upstream":"live-presence"});
    return new Response(response.body,{status:response.status,headers:out});
  }catch(e){return json({success:false,error:"Presence Worker unreachable"},503);}
}
