// P3: authenticated proxy to isolated Live Classroom presence Worker.
// Existing Cloudflare Pages host receives the student's same-site auth cookie.
const WORKER="https://willena-live-presence.willena.workers.dev";
const allowed=new Set(["students.willenaenglish.com","staging.willenaenglish.com"]);
function result(data,status){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}})}
export async function onRequestPost({request,env}){
 const origin=new URL(request.url).hostname;
 if(!allowed.has(origin))return result({error:"Unapproved host"},403);
 const cookie=request.headers.get("Cookie")||"",bearer=request.headers.get("Authorization")||"";
 if(!/(?:^|;\s*)sb_access=/.test(cookie)&&!/^Bearer\s+/i.test(bearer))return result({error:"Not authenticated"},401);
 const size=Number(request.headers.get("Content-Length")||0);if(size>2048)return result({error:"Payload too large"},413);
 let body;try{body=await request.text();if(body.length>2048) return result({error:"Payload too large"},413);}catch{return result({error:"Invalid payload"},400)}
 const url=env.LIVE_PRESENCE_WORKER_URL||WORKER;
 if(!/^https:\/\/[-\w.]+\.workers\.dev$/i.test(url))return result({error:"Presence configuration unavailable"},503);
 try{
  const headers=new Headers({"Origin":"https://students.willenaenglish.com","Content-Type":"application/json"});
  if(cookie)headers.set("Cookie",cookie);if(bearer)headers.set("Authorization",bearer);
  const response=await fetch(url+"/v1/heartbeat",{method:"POST",headers,body,redirect:"manual"});
  return new Response(response.body,{status:response.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
 }catch{return result({error:"Presence service unreachable"},503)}
}
