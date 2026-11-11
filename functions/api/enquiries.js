// Cloudflare Pages Function on teachers.willenaenglish.com.
// Same-origin admin enquiries proxy; cookie remains HttpOnly and never enters page JS.
const EDGE='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/website-enquiries-admin';
export async function onRequest({request}){
  if(request.method!=='GET'&&request.method!=='POST')return Response.json({success:false,error:'Method not allowed'},{status:405,headers:{'Cache-Control':'no-store'}});
  const cookie=request.headers.get('Cookie')||'';
  const match=cookie.match(/(?:^|;\s*)sb_access=([^;]+)/);
  let token='';
  try{token=match?decodeURIComponent(match[1]):''}catch{}
  if(!token)return Response.json({success:false,error:'Admin login required'},{status:401,headers:{'Cache-Control':'no-store'}});
  const incoming=new URL(request.url);
  const upstream=new URL(EDGE);
  upstream.search=incoming.search;
  try{
    const response=await fetch(upstream,{
      method:request.method,
      headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
      body:request.method==='POST'?await request.text():undefined
    });
    return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch(e){
    console.error('Same-origin enquiries proxy failure',e);
    return Response.json({success:false,error:'Enquiries service temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
