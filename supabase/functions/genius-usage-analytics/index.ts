import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Teacher-only Genius Apps analytics. No unauthenticated or student access.
// Aggregate data comes from a service-role-only read function.
const dbUrl = Deno.env.get("SUPABASE_URL") || "https://fiieuiktlsivwfgyivai.supabase.co";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const origins = new Set([
  "https://teachers.willenaenglish.com",
  "https://staging.willenaenglish.com",
  "https://cf.willenaenglish.com",
  "https://willenaenglish.netlify.app",
  "https://willenaenglish.github.io",
  "http://localhost:9000",
  "http://localhost:8888",
  "http://127.0.0.1:9000",
  "http://127.0.0.1:8888"
]);
function headers(req: Request): HeadersInit {
  const origin = req.headers.get("origin") || "";
  return {
    ...(origins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store"
  };
}
function reply(req: Request, code: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status: code, headers: headers(req) });
}
function day(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? value : null;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, {status: 204, headers: headers(req)});
  if (req.method !== "POST") return reply(req, 405, {success:false, error:"POST required"});
  if (!anonKey || !serviceKey) return reply(req, 503, {success:false,error:"Analytics backend not configured"});
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i,"");
  if (!token || token.split(".").length !== 3) return reply(req, 401, {success:false,error:"Teacher login required"});
  try {
    const identityResponse = await fetch(dbUrl + "/auth/v1/user", {
      headers: {apikey: anonKey, Authorization: "Bearer " + token}
    });
    if (!identityResponse.ok) return reply(req, 401, {success:false,error:"Teacher session expired"});
    const identity = await identityResponse.json();
    const uid = String(identity?.id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(uid)) return reply(req,401,{success:false,error:"Invalid teacher identity"});
    const adminHeaders = {
      apikey: serviceKey, Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json"
    };
    const roleResponse = await fetch(
      dbUrl + "/rest/v1/profiles?select=role,approved&id=eq." + encodeURIComponent(uid) + "&limit=1",
      {headers: adminHeaders}
    );
    if (!roleResponse.ok) return reply(req,503,{success:false,error:"Could not check teacher permission"});
    const profiles = await roleResponse.json();
    const staff = Array.isArray(profiles) ? profiles[0] : null;
    if (!staff || !["teacher","admin"].includes(String(staff.role || "").toLowerCase()) || staff.approved===false) {
      return reply(req,403,{success:false,error:"Approved teacher access required"});
    }
    const input = await req.json().catch(()=>({}));
    const days = Number(input.days ?? 30);
    const chosenClass = String(input.class || "").trim().slice(0,100) || null;
    const app = String(input.app || "").trim().toLowerCase() || null;
    if (![7,30,90].includes(days) || (app && !["word","sentence","grammar","talking","writing","puzzles","naesin"].includes(app))) {
      return reply(req,400,{success:false,error:"Invalid analytics filter"});
    }
    const custom = input.start !== undefined || input.end !== undefined;
    const start = custom ? day(input.start) : null;
    const end = custom ? day(input.end) : null;
    if (custom && (!start || !end || end < start || (Date.parse(end)-Date.parse(start))/86400000>89)) {
      return reply(req,400,{success:false,error:"Select a valid 1–90 day range"});
    }
    const aggregate = await fetch(dbUrl + "/rest/v1/rpc/teacher_genius_usage_analytics_v1",{
      method:"POST",
      headers:adminHeaders,
      body:JSON.stringify({p_days:days,p_class:chosenClass,p_app:app,p_start:start,p_end:end})
    });
    const result = await aggregate.json().catch(()=>null);
    if (!aggregate.ok || !result || typeof result !== "object") {
      console.error("genius usage aggregation failure",aggregate.status);
      return reply(req,503,{success:false,error:"Could not load usage analytics"});
    }
    return reply(req,200,{success:true,...result});
  } catch(error) {
    console.error("genius usage endpoint error",error instanceof Error ? error.message : "unknown");
    return reply(req,503,{success:false,error:"Usage analytics temporarily unavailable"});
  }
});