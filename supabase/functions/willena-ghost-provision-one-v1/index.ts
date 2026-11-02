// Deploy as a Supabase Edge Function named willena-ghost-provision-one-v1.
// The browser never receives the service-role key.
const origin="https://teachers.willenaenglish.com";
const url=Deno.env.get("SUPABASE_URL")||"";
const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers});
async function service(path,init={}) {
 const r=await fetch(url+path,{...init,headers:{apikey:secret,authorization:"Bearer "+secret,"Content-Type":"application/json",...(init.headers||{})}});
 const data=await r.json().catch(()=>null);
 if(!r.ok)throw Error(data?.message||data?.error||"HTTP "+r.status);
 return data;
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST"||req.headers.get("origin")!==origin)return json({error:"forbidden"},403);
 if(!url||!secret||!anon)return json({error:"missing_server_configuration"},503);
 const token=req.headers.get("authorization")||"";
 const identity=await fetch(url+"/auth/v1/user",{headers:{apikey:anon,authorization:token}});
 if(!identity.ok)return json({error:"authentication_required"},401);
 const me=await identity.json();
 const admins=await service("/rest/v1/profiles?select=role&id=eq."+encodeURIComponent(me.id));
 if(admins?.[0]?.role!=="admin")return json({error:"admin_only"},403);
 const body=await req.json().catch(()=>({}));
 const slots=await service("/rest/v1/willena_load_test_roster_v1?select=label,slot,auth_user_id,profile_id,enabled&order=slot.asc");
 const complete=slots.filter(s=>s.auth_user_id&&s.profile_id).length;
 if(body.action==="status")return json({ready:true,total:slots.length,created:complete});
 if(body.action!=="create_one")return json({error:"unknown_action"},400);
 const slot=slots.find(s=>!s.auth_user_id&&!s.profile_id);
 if(!slot)return json({complete:true,total:slots.length,created:complete});
 const email="sim-"+slot.label.toLowerCase()+"@example.invalid";
 const password=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
 let uid=null;
 try {
  const user=await service("/auth/v1/admin/users",{method:"POST",body:JSON.stringify({email,password,email_confirm:true,app_metadata:{willena_ghost:true}})});
  uid=user.id;
  await service("/rest/v1/profiles?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({id:uid,email,username:"sim-"+slot.label.toLowerCase(),name:slot.label,role:"student",approved:true,class:"Load Test",is_ghost:true})});
  await service("/rest/v1/willena_load_test_roster_v1?label=eq."+slot.label,{method:"PATCH",body:JSON.stringify({auth_user_id:uid,profile_id:uid,enabled:false})});
  return json({label:slot.label,created:complete+1,total:slots.length,complete:complete+1===slots.length});
 } catch (err) {
  return json({error:"provision_failed",label:slot.label,partial:uid!==null,detail:String(err).slice(0,160)},500);
 }
});