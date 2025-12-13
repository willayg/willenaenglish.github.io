var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-FsRwCe/checked-fetch.js
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
  // GitHub Pages preview (pages.dev) used for branch previews
  "https://willenaenglish-github-io.pages.dev",
  // Cloudflare Pages deployment
  "https://cf.willenaenglish.com",
  "http://localhost:8888",
  "http://localhost:9000"
];
function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
async function invalidateLeaderboardCache(env) {
  if (!env.LEADERBOARD_CACHE) {
    console.log("[log-word-attempt] No KV namespace bound, skipping cache invalidation");
    return;
  }
  try {
    await env.LEADERBOARD_CACHE.put("invalidate_ts", Date.now().toString(), { expirationTtl: 3600 });
    console.log("[log-word-attempt] Cache invalidation timestamp set");
  } catch (e) {
    console.warn("[log-word-attempt] Cache invalidation error:", e.message);
  }
}
__name(invalidateLeaderboardCache, "invalidateLeaderboardCache");
async function insertRows(env, table, rows) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Insert failed: ${error}`);
  }
  return true;
}
__name(insertRows, "insertRows");
async function upsertSession(env, sessionData) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/progress_sessions`, {
    method: "POST",
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(sessionData)
  });
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Upsert failed: ${error}`);
  }
  return true;
}
__name(upsertSession, "upsertSession");
async function updateSession(env, sessionId, updates) {
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/progress_sessions?session_id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: {
        "apikey": env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(updates)
    }
  );
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Update failed: ${error}`);
  }
  return true;
}
__name(updateSession, "updateSession");
async function fetchSession(env, sessionId) {
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/progress_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=list_name,list_size&limit=1`,
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
__name(fetchSession, "fetchSession");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = getCorsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (request.method === "GET") {
      const selftest = url.searchParams.get("selftest");
      const envCheck = url.searchParams.get("env");
      if (envCheck) {
        return jsonResponse({
          ok: true,
          env: {
            hasUrl: !!env.SUPABASE_URL,
            hasServiceKey: !!env.SUPABASE_SERVICE_KEY,
            hasKV: !!env.LEADERBOARD_CACHE,
            runtime: "cloudflare-workers"
          }
        }, 200, origin);
      }
      if (selftest) {
        try {
          const sid = `selftest-cf-${Date.now()}`;
          await upsertSession(env, { session_id: sid });
          await insertRows(env, "progress_attempts", [{
            session_id: sid,
            mode: "debug",
            word: "ping",
            is_correct: true
          }]);
          return jsonResponse({ ok: true, note: "selftest wrote a row", session_id: sid }, 200, origin);
        } catch (e) {
          return jsonResponse({ ok: false, error: e.message }, 500, origin);
        }
      }
      return jsonResponse({ ok: true, note: "log_word_attempt online (CF Worker)" }, 200, origin);
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method Not Allowed" }, 405, origin);
    }
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = parseCookies(cookieHeader);
    const accessToken = cookies["sb_access"] || cookies["sb-access"] || null;
    const user = await getUserFromToken(env, accessToken);
    const userId = user?.id || null;
    try {
      const body = await request.json();
      const { event_type } = body;
      if (!event_type) {
        return jsonResponse({ error: "Missing event_type" }, 400, origin);
      }
      if (event_type === "session_start") {
        if (!userId) {
          return jsonResponse({ error: "Not signed in. Please log in to start a session." }, 401, origin);
        }
        const { session_id, mode, list_name, list_size, extra } = body;
        if (!session_id) {
          return jsonResponse({ error: "Missing session_id" }, 400, origin);
        }
        await upsertSession(env, {
          session_id,
          user_id: userId,
          mode: mode || null,
          list_name: list_name || null,
          list_size: typeof list_size === "number" ? list_size : null,
          summary: extra || null
        });
        return jsonResponse({ ok: true }, 200, origin);
      }
      if (event_type === "session_end") {
        if (!userId) {
          return jsonResponse({ error: "Not signed in. Please log in to end a session." }, 401, origin);
        }
        const { session_id, mode, extra, list_name, list_size } = body;
        if (!session_id) {
          return jsonResponse({ error: "Missing session_id" }, 400, origin);
        }
        const existing = await fetchSession(env, session_id) || {};
        const updates = {
          ended_at: (/* @__PURE__ */ new Date()).toISOString(),
          summary: extra || null,
          mode: mode || null,
          user_id: userId,
          list_name: list_name || existing.list_name || null,
          list_size: typeof list_size === "number" ? list_size : existing.list_size || null
        };
        await updateSession(env, session_id, updates);
        await invalidateLeaderboardCache(env);
        return jsonResponse({ ok: true }, 200, origin);
      }
      if (event_type === "attempt") {
        if (!userId) {
          return jsonResponse({ error: "Not signed in. Please log in." }, 401, origin);
        }
        const {
          session_id,
          mode,
          word,
          is_correct,
          answer,
          correct_answer,
          points,
          attempt_index,
          duration_ms,
          round,
          extra
        } = body;
        if (!word) {
          return jsonResponse({ error: "Missing word" }, 400, origin);
        }
        if (session_id) {
          await upsertSession(env, {
            session_id,
            user_id: userId,
            mode: mode || null
          });
        }
        let safePoints = 0;
        if (points === 0 || points === null || points === void 0) {
          safePoints = is_correct ? 1 : 0;
        } else {
          const n = Number(points);
          safePoints = Number.isFinite(n) ? n : is_correct ? 1 : 0;
        }
        const row = {
          user_id: userId,
          session_id: session_id || null,
          mode: mode || null,
          word,
          is_correct: !!is_correct,
          answer: answer ?? null,
          correct_answer: correct_answer ?? null,
          points: safePoints,
          attempt_index: attempt_index ?? null,
          duration_ms: duration_ms ?? null,
          round: round ?? null,
          extra: extra || null
        };
        await insertRows(env, "progress_attempts", [row]);
        await invalidateLeaderboardCache(env);
        return jsonResponse({ ok: true }, 200, origin);
      }
      if (event_type === "attempts_batch") {
        if (!userId) {
          return jsonResponse({ error: "Not signed in. Please log in." }, 401, origin);
        }
        const { attempts, session_id, mode } = body;
        if (!Array.isArray(attempts) || !attempts.length) {
          return jsonResponse({ error: "Missing or empty attempts array" }, 400, origin);
        }
        if (session_id) {
          await upsertSession(env, {
            session_id,
            user_id: userId,
            mode: mode || null
          });
        }
        const rows = attempts.map((a) => {
          let safePoints = 0;
          if (a.points === 0 || a.points === null || a.points === void 0) {
            safePoints = a.is_correct ? 1 : 0;
          } else {
            const n = Number(a.points);
            safePoints = Number.isFinite(n) ? n : a.is_correct ? 1 : 0;
          }
          return {
            user_id: userId,
            session_id: session_id || a.session_id || null,
            mode: mode || a.mode || null,
            word: a.word || null,
            is_correct: !!a.is_correct,
            answer: a.answer ?? null,
            correct_answer: a.correct_answer ?? null,
            points: safePoints,
            attempt_index: a.attempt_index ?? null,
            duration_ms: a.duration_ms ?? null,
            round: a.round ?? null,
            extra: a.extra || null
          };
        }).filter((r) => r.word);
        if (!rows.length) {
          return jsonResponse({ error: "No valid attempts in batch" }, 400, origin);
        }
        await insertRows(env, "progress_attempts", rows);
        await invalidateLeaderboardCache(env);
        return jsonResponse({ ok: true, inserted: rows.length }, 200, origin);
      }
      return jsonResponse({ error: "Unknown event_type" }, 400, origin);
    } catch (error) {
      console.error("[log-word-attempt] Error:", error);
      return jsonResponse({ error: error.message }, 500, origin);
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

// .wrangler/tmp/bundle-FsRwCe/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-FsRwCe/middleware-loader.entry.ts
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
