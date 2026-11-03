// Willena Live Classroom Presence — isolated P1 service. No student app writes in P1.
const ORIGINS = new Set([
  "https://students.willenaenglish.com",
  "https://teachers.willenaenglish.com",
  "https://staging.willenaenglish.com",
  "https://cf.willenaenglish.com",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPS = new Set(["word","grammar","sentence","writing","puzzles","test_prep","dashboard","other"]);
const TTL_MS = 90_000;
const IDLE_MS = 60_000;
const MAX_BODY = 2048;
function reply(data, status=200, origin="") {
  const headers = new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  if (ORIGINS.has(origin)) { headers.set("Access-Control-Allow-Origin",origin); headers.set("Access-Control-Allow-Credentials","true"); headers.set("Vary","Origin"); }
  return new Response(JSON.stringify(data),{status,headers});
}
function tokenFrom(req) {
  const authorization = req.headers.get("Authorization")||"";
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i,"").trim();
  const match=(req.headers.get("Cookie")||"").match(/(?:^|;\s*)sb_access=([^;]+)/);
  if(!match) return "";
  try{return decodeURIComponent(match[1]);}catch{return "";}
}
async function identity(req,env) {
  const token=tokenFrom(req);
  if(!token || token.length>8192) return null;
  const auth=env.SUPABASE_AUTH;
  if(!auth || typeof auth.fetch!=="function") throw new Error("Auth binding unavailable");
  const headers=new Headers({"Authorization":"Bearer "+token});
  const who=await auth.fetch(new Request("https://supabase-auth.internal/?action=whoami",{headers}));
  if(!who.ok) return null;
  const verified=await who.json();
  if(!verified.success || !UUID.test(verified.user_id||"")) return null;
  // Resolve role/name/class only AFTER verifying token ownership.
  const profileResponse=await auth.fetch(new Request(
    "https://supabase-auth.internal/?action=get_profile&user_id="+encodeURIComponent(verified.user_id),
    {headers}
  ));
  if(!profileResponse.ok) throw new Error("Profile lookup failed");
  const profile=await profileResponse.json();
  if(!profile.success || profile.approved!==true) return null;
  return {
    id:verified.user_id,
    name:String(profile.name||"").slice(0,100),
    class:String(profile.class||"").slice(0,100),
    role:String(profile.role||"").toLowerCase()
  };
}
function textField(x,n=100) { return typeof x==="string"?x.trim().slice(0,n):""; }
async function body(req) {
  const size=Number(req.headers.get("Content-Length")||0);
  if(size>MAX_BODY) throw new Error("Payload too large");
  const raw=await req.text();
  if(raw.length>MAX_BODY) throw new Error("Payload too large");
  return JSON.parse(raw);
}
export default {
  async fetch(req,env) {
    const origin=req.headers.get("Origin")||"";
    const url=new URL(req.url);
    if(req.method==="OPTIONS") {
      if(!ORIGINS.has(origin)) return reply({error:"Origin not allowed"},403,origin);
      return new Response(null,{status:204,headers:{
        "Access-Control-Allow-Origin":origin,
        "Access-Control-Allow-Credentials":"true",
        "Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type,Authorization",
        "Access-Control-Max-Age":"600","Vary":"Origin"
      }});
    }
    if(url.pathname==="/health" && req.method==="GET") return reply({ok:true,service:"live-presence",version:1},200,origin);
    if(!ORIGINS.has(origin)) return reply({error:"Origin not allowed"},403,origin);
    if(!["/v1/heartbeat","/v1/disconnect","/v1/presence"].includes(url.pathname)) return reply({error:"Not found"},404,origin);
    try {
      const user=await identity(req,env);
      if(!user) return reply({error:"Not authenticated"},401,origin);
      const stub=env.PRESENCE.get(env.PRESENCE.idFromName("willena-live-classroom-v1"));
      if(url.pathname==="/v1/presence") {
        if(req.method!=="GET") return reply({error:"Method not allowed"},405,origin);
        if(!["teacher","admin"].includes(user.role)) return reply({error:"Teacher access required"},403,origin);
        const result=await stub.fetch("https://presence.internal/snapshot");
        return reply(await result.json(),result.status,origin);
      }
      if(user.role!=="student") return reply({error:"Student access required"},403,origin);
      if(!["POST","DELETE"].includes(req.method)) return reply({error:"Method not allowed"},405,origin);
      const data=await body(req);
      if(!UUID.test(data.session_id||"")) return reply({error:"Invalid session_id"},400,origin);
      if(url.pathname==="/v1/disconnect" || req.method==="DELETE") {
        await stub.fetch("https://presence.internal/disconnect",{method:"POST",body:JSON.stringify({student_id:user.id,session_id:data.session_id})});
        return reply({ok:true},200,origin);
      }
      const app=textField(data.app,30);
      if(!APPS.has(app)) return reply({error:"Invalid app"},400,origin);
      const lastInteractionAge=Math.max(0,Math.min(3_600_000,Number(data.last_interaction_age_ms)||0));
      const payload={
        student_id:user.id,name:user.name,class:user.class,session_id:data.session_id,app,
        book:textField(data.book),unit:textField(data.unit),activity:textField(data.activity),
        assignment_id:UUID.test(data.assignment_id||"")?data.assignment_id:null,
        assignment_match:data.assignment_match===true,
        entered_via_homework:data.entered_via_homework===true,
        last_interaction_age_ms:lastInteractionAge,
        // Client activity information is display-only, never used for scoring or auth.
      };
      const r=await stub.fetch("https://presence.internal/heartbeat",{method:"POST",body:JSON.stringify(payload)});
      return reply(await r.json(),r.status,origin);
    } catch(e) {
      return reply({error:e instanceof SyntaxError?"Invalid JSON":"Presence service unavailable"},e instanceof SyntaxError?400:503,origin);
    }
  }
};
export class PresenceRoom {
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(req) {
    const path=new URL(req.url).pathname,now=Date.now();
    await this.state.storage.sql.exec("CREATE TABLE IF NOT EXISTS sessions (student_id TEXT NOT NULL,session_id TEXT NOT NULL,payload TEXT NOT NULL,seen_at INTEGER NOT NULL,PRIMARY KEY(student_id,session_id))");
    this.state.storage.sql.exec("DELETE FROM sessions WHERE seen_at < ?",now-TTL_MS);
    if(path==="/heartbeat" && req.method==="POST") {
      const data=await req.json();
      this.state.storage.sql.exec("INSERT INTO sessions(student_id,session_id,payload,seen_at) VALUES(?,?,?,?) ON CONFLICT(student_id,session_id) DO UPDATE SET payload=excluded.payload,seen_at=excluded.seen_at",data.student_id,data.session_id,JSON.stringify(data),now);
      return Response.json({ok:true,expires_in_seconds:90});
    }
    if(path==="/disconnect" && req.method==="POST"){
      const data=await req.json();
      this.state.storage.sql.exec("DELETE FROM sessions WHERE student_id=? AND session_id=?",data.student_id,data.session_id);
      return Response.json({ok:true});
    }
    if(path==="/snapshot" && req.method==="GET") {
      const rows=[...this.state.storage.sql.exec("SELECT payload,seen_at FROM sessions")].map(r=>{
        const p=JSON.parse(r.payload);
        const age=now-r.seen_at;
        return {...p,seen_at:new Date(r.seen_at).toISOString(),status:age+p.last_interaction_age_ms<IDLE_MS?"active":"idle"};
      });
      // Multiple tabs/devices retain separate session identities; consumer may group by student.
      rows.sort((a,b)=>a.class.localeCompare(b.class)||a.name.localeCompare(b.name)||a.session_id.localeCompare(b.session_id));
      return Response.json({ok:true,as_of:new Date(now).toISOString(),online_sessions:rows.length,sessions:rows});
    }
    return Response.json({error:"Not found"},{status:404});
  }
}
