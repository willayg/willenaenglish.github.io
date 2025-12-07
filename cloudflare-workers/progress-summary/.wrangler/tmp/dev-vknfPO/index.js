var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-mIzz91/checked-fetch.js
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
  "http://localhost:8888",
  "http://localhost:9000"
];
var CLASS_CACHE_TTL_SECONDS = 10 * 60;
var GLOBAL_CACHE_TTL_SECONDS = 15 * 60;
var RESPONSE_CACHE_SECONDS = 120;
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
function jsonResponse(data, status = 200, origin = "", cacheSeconds = 0) {
  const headers = {
    "Content-Type": "application/json",
    ...getCorsHeaders(origin)
  };
  if (cacheSeconds > 0 && status >= 200 && status < 300) {
    headers["Cache-Control"] = `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`;
  }
  return new Response(JSON.stringify(data), { status, headers });
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
async function supabaseSelect(env, table, query, options = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`;
  const resp = await fetch(url, {
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      ...options.headers
    }
  });
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Supabase query failed: ${error}`);
  }
  return resp.json();
}
__name(supabaseSelect, "supabaseSelect");
function getMonthStartIso() {
  const now = /* @__PURE__ */ new Date();
  const firstUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  return firstUtc.toISOString();
}
__name(getMonthStartIso, "getMonthStartIso");
function safeParseSummary(input) {
  if (!input) return null;
  if (typeof input === "object") return input;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}
__name(safeParseSummary, "safeParseSummary");
function deriveStars(summary) {
  const s = summary || {};
  let acc = null;
  if (typeof s.accuracy === "number") acc = s.accuracy;
  else if (typeof s.score === "number" && typeof s.total === "number" && s.total > 0) {
    acc = s.score / s.total;
  } else if (typeof s.score === "number" && typeof s.max === "number" && s.max > 0) {
    acc = s.score / s.max;
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
}
__name(deriveStars, "deriveStars");
function buildStarsByUserMap(sessions) {
  const bestKey = /* @__PURE__ */ new Map();
  (sessions || []).forEach((sess) => {
    if (!sess || !sess.user_id) return;
    const list = (sess.list_name || "").trim();
    const mode = (sess.mode || "").trim();
    if (!list || !mode) return;
    const parsed = safeParseSummary(sess.summary);
    if (parsed && parsed.completed === false) return;
    const stars = deriveStars(parsed);
    if (stars <= 0) return;
    const composite = `${sess.user_id}||${list}||${mode}`;
    const prev = bestKey.get(composite) || 0;
    if (stars > prev) bestKey.set(composite, stars);
  });
  const totals = /* @__PURE__ */ new Map();
  bestKey.forEach((value, composite) => {
    const [uid] = composite.split("||");
    totals.set(uid, (totals.get(uid) || 0) + value);
  });
  return totals;
}
__name(buildStarsByUserMap, "buildStarsByUserMap");
async function aggregatePointsForIds(env, ids, firstOfMonthIso) {
  if (!ids || !ids.length) return /* @__PURE__ */ new Map();
  const totals = /* @__PURE__ */ new Map();
  const pageSize = 1e3;
  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    let query = `user_id=in.(${chunk.join(",")})&points=not.is.null&select=user_id,points`;
    if (firstOfMonthIso) {
      query += `&created_at=gte.${firstOfMonthIso}`;
    }
    try {
      const data = await supabaseSelect(env, "progress_attempts", query);
      (data || []).forEach((row) => {
        if (!row || !row.user_id) return;
        const value = Number(row.points) || 0;
        totals.set(row.user_id, (totals.get(row.user_id) || 0) + value);
      });
    } catch (e) {
      console.error("[progress-summary] Points aggregation error:", e.message);
    }
  }
  return totals;
}
__name(aggregatePointsForIds, "aggregatePointsForIds");
function needsSummary(summary) {
  const parsed = safeParseSummary(summary);
  if (!parsed) return true;
  if (typeof parsed.accuracy === "number") return false;
  if (typeof parsed.score === "number" && typeof parsed.total === "number" && parsed.total > 0) return false;
  if (typeof parsed.score === "number" && typeof parsed.max === "number" && parsed.max > 0) return false;
  return true;
}
__name(needsSummary, "needsSummary");
async function synthesizeSummaries(env, sessions) {
  const missing = (sessions || []).filter((s) => needsSummary(s.summary)).map((s) => s.session_id).filter(Boolean);
  if (!missing.length) return;
  const chunkSize = 100;
  const attemptMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < missing.length; i += chunkSize) {
    const slice = missing.slice(i, i + chunkSize);
    try {
      const data = await supabaseSelect(env, "progress_attempts", `session_id=in.(${slice.join(",")})&select=session_id,is_correct`);
      (data || []).forEach((att) => {
        if (!att || !att.session_id) return;
        const cur = attemptMap.get(att.session_id) || { total: 0, correct: 0 };
        cur.total += 1;
        if (att.is_correct) cur.correct += 1;
        attemptMap.set(att.session_id, cur);
      });
    } catch (e) {
      console.error("[progress-summary] Attempt fetch error during summary synthesis:", e.message);
    }
  }
  sessions.forEach((sess) => {
    if (!sess || !missing.includes(sess.session_id)) return;
    const agg = attemptMap.get(sess.session_id);
    if (!agg || !agg.total) return;
    const accuracy = agg.total ? agg.correct / agg.total : null;
    sess.summary = {
      score: agg.correct,
      total: agg.total,
      accuracy,
      derived: true
    };
  });
}
__name(synthesizeSummaries, "synthesizeSummaries");
async function fetchSessionsForUsers(env, userIds, firstOfMonthIso) {
  if (!userIds || !userIds.length) return [];
  const sessions = [];
  const chunkSize = 100;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    let query = `user_id=in.(${chunk.join(",")})&ended_at=not.is.null&select=user_id,list_name,mode,summary,ended_at,session_id`;
    if (firstOfMonthIso) {
      query += `&ended_at=gte.${firstOfMonthIso}`;
    }
    try {
      const data = await supabaseSelect(env, "progress_sessions", query);
      sessions.push(...data || []);
    } catch (e) {
      console.error("[progress-summary] Sessions fetch error:", e.message);
    }
  }
  await synthesizeSummaries(env, sessions);
  return sessions;
}
__name(fetchSessionsForUsers, "fetchSessionsForUsers");
async function fetchProfiles(env, classFilter = null) {
  let query = "select=id,name,class,avatar,korean_name,username,role,approved";
  if (classFilter) {
    query += `&class=eq.${encodeURIComponent(classFilter)}`;
  }
  query += "&role=eq.student&approved=eq.true";
  const profiles = await supabaseSelect(env, "profiles", query);
  return (profiles || []).filter((p) => !p.username || p.username && p.username.length > 1);
}
__name(fetchProfiles, "fetchProfiles");
function finalizeLeaderboard(entries) {
  entries.sort((a, b) => (b.points || 0) - (a.points || 0) || (a.name || "").localeCompare(b.name || ""));
  entries.forEach((entry, idx) => {
    const stars = Number(entry.stars) || 0;
    const points = Number(entry.points) || 0;
    entry.stars = stars;
    entry.points = points;
    entry.superScore = Math.round(stars * points / 1e3);
    entry.rank = idx + 1;
  });
  return entries;
}
__name(finalizeLeaderboard, "finalizeLeaderboard");
function buildLeaderboard(profiles, starsMap, pointsMap) {
  const entries = profiles.map((p) => ({
    user_id: p.id,
    name: p.name,
    class: p.class,
    avatar: p.avatar,
    korean_name: p.korean_name,
    stars: starsMap.get(p.id) || 0,
    points: pointsMap.get(p.id) || 0
  }));
  return finalizeLeaderboard(entries);
}
__name(buildLeaderboard, "buildLeaderboard");
async function getFromCache(env, key) {
  if (!env.LEADERBOARD_CACHE) return null;
  try {
    return await env.LEADERBOARD_CACHE.get(key, "json");
  } catch {
    return null;
  }
}
__name(getFromCache, "getFromCache");
async function setToCache(env, key, data, ttlSeconds) {
  if (!env.LEADERBOARD_CACHE) return;
  try {
    await env.LEADERBOARD_CACHE.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
  } catch (e) {
    console.error("[progress-summary] Cache write error:", e.message);
  }
}
__name(setToCache, "setToCache");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = getCorsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method Not Allowed" }, 405, origin);
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      return jsonResponse({ error: "Server is misconfigured: missing Supabase env vars" }, 500, origin);
    }
    let accessToken = null;
    const authHeader = request.headers.get("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.slice(7);
    } else {
      const cookieHeader = request.headers.get("Cookie") || "";
      const cookies = parseCookies(cookieHeader);
      accessToken = cookies["sb_access"];
    }
    const isLocalHost = ["localhost", "127.0.0.1"].includes(url.hostname);
    const devUserId = isLocalHost ? url.searchParams.get("dev_user_id") : null;
    let user = null;
    if (devUserId) {
      user = { id: devUserId };
    } else {
      user = await getUserFromToken(env, accessToken);
    }
    if (!user) {
      return jsonResponse({ error: "Not signed in (cookie missing or invalid)" }, 401, origin);
    }
    const userId = user.id;
    const section = (url.searchParams.get("section") || "kpi").toLowerCase();
    try {
      if (section === "kpi") {
        const recentSessions = await supabaseSelect(
          env,
          "progress_sessions",
          `user_id=eq.${userId}&ended_at=not.is.null&order=ended_at.desc&limit=10&select=list_name,mode,summary,ended_at`
        );
        const sessions = await fetchSessionsForUsers(env, [userId], null);
        const starsMap = buildStarsByUserMap(sessions);
        const totalStars = starsMap.get(userId) || 0;
        const pointsMap = await aggregatePointsForIds(env, [userId], null);
        const totalPoints = pointsMap.get(userId) || 0;
        return jsonResponse({
          success: true,
          user_id: userId,
          total_stars: totalStars,
          total_points: totalPoints,
          recent_sessions: recentSessions || []
        }, 200, origin, RESPONSE_CACHE_SECONDS);
      }
      if (section === "overview") {
        const sessions = await fetchSessionsForUsers(env, [userId], null);
        const starsMap = buildStarsByUserMap(sessions);
        const totalStars = starsMap.get(userId) || 0;
        const pointsMap = await aggregatePointsForIds(env, [userId], null);
        const totalPoints = pointsMap.get(userId) || 0;
        return jsonResponse({
          success: true,
          user_id: userId,
          stars: totalStars,
          points: totalPoints
        }, 200, origin, RESPONSE_CACHE_SECONDS);
      }
      if (section === "leaderboard_stars" || section === "leaderboard_stars_global") {
        const timeframe = url.searchParams.get("timeframe") || "all";
        const classFilter = url.searchParams.get("class") || null;
        const firstOfMonth = timeframe === "month" ? getMonthStartIso() : null;
        const cacheKey = classFilter ? `lb:class:${classFilter.toLowerCase()}:${timeframe}` : `lb:global:${timeframe}`;
        const cached = await getFromCache(env, cacheKey);
        if (cached && cached.leaderboard) {
          const lb = cached.leaderboard.map((entry) => ({
            ...entry,
            self: entry.user_id === userId
          }));
          let shaped2;
          if (classFilter) {
            const top = lb.slice(0, 5);
            const me = lb.find((e) => e.user_id === userId);
            shaped2 = top;
            if (me && !top.some((e) => e.user_id === me.user_id)) shaped2 = [...top, me];
          } else {
            const topLimit = 15;
            shaped2 = lb.slice(0, topLimit);
            if (userId) {
              const me = lb.find((e) => e.user_id === userId);
              if (me && !shaped2.some((e) => e.user_id === me.user_id)) shaped2 = [...shaped2, me];
            }
          }
          return jsonResponse({
            success: true,
            timeframe,
            class: classFilter,
            cached_at: cached.cached_at,
            leaderboard: shaped2,
            _cached: true
          }, 200, origin, RESPONSE_CACHE_SECONDS);
        }
        const profiles = await fetchProfiles(env, classFilter);
        const userIds = profiles.map((p) => p.id);
        const [sessions, pointsMap] = await Promise.all([
          fetchSessionsForUsers(env, userIds, firstOfMonth),
          aggregatePointsForIds(env, userIds, firstOfMonth)
        ]);
        const starsMap = buildStarsByUserMap(sessions);
        const leaderboard = buildLeaderboard(profiles, starsMap, pointsMap);
        const cacheData = {
          timeframe,
          class: classFilter,
          cached_at: (/* @__PURE__ */ new Date()).toISOString(),
          leaderboard
        };
        const ttl = classFilter ? CLASS_CACHE_TTL_SECONDS : GLOBAL_CACHE_TTL_SECONDS;
        await setToCache(env, cacheKey, cacheData, ttl);
        const withSelf = leaderboard.map((entry) => ({
          ...entry,
          self: entry.user_id === userId
        }));
        let shaped;
        if (classFilter) {
          const top = withSelf.slice(0, 5);
          const me = withSelf.find((e) => e.user_id === userId);
          shaped = top;
          if (me && !top.some((e) => e.user_id === me.user_id)) shaped = [...top, me];
        } else {
          const topLimit = 15;
          shaped = withSelf.slice(0, topLimit);
          if (userId) {
            const me = withSelf.find((e) => e.user_id === userId);
            if (me && !shaped.some((e) => e.user_id === me.user_id)) shaped = [...shaped, me];
          }
        }
        return jsonResponse({
          success: true,
          timeframe,
          class: classFilter,
          cached_at: cacheData.cached_at,
          leaderboard: shaped
        }, 200, origin, RESPONSE_CACHE_SECONDS);
      }
      if (section === "leaderboard_stars_class") {
        const classFilter = url.searchParams.get("class");
        if (!classFilter) {
          return jsonResponse({ error: "Missing class parameter" }, 400, origin);
        }
        const timeframe = url.searchParams.get("timeframe") || "all";
        const firstOfMonth = timeframe === "month" ? getMonthStartIso() : null;
        const cacheKey = `lb:class:${classFilter.toLowerCase()}:${timeframe}`;
        const cached = await getFromCache(env, cacheKey);
        if (cached && cached.leaderboard) {
          const withSelf2 = cached.leaderboard.map((entry) => ({
            ...entry,
            self: entry.user_id === userId
          }));
          const top2 = withSelf2.slice(0, 5);
          const me2 = withSelf2.find((e) => e.user_id === userId);
          const shaped2 = me2 && !top2.some((e) => e.user_id === me2.user_id) ? [...top2, me2] : top2;
          return jsonResponse({
            success: true,
            class: classFilter,
            timeframe,
            cached_at: cached.cached_at,
            leaderboard: shaped2,
            _cached: true
          }, 200, origin, RESPONSE_CACHE_SECONDS);
        }
        const profiles = await fetchProfiles(env, classFilter);
        const userIds = profiles.map((p) => p.id);
        const [sessions, pointsMap] = await Promise.all([
          fetchSessionsForUsers(env, userIds, firstOfMonth),
          aggregatePointsForIds(env, userIds, firstOfMonth)
        ]);
        const starsMap = buildStarsByUserMap(sessions);
        const leaderboard = buildLeaderboard(profiles, starsMap, pointsMap);
        const cacheData = {
          class: classFilter,
          timeframe,
          cached_at: (/* @__PURE__ */ new Date()).toISOString(),
          leaderboard
        };
        await setToCache(env, cacheKey, cacheData, CLASS_CACHE_TTL_SECONDS);
        const withSelf = leaderboard.map((entry) => ({
          ...entry,
          self: entry.user_id === userId
        }));
        const top = withSelf.slice(0, 5);
        const me = withSelf.find((e) => e.user_id === userId);
        const shaped = me && !top.some((e) => e.user_id === me.user_id) ? [...top, me] : top;
        return jsonResponse({
          success: true,
          class: classFilter,
          timeframe,
          cached_at: cacheData.cached_at,
          leaderboard: shaped
        }, 200, origin, RESPONSE_CACHE_SECONDS);
      }
      if (section === "my_progress") {
        const profiles = await supabaseSelect(env, "profiles", `id=eq.${userId}&select=*`);
        const profile = profiles && profiles[0];
        const sessions = await fetchSessionsForUsers(env, [userId], null);
        const starsMap = buildStarsByUserMap(sessions);
        const totalStars = starsMap.get(userId) || 0;
        const pointsMap = await aggregatePointsForIds(env, [userId], null);
        const totalPoints = pointsMap.get(userId) || 0;
        const completedLists = /* @__PURE__ */ new Set();
        sessions.forEach((sess) => {
          const stars = deriveStars(safeParseSummary(sess.summary));
          if (stars > 0 && sess.list_name) {
            completedLists.add(sess.list_name);
          }
        });
        return jsonResponse({
          success: true,
          user_id: userId,
          name: profile?.name,
          class: profile?.class,
          total_stars: totalStars,
          total_points: totalPoints,
          completed_lists: completedLists.size,
          total_sessions: sessions.length
        }, 200, origin, RESPONSE_CACHE_SECONDS);
      }
      if (section === "recent_sessions") {
        const limit = parseInt(url.searchParams.get("limit") || "20", 10);
        const sessions = await supabaseSelect(
          env,
          "progress_sessions",
          `user_id=eq.${userId}&ended_at=not.is.null&order=ended_at.desc&limit=${limit}&select=session_id,list_name,mode,summary,ended_at,list_size`
        );
        const formatted = (sessions || []).map((sess) => {
          const summary = safeParseSummary(sess.summary);
          const stars = deriveStars(summary);
          return {
            session_id: sess.session_id,
            list_name: sess.list_name,
            mode: sess.mode,
            stars,
            ended_at: sess.ended_at,
            accuracy: summary?.accuracy || null,
            score: summary?.score || null,
            total: summary?.total || null
          };
        });
        return jsonResponse({
          success: true,
          user_id: userId,
          sessions: formatted
        }, 200, origin, RESPONSE_CACHE_SECONDS);
      }
      if (section === "clear_cache") {
        if (!env.LEADERBOARD_CACHE) {
          return jsonResponse({ success: true, message: "No KV cache configured" }, 200, origin);
        }
        await env.LEADERBOARD_CACHE.put("invalidate_ts", Date.now().toString());
        return jsonResponse({
          success: true,
          message: "Cache invalidation triggered"
        }, 200, origin);
      }
      if (section === "debug") {
        return jsonResponse({
          success: true,
          runtime: "cloudflare-workers",
          hasKV: !!env.LEADERBOARD_CACHE,
          user_id: userId
        }, 200, origin);
      }
      return jsonResponse({ error: `Unknown section: ${section}` }, 400, origin);
    } catch (error) {
      console.error("[progress-summary] Error:", error);
      return jsonResponse({ error: error.message || "Server error" }, 500, origin);
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

// .wrangler/tmp/bundle-mIzz91/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-mIzz91/middleware-loader.entry.ts
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
