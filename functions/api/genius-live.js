// Same-origin, cookie-forwarding proxy for Genius Live's server-authorized game service.
// The service verifies the Supabase access token and the user's saved profile role.
const upstream="https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/genius-live";
const allowedHosts=new Set(["teachers.willenaenglish.com","students.willenaenglish.com","staging.willenaenglish.com"]);
const json=(value,status)=>new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
export async function onRequest({request}){
 const url=new URL(request.url);
 if(!allowedHosts.has(url.hostname))return json({ok:false,error:"Host not allowed"},403);
 if(request.method!=="POST")return json({ok:false,error:"POST only"},405);
 const cookie=request.headers.get("Cookie")||"";
 if(!/(?:^|;\s*)sb_access=/.test(cookie))return json({ok:false,error:"Sign in to Willena first."},401);
 try{
  const body=await request.text();
  if(body.length>16000)return json({ok:false,error:"Request too large"},413);
  const response=await fetch(upstream,{method:"POST",headers:{"Cookie":cookie,"Content-Type":"application/json","Accept":"application/json"},body,redirect:"manual"});
  return new Response(response.body,{status:response.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
 }catch{return json({ok:false,error:"Live game service is unavailable"},503)}
}