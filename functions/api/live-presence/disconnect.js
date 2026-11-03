const WORKER="https://willena-live-presence.willena.workers.dev";
export async function onRequestPost({request,env}){
 if(!["students.willenaenglish.com","staging.willenaenglish.com"].includes(new URL(request.url).hostname))return new Response(null,{status:403});
 const cookie=request.headers.get("Cookie")||"",auth=request.headers.get("Authorization")||"";
 if(!/(?:^|;\s*)sb_access=/.test(cookie)&&!/^Bearer\s+/i.test(auth))return new Response(null,{status:401});
 const body=await request.text();if(body.length>512)return new Response(null,{status:413});
 const upstream=env.LIVE_PRESENCE_WORKER_URL||WORKER;
 if(!/^https:\/\/[-\w.]+\.workers\.dev$/i.test(upstream))return new Response(null,{status:503});
 try{
  const headers=new Headers({"Origin":"https://students.willenaenglish.com","Content-Type":"application/json"});
  if(cookie)headers.set("Cookie",cookie);if(auth)headers.set("Authorization",auth);
  const res=await fetch(upstream+"/v1/disconnect",{method:"POST",headers,body});
  return new Response(res.body,{status:res.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
 }catch{return new Response(null,{status:503})}
}