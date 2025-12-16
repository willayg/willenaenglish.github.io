var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-Z24Jns/checked-fetch.js
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
  "http://localhost:9000",
  "http://127.0.0.1:8888",
  "http://127.0.0.1:9000"
];
function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Cache-Control": "no-store"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function jsonResponse(data, status = 200, origin = "", cookies = []) {
  const headers = {
    "Content-Type": "application/json",
    ...getCorsHeaders(origin)
  };
  const response = new Response(JSON.stringify(data), { status, headers });
  cookies.forEach((cookie) => {
    response.headers.append("Set-Cookie", cookie);
  });
  return response;
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
function makeCookie(name, value, options = {}) {
  const {
    maxAge = null,
    secure = true,
    httpOnly = true,
    sameSite = "None",
    path = "/",
    domain = null
  } = options;
  let cookie = `${name}=${encodeURIComponent(value || "")}`;
  if (maxAge !== null) cookie += `; Max-Age=${maxAge}`;
  if (path) cookie += `; Path=${path}`;
  if (domain) cookie += `; Domain=${domain}`;
  if (secure) cookie += "; Secure";
  if (httpOnly) cookie += "; HttpOnly";
  if (sameSite) cookie += `; SameSite=${sameSite}`;
  return cookie;
}
__name(makeCookie, "makeCookie");
function isLocalDev(request) {
  const host = request.headers.get("Host") || "";
  const origin = request.headers.get("Origin") || "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1") || origin.includes("localhost:") || origin.includes("127.0.0.1");
}
__name(isLocalDev, "isLocalDev");
function getCookieDomain(request) {
  const host = request.headers.get("Host") || "";
  if (host.includes("willenaenglish.com")) {
    return ".willenaenglish.com";
  }
  return null;
}
__name(getCookieDomain, "getCookieDomain");
async function verifyToken(env, token) {
  if (!token) return null;
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": env.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${token}`
      }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data || null;
  } catch {
    return null;
  }
}
__name(verifyToken, "verifyToken");
async function fetchProfile(env, userId, fields = "*") {
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
async function updateProfile(env, userId, updates) {
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
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
  return resp.ok;
}
__name(updateProfile, "updateProfile");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = getCorsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    const action = url.searchParams.get("action");
    const isDev = isLocalDev(request);
    const cookieDomain = getCookieDomain(request);
    const cookieOpts = {
      maxAge: 60 * 60 * 24 * 30,
      // 30 days
      sameSite: isDev ? "Lax" : "None",
      secure: !isDev,
      domain: cookieDomain
    };
    try {
      if (action === "debug") {
        return jsonResponse({
          success: true,
          hasSupabaseUrl: !!env.SUPABASE_URL,
          hasAnonKey: !!env.SUPABASE_ANON_KEY,
          hasServiceRole: !!env.SUPABASE_SERVICE_KEY,
          runtime: "cloudflare-workers"
        }, 200, origin);
      }
      if (action === "cookie_echo") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const hasAccess = /(?:^|;\s*)sb_access=/.test(cookieHeader);
        const hasRefresh = /(?:^|;\s*)sb_refresh=/.test(cookieHeader);
        return jsonResponse({
          success: true,
          origin: origin || null,
          host: request.headers.get("Host") || null,
          hasAccess,
          hasRefresh
        }, 200, origin);
      }
      if (action === "get_email_by_username") {
        const username = url.searchParams.get("username");
        if (!username) {
          return jsonResponse({ success: false, error: "Missing username" }, 400, origin);
        }
        const resp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=email,approved`,
          {
            headers: {
              "apikey": env.SUPABASE_SERVICE_KEY,
              "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`
            }
          }
        );
        const data = await resp.json();
        if (!data || !data[0]) {
          return jsonResponse({ success: false, error: "Username not found" }, 404, origin);
        }
        if (!data[0].approved) {
          return jsonResponse({ success: false, error: "User not approved" }, 403, origin);
        }
        return jsonResponse({ success: true, email: data[0].email }, 200, origin);
      }
      if (action === "login" && request.method === "POST") {
        const body = await request.json();
        const { email, password } = body;
        if (!email || !password) {
          return jsonResponse({ success: false, error: "Missing credentials" }, 400, origin);
        }
        const profilePromise = fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,approved`,
          {
            headers: {
              "apikey": env.SUPABASE_SERVICE_KEY,
              "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`
            }
          }
        ).then((r) => r.json());
        const authPromise = fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": env.SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ email, password })
        });
        const [profileData, authResp] = await Promise.all([profilePromise, authPromise]);
        const profile = profileData && profileData[0];
        if (!profile || !profile.approved) {
          return jsonResponse({ success: false, error: "User not found or not approved" }, 401, origin);
        }
        const authData = await authResp.json();
        if (!authResp.ok || !authData.access_token) {
          return jsonResponse(
            { success: false, error: authData.error_description || "Invalid credentials" },
            401,
            origin
          );
        }
        const cookies = [
          makeCookie("sb_access", authData.access_token, cookieOpts),
          makeCookie("sb_refresh", authData.refresh_token || "", cookieOpts)
        ];
        const responseBody = { success: true, user: authData.user };
        if (isDev) {
          responseBody.access_token = authData.access_token;
          responseBody.refresh_token = authData.refresh_token || "";
        }
        return jsonResponse(responseBody, 200, origin, cookies);
      }
      if (action === "whoami" && request.method === "GET") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const cookies = parseCookies(cookieHeader);
        const authHeader = request.headers.get("Authorization") || "";
        const tokenFromQuery = url.searchParams.get("token");
        let token = cookies["sb_access"];
        if (!token && authHeader.startsWith("Bearer ")) {
          token = authHeader.slice(7);
        }
        if (!token && tokenFromQuery) {
          token = tokenFromQuery;
        }
        if (!token) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const user = await verifyToken(env, token);
        if (!user) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        return jsonResponse({
          success: true,
          user_id: user.id,
          email: user.email
        }, 200, origin);
      }
      if (action === "get_profile_name" && request.method === "GET") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const cookies = parseCookies(cookieHeader);
        const authHeader = request.headers.get("Authorization") || "";
        const tokenFromQuery = url.searchParams.get("token");
        let token = cookies["sb_access"];
        if (!token && authHeader.startsWith("Bearer ")) {
          token = authHeader.slice(7);
        }
        if (!token && tokenFromQuery) {
          token = tokenFromQuery;
        }
        if (!token) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const user = await verifyToken(env, token);
        if (!user) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const profile = await fetchProfile(env, user.id);
        if (!profile) {
          return jsonResponse({ success: false, error: "User not found" }, 404, origin);
        }
        const koreanName = profile.korean_name || profile.koreanname || profile.kor_name || null;
        const classVal = profile.class || profile.class_name || null;
        return jsonResponse({
          success: true,
          name: profile.name,
          username: profile.username,
          avatar: profile.avatar,
          korean_name: koreanName,
          class: classVal
        }, 200, origin);
      }
      if (action === "get_profile" && request.method === "GET") {
        let userId = url.searchParams.get("user_id");
        if (!userId) {
          const cookieHeader = request.headers.get("Cookie") || "";
          const cookies = parseCookies(cookieHeader);
          const token = cookies["sb_access"];
          if (!token) {
            return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
          }
          const user = await verifyToken(env, token);
          if (!user) {
            return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
          }
          userId = user.id;
        }
        const profile = await fetchProfile(env, userId);
        if (!profile) {
          return jsonResponse({ success: false, error: "User not found" }, 404, origin);
        }
        const koreanName = profile.korean_name || profile.koreanname || null;
        const classVal = profile.class || profile.class_name || null;
        return jsonResponse({
          success: true,
          name: profile.name,
          email: profile.email,
          approved: profile.approved,
          role: profile.role,
          username: profile.username,
          avatar: profile.avatar,
          korean_name: koreanName,
          class: classVal
        }, 200, origin);
      }
      if (action === "get_role") {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
          return jsonResponse({ success: false, error: "Missing user_id" }, 400, origin);
        }
        const profile = await fetchProfile(env, userId, "role");
        if (!profile) {
          return jsonResponse({ success: false, error: "User not found" }, 404, origin);
        }
        return jsonResponse({ success: true, role: profile.role }, 200, origin);
      }
      if (action === "update_profile_avatar" && request.method === "POST") {
        const referer = request.headers.get("Referer") || "";
        const okOrigin = ALLOWED_ORIGINS.includes(origin);
        const okReferer = ALLOWED_ORIGINS.some((p) => referer.startsWith(p + "/"));
        if (!okOrigin && !okReferer) {
          return jsonResponse({ success: false, error: "CSRF check failed" }, 403, origin);
        }
        const cookieHeader = request.headers.get("Cookie") || "";
        const cookies = parseCookies(cookieHeader);
        const token = cookies["sb_access"];
        if (!token) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const user = await verifyToken(env, token);
        if (!user) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const body = await request.json();
        const { avatar } = body;
        if (!avatar || typeof avatar !== "string") {
          return jsonResponse({ success: false, error: "Missing avatar" }, 400, origin);
        }
        const success = await updateProfile(env, user.id, { avatar });
        if (!success) {
          return jsonResponse({ success: false, error: "Update failed" }, 500, origin);
        }
        return jsonResponse({ success: true }, 200, origin);
      }
      if (action === "logout") {
        const clearOpts = { ...cookieOpts, maxAge: 0 };
        const cookies = [
          makeCookie("sb_access", "", clearOpts),
          makeCookie("sb_refresh", "", clearOpts)
        ];
        return jsonResponse({ success: true }, 200, origin, cookies);
      }
      if (action === "refresh" && request.method === "GET") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const cookies = parseCookies(cookieHeader);
        const refreshToken = cookies["sb_refresh"];
        if (!refreshToken) {
          return jsonResponse({ success: false, message: "No refresh token" }, 200, origin);
        }
        try {
          const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": env.SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ refresh_token: refreshToken })
          });
          const data = await resp.json();
          if (!resp.ok || !data.access_token) {
            return jsonResponse({ success: false, message: "Refresh failed" }, 200, origin);
          }
          const newCookies = [
            makeCookie("sb_access", data.access_token, cookieOpts),
            makeCookie("sb_refresh", data.refresh_token || refreshToken, cookieOpts)
          ];
          return jsonResponse({ success: true }, 200, origin, newCookies);
        } catch {
          return jsonResponse({ success: false, message: "Refresh failed" }, 200, origin);
        }
      }
      if (action === "change_password" && request.method === "POST") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const cookies = parseCookies(cookieHeader);
        const token = cookies["sb_access"];
        if (!token) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const user = await verifyToken(env, token);
        if (!user) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const body = await request.json();
        const { current_password, new_password } = body;
        if (!current_password || !new_password) {
          return jsonResponse({ success: false, error: "Missing credentials" }, 400, origin);
        }
        if (String(new_password).length < 6) {
          return jsonResponse({ success: false, error: "Password too short" }, 400, origin);
        }
        const authResp = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": env.SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ email: user.email, password: current_password })
        });
        if (!authResp.ok) {
          return jsonResponse({ success: false, error: "Incorrect current password", error_code: "bad_current" }, 403, origin);
        }
        const updateResp = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "apikey": env.SUPABASE_SERVICE_KEY,
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ password: new_password })
        });
        if (!updateResp.ok) {
          return jsonResponse({ success: false, error: "Update failed" }, 400, origin);
        }
        return jsonResponse({ success: true }, 200, origin);
      }
      if (action === "change_email" && request.method === "POST") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const cookies = parseCookies(cookieHeader);
        const token = cookies["sb_access"];
        if (!token) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const user = await verifyToken(env, token);
        if (!user) {
          return jsonResponse({ success: false, error: "Not signed in" }, 401, origin);
        }
        const body = await request.json();
        const { current_password, new_email } = body;
        if (!current_password || !new_email) {
          return jsonResponse({ success: false, error: "Missing credentials" }, 400, origin);
        }
        const emailNorm = String(new_email).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(emailNorm)) {
          return jsonResponse({ success: false, error: "Invalid email address", error_code: "invalid_email" }, 400, origin);
        }
        const authResp = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": env.SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ email: user.email, password: current_password })
        });
        if (!authResp.ok) {
          return jsonResponse({ success: false, error: "Incorrect current password", error_code: "bad_current" }, 403, origin);
        }
        const existingResp = await fetch(
          `${env.SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(emailNorm)}&select=id`,
          {
            headers: {
              "apikey": env.SUPABASE_SERVICE_KEY,
              "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`
            }
          }
        );
        const existing = await existingResp.json();
        if (existing && existing.length > 0) {
          return jsonResponse({ success: false, error: "Email already in use", error_code: "email_in_use" }, 400, origin);
        }
        const updateResp = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "apikey": env.SUPABASE_SERVICE_KEY,
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ email: emailNorm })
        });
        if (!updateResp.ok) {
          return jsonResponse({ success: false, error: "Update failed" }, 400, origin);
        }
        await updateProfile(env, user.id, { email: emailNorm });
        return jsonResponse({ success: true }, 200, origin);
      }
      return jsonResponse({ success: false, error: "Action not found" }, 404, origin);
    } catch (error) {
      console.error("[supabase-auth] Error:", error);
      return jsonResponse(
        { success: false, error: error.message || "Internal error" },
        500,
        origin
      );
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

// .wrangler/tmp/bundle-Z24Jns/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-Z24Jns/middleware-loader.entry.ts
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
