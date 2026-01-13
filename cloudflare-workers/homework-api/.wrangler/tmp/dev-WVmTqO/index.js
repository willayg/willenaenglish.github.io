var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-osIH7m/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/index.js
var ALLOWED_ORIGINS = [
  "https://willenaenglish.com",
  "https://www.willenaenglish.com",
  "https://willenaenglish.netlify.app",
  "https://willenaenglish.github.io",
  "http://localhost:8888",
  "http://localhost:9000"
];
function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function jsonResponse(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(origin)
    }
  });
}
__name(jsonResponse, "jsonResponse");
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name) {
      cookies[name] = decodeURIComponent(rest.join("="));
    }
  });
  return cookies;
}
__name(parseCookies, "parseCookies");
async function getUserFromToken(env, token) {
  if (!token) return null;
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${token}`
      }
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}
__name(getUserFromToken, "getUserFromToken");
async function getUserIdFromRequest(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token2 = authHeader.slice(7);
    const user2 = await getUserFromToken(env, token2);
    if (user2?.id) return user2.id;
  }
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["sb_access"];
  if (!token) return null;
  const user = await getUserFromToken(env, token);
  return user?.id || null;
}
__name(getUserIdFromRequest, "getUserIdFromRequest");
async function fetchProfile(env, userId, fields = "id,role,approved,class,name,korean_name") {
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=${fields}`,
    {
      headers: {
        "apikey": env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data && data[0] ? data[0] : null;
}
__name(fetchProfile, "fetchProfile");
function generateRunToken(assignmentId) {
  const t = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `run_${assignmentId}_${t}_${rand}`;
}
__name(generateRunToken, "generateRunToken");
async function supabaseSelect(env, table, query, options = {}) {
  let url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`;
  const resp = await fetch(url, {
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      ...options.headers
    }
  });
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error);
  }
  return resp.json();
}
__name(supabaseSelect, "supabaseSelect");
async function supabaseInsert(env, table, data, options = {}) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.returning !== false ? "return=representation" : "return=minimal"
    },
    body: JSON.stringify(data)
  });
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error);
  }
  if (options.returning === false) return true;
  return resp.json();
}
__name(supabaseInsert, "supabaseInsert");
async function supabaseUpdate(env, table, query, data) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify(data)
  });
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(error);
  }
  return resp.json();
}
__name(supabaseUpdate, "supabaseUpdate");
async function supabaseDelete(env, table, query) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=minimal"
    }
  });
  return resp.ok;
}
__name(supabaseDelete, "supabaseDelete");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = getCorsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    const action = url.searchParams.get("action") || "list_assignments";
    const mode = url.searchParams.get("mode") || "teacher";
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      return jsonResponse({ success: false, error: "Supabase environment variables missing" }, 500, origin);
    }
    try {
      if (action === "create_assignment") {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const prof = await fetchProfile(env, authUserId);
        if (!prof) {
          return jsonResponse({ success: false, error: "Profile not found" }, 403, origin);
        }
        if (!["teacher", "admin"].includes(String(prof.role || "").toLowerCase())) {
          return jsonResponse({ success: false, error: "Only teachers can create assignments" }, 403, origin);
        }
        if (prof.approved === false) {
          return jsonResponse({ success: false, error: "Teacher not approved" }, 403, origin);
        }
        const body = await request.json();
        const {
          class: className,
          title,
          description,
          list_key,
          list_title,
          list_meta,
          start_at,
          due_at,
          goal_type,
          goal_value
        } = body;
        if (!className || !title || !list_key || !due_at) {
          return jsonResponse({
            success: false,
            error: "Missing required fields: class, title, list_key, due_at"
          }, 400, origin);
        }
        const insertData = {
          class: className,
          title,
          description: description || null,
          list_key,
          list_title: list_title || null,
          list_meta: list_meta || {},
          start_at: start_at || (/* @__PURE__ */ new Date()).toISOString(),
          due_at,
          goal_type: goal_type || "stars",
          goal_value: goal_value || 5,
          active: true,
          created_by: prof.id
        };
        const data = await supabaseInsert(env, "homework_assignments", insertData);
        return jsonResponse({ success: true, assignment: data[0] }, 200, origin);
      }
      if (action === "create_run") {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const prof = await fetchProfile(env, authUserId);
        if (!prof || !["teacher", "admin"].includes(String(prof.role || "").toLowerCase())) {
          return jsonResponse({ success: false, error: "Only teachers can create run tokens" }, 403, origin);
        }
        const assignmentId = url.searchParams.get("assignment_id") || url.searchParams.get("id");
        if (!assignmentId) {
          return jsonResponse({ success: false, error: "Missing assignment_id" }, 400, origin);
        }
        const assignments = await supabaseSelect(env, "homework_assignments", `id=eq.${assignmentId}&select=id,list_meta`);
        if (!assignments || !assignments.length) {
          return jsonResponse({ success: false, error: "Assignment not found" }, 404, origin);
        }
        const current = assignments[0];
        const token = generateRunToken(assignmentId);
        const list_meta = current.list_meta || {};
        const prev = Array.isArray(list_meta.run_tokens) ? list_meta.run_tokens : [];
        const updated = {
          ...list_meta,
          run_tokens: [...prev, { token, created_at: (/* @__PURE__ */ new Date()).toISOString() }]
        };
        await supabaseUpdate(env, "homework_assignments", `id=eq.${assignmentId}`, { list_meta: updated });
        return jsonResponse({ success: true, assignment_id: assignmentId, run_token: token }, 200, origin);
      }
      if (action === "get_run_token") {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const prof = await fetchProfile(env, authUserId);
        if (!prof) {
          return jsonResponse({ success: false, error: "Profile not found" }, 401, origin);
        }
        const assignmentId = url.searchParams.get("assignment_id") || url.searchParams.get("id");
        const listKey = url.searchParams.get("list_key") || url.searchParams.get("list_name");
        if (!assignmentId && !listKey) {
          return jsonResponse({ success: false, error: "Missing assignment_id or list_key" }, 400, origin);
        }
        let assignment = null;
        if (assignmentId) {
          const data = await supabaseSelect(env, "homework_assignments", `id=eq.${assignmentId}&select=*`);
          assignment = data && data[0];
        } else if (listKey) {
          const data = await supabaseSelect(
            env,
            "homework_assignments",
            `class=eq.${encodeURIComponent(prof.class)}&active=eq.true&list_key=ilike.*${encodeURIComponent(listKey)}*&order=created_at.desc&limit=1&select=*`
          );
          assignment = data && data[0];
        }
        if (!assignment) {
          return jsonResponse({ success: false, error: "Assignment not found" }, 404, origin);
        }
        if (String(assignment.class || "") !== String(prof.class || "")) {
          return jsonResponse({ success: false, error: "Not assigned to this class" }, 403, origin);
        }
        const tokens = Array.isArray(assignment.list_meta?.run_tokens) ? assignment.list_meta.run_tokens.map((r) => r?.token).filter(Boolean) : [];
        return jsonResponse({ success: true, assignment_id: assignment.id, tokens }, 200, origin);
      }
      if (action === "list_assignments") {
        if (mode === "student") {
          const authUserId = await getUserIdFromRequest(request, env);
          if (!authUserId) {
            return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
          }
          const prof = await fetchProfile(env, authUserId);
          if (!prof) {
            return jsonResponse({ success: false, error: "Profile not found" }, 401, origin);
          }
          if (!prof.class) {
            return jsonResponse({ success: false, error: "No class set for this profile" }, 400, origin);
          }
          const nowIso = (/* @__PURE__ */ new Date()).toISOString();
          const data2 = await supabaseSelect(
            env,
            "homework_assignments",
            `class=eq.${encodeURIComponent(prof.class)}&active=eq.true&start_at=lte.${nowIso}&order=due_at.asc&select=*`
          );
          return jsonResponse({
            success: true,
            class: prof.class,
            student_name: prof.name || prof.korean_name || null,
            assignments: data2 || []
          }, 200, origin);
        }
        const className = url.searchParams.get("class");
        let query = "order=created_at.desc&select=*";
        if (className) {
          query = `class=eq.${encodeURIComponent(className)}&${query}`;
        }
        const data = await supabaseSelect(env, "homework_assignments", query);
        return jsonResponse({ success: true, assignments: data || [] }, 200, origin);
      }
      if (action === "end_assignment") {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const prof = await fetchProfile(env, authUserId);
        if (!prof || !["teacher", "admin"].includes(String(prof.role || "").toLowerCase())) {
          return jsonResponse({ success: false, error: "Only teachers can end assignments" }, 403, origin);
        }
        const body = await request.json();
        const assignmentId = body.id || body.assignment_id;
        if (!assignmentId) {
          return jsonResponse({ success: false, error: "Missing assignment id" }, 400, origin);
        }
        const data = await supabaseUpdate(
          env,
          "homework_assignments",
          `id=eq.${assignmentId}`,
          { active: false, ended_at: (/* @__PURE__ */ new Date()).toISOString() }
        );
        return jsonResponse({ success: true, assignment: data[0] }, 200, origin);
      }
      if (action === "delete_assignment") {
        const authUserId = await getUserIdFromRequest(request, env);
        if (!authUserId) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const prof = await fetchProfile(env, authUserId);
        if (!prof || !["teacher", "admin"].includes(String(prof.role || "").toLowerCase())) {
          return jsonResponse({ success: false, error: "Only teachers can delete assignments" }, 403, origin);
        }
        const assignmentId = url.searchParams.get("id") || url.searchParams.get("assignment_id");
        if (!assignmentId) {
          return jsonResponse({ success: false, error: "Missing assignment id" }, 400, origin);
        }
        await supabaseDelete(env, "homework_assignments", `id=eq.${assignmentId}`);
        return jsonResponse({ success: true }, 200, origin);
      }
      if (action === "assignment_progress") {
        let parseSummary = function(summary) {
          if (!summary) return null;
          if (typeof summary === "object") return summary;
          try {
            return JSON.parse(summary);
          } catch {
            return null;
          }
        }, deriveStars = function(summary) {
          const s = summary || {};
          let acc = null;
          if (typeof s.accuracy === "number") acc = s.accuracy;
          else if (typeof s.score === "number" && typeof s.total === "number" && s.total > 0) {
            acc = s.score / s.total;
          }
          if (acc !== null) {
            if (acc >= 1) return 5;
            if (acc >= 0.95) return 4;
            if (acc >= 0.9) return 3;
            if (acc >= 0.8) return 2;
            if (acc >= 0.6) return 1;
            return 0;
          }
          if (typeof s.stars === "number") return s.stars;
          return 0;
        };
        __name(parseSummary, "parseSummary");
        __name(deriveStars, "deriveStars");
        const assignmentId = url.searchParams.get("assignment_id") || url.searchParams.get("id");
        const className = url.searchParams.get("class");
        if (!assignmentId) {
          return jsonResponse({ success: false, error: "Missing assignment_id" }, 400, origin);
        }
        const assignments = await supabaseSelect(env, "homework_assignments", `id=eq.${assignmentId}&select=*`);
        if (!assignments || !assignments.length) {
          return jsonResponse({ success: false, error: "Assignment not found" }, 404, origin);
        }
        const assignment = assignments[0];
        const targetClass = className || assignment.class;
        const students = await supabaseSelect(
          env,
          "profiles",
          `class=eq.${encodeURIComponent(targetClass)}&select=id,name,korean_name`
        );
        if (!students || !students.length) {
          return jsonResponse({
            success: true,
            assignment_id: assignment.id,
            class: targetClass,
            progress: []
          }, 200, origin);
        }
        const studentIds = students.map((s) => s.id);
        const sessions = await supabaseSelect(
          env,
          "progress_sessions",
          `user_id=in.(${studentIds.join(",")})&ended_at=not.is.null&select=user_id,list_name,mode,summary,list_size`
        );
        const byStudent = /* @__PURE__ */ new Map();
        students.forEach((st) => {
          byStudent.set(st.id, {
            user_id: st.id,
            name: st.name,
            korean_name: st.korean_name,
            modes: {},
            list_size: null
          });
        });
        const listKeyLower = (assignment.list_key || "").toLowerCase();
        const filteredSessions = (sessions || []).filter((sess) => {
          const listName = (sess.list_name || "").toLowerCase();
          return listName.includes(listKeyLower) || listKeyLower.includes(listName.split("/").pop());
        });
        filteredSessions.forEach((sess) => {
          const row = byStudent.get(sess.user_id);
          if (!row) return;
          if (Number.isFinite(sess.list_size) && sess.list_size > 0) {
            row.list_size = sess.list_size;
          }
          const summary = parseSummary(sess.summary);
          const stars = deriveStars(summary);
          const modeKey = sess.mode || "unknown";
          const prev = row.modes[modeKey];
          if (prev) {
            if (stars > prev.stars) prev.stars = stars;
            prev.sessions += 1;
          } else {
            row.modes[modeKey] = { stars, sessions: 1 };
          }
        });
        const totalModes = assignment.list_meta?.modes_total || 6;
        const progress = Array.from(byStudent.values()).map((r) => {
          const modesArr = Object.entries(r.modes).map(([mode2, v]) => ({
            mode: mode2,
            bestStars: v.stars,
            sessions: v.sessions
          }));
          const starsEarned = modesArr.reduce((sum, m) => sum + (m.bestStars || 0), 0);
          const modesAttempted = modesArr.filter((m) => m.bestStars >= 1).length;
          const completionPercent = totalModes > 0 ? Math.round(modesAttempted / totalModes * 100) : 0;
          return {
            user_id: r.user_id,
            name: r.name,
            korean_name: r.korean_name,
            stars: starsEarned,
            completion: completionPercent,
            modes_attempted: modesAttempted,
            modes_total: totalModes,
            modes: modesArr,
            status: assignment.active ? completionPercent >= 100 || starsEarned >= (assignment.goal_value || 5) ? "Completed" : "In Progress" : "Ended"
          };
        });
        return jsonResponse({
          success: true,
          assignment_id: assignment.id,
          class: targetClass,
          total_modes: totalModes,
          progress
        }, 200, origin);
      }
      return jsonResponse({ success: false, error: "Invalid action" }, 400, origin);
    } catch (error) {
      console.error("[homework-api] Error:", error);
      return jsonResponse({ success: false, error: error.message || "Server error" }, 500, origin);
    }
  }
};

// C:/Users/WILLIAM/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/WILLIAM/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-osIH7m/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/WILLIAM/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-osIH7m/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
