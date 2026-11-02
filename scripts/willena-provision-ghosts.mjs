// GitHub Actions only. No secrets are printed or written to the repository.
const url=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const mode=process.env.PROVISION_MODE||"pilot";
if(!url.startsWith("https://")||!key)throw Error("Missing Supabase URL or administrative secret");
if(!["pilot","remaining"].includes(mode))throw Error("Invalid provisioning mode");
const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
async function request(path,{method="GET",body,prefer}={}){
 const h={...headers};if(prefer)h.Prefer=prefer;
 const res=await fetch(url+path,{method,headers:h,body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw Error("Supabase "+method+" "+path.split("?")[0]+" returned "+res.status+": "+String(data?.message||data?.error||"unknown").slice(0,120));
 return data;
}
const slots=await request("/rest/v1/willena_load_test_roster_v1?select=label,slot,auth_user_id,profile_id,enabled&order=slot.asc");
if(!Array.isArray(slots)||slots.length!==50)throw Error("Expected exactly 50 reserved test slots; got "+slots?.length);
let created=0;
for(const slot of slots){
 if(mode==="pilot"&&slot.label!=="AA")continue;
 if(slot.auth_user_id&&slot.profile_id){
  const found=await request("/rest/v1/profiles?select=id,is_ghost,role,username&id=eq."+slot.profile_id);
  if(found?.[0]?.id!==slot.profile_id||found[0].is_ghost!==true||found[0].role!=="student")throw Error("Linked profile failed ghost verification for "+slot.label);
  console.log(slot.label+": existing verified ghost, skipped.");continue;
 }
 if(slot.auth_user_id||slot.profile_id)throw Error(slot.label+" is partially linked; manual reconciliation required.");
 const name=slot.label;
 const email="loadtest-"+name.toLowerCase()+"@willenaenglish.com";
 // Halt if there is a profile with that username; never overwrite a real account.
 const existing=await request("/rest/v1/profiles?select=id,is_ghost&username=eq.ghost-"+name.toLowerCase());
 if(existing.length)throw Error(name+" already exists outside the roster; manual reconciliation required.");
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 const password=Buffer.from(bytes).toString("hex");
 // The createUser API doesn't email a password; the load generator will use separate server-side access.
 const auth=await request("/auth/v1/admin/users",{method:"POST",body:{email,password,email_confirm:true,app_metadata:{willena_ghost:true,load_test:true}}});
 const uid=auth?.id||auth?.user?.id;
 if(!uid)throw Error(name+" auth identity missing. Stop for reconciliation.");
 console.log(name+": authentication account created.");
 try {
  await request("/rest/v1/profiles?on_conflict=id",{method:"POST",prefer:"resolution=merge-duplicates",body:{id:uid,email,username:"ghost-"+name.toLowerCase(),name,role:"student",approved:true,class:"Load Test",is_ghost:true}});
  const proof=await request("/rest/v1/profiles?select=id,is_ghost,role,class&id=eq."+uid);
  if(proof?.[0]?.is_ghost!==true||proof[0].role!=="student"||proof[0].class!=="Load Test")throw Error("Profile verification failed");
  await request("/rest/v1/willena_load_test_roster_v1?label=eq."+name,{method:"PATCH",prefer:"return=representation",body:{auth_user_id:uid,profile_id:uid,enabled:false}});
  const done=await request("/rest/v1/willena_load_test_roster_v1?select=label,profile_id,auth_user_id,enabled&label=eq."+name);
  if(done?.[0]?.auth_user_id!==uid||done[0].profile_id!==uid||done[0].enabled!==false)throw Error("Roster verification failed");
 }catch(error){console.error(name+": partial account may exist. Do not retry before reconciliation.");throw error;}
 created++;
 console.log(name+": verified ghost created and linked, simulator disabled.");
}
console.log("Completed. Newly provisioned:",created,". Mode:",mode);
