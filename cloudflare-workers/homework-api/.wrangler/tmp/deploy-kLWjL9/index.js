var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

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
var index_default = {
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
        }, deriveStars = function(summary, modeRaw) {
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
          const m = String(modeRaw || "").toLowerCase();
          if (typeof s.score === "number" && !Number.isFinite(s.total)) {
            const pts = Math.max(0, Math.floor(s.score));
            if (m.includes("level_up")) {
              if (pts >= 20) return 5;
              if (pts >= 15) return 4;
              if (pts >= 10) return 3;
              if (pts >= 5) return 2;
              if (pts >= 1) return 1;
              return 0;
            }
          }
          return 0;
        }, normalizeMode = function(rawMode, cat) {
          const m = String(rawMode || "").toLowerCase();
          if (cat === "vocab" || cat === "phonics") {
            if (m.includes("sentence") && !m.includes("grammar")) return "sentence";
            if (m === "listening" || m === "listening_multi_choice") return "listening";
            if (m === "meaning" || m === "matching" || m === "picture" || m === "picture_multi_choice" || m === "easy_picture") return "meaning";
            if (m === "phonics_listening") return "listen";
            if (m === "multi_choice" || m === "multi_choice_eng_to_kor" || m === "multi_choice_kor_to_eng") return "multi_choice";
            if (m === "listen_and_spell" || m === "spelling") return "listen_and_spell";
            if (m === "level_up") return "level_up";
            if (m === "missing_letter") return "missing_letter";
          }
          if (cat === "grammar") {
            if (m === "grammar_mode" || m === "grammar_choose" || m === "grammar_choose_l3") return "choose";
            if (m === "grammar_fill_gap" || m === "grammar_fill_gap_l3") return "fill_gap";
            if (m === "grammar_sentence_unscramble" || m === "grammar_unscramble") return "unscramble";
            if (m === "grammar_sorting") return "sorting";
            if (m === "grammar_find_mistake" || m === "grammar_find_mistake_l3") return "find_mistake";
            if (m === "grammar_translation_choice" || m === "grammar_translation_choice_l3") return "translation";
            if (m === "grammar_sentence_order" || m === "grammar_sentence_order_l3") return "sentence_order";
            if (m.startsWith("grammar_lesson") || m === "lesson") return "lesson";
          }
          return m;
        };
        __name(parseSummary, "parseSummary");
        __name(deriveStars, "deriveStars");
        __name(normalizeMode, "normalizeMode");
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
        const assignLower = `${assignment.list_key || ""} ${assignment.title || ""} ${assignment.list_title || ""}`.toLowerCase();
        let category = "vocab";
        if (assignLower.includes("phonics") || assignLower.includes("sound") || /\bblend\b/.test(assignLower)) {
          category = "phonics";
        } else if (assignLower.includes("grammar") || assignLower.includes("/grammar/")) {
          category = "grammar";
        }
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
            category,
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
        const listKeyLast = (assignment.list_key || "").split("/").pop();
        const coreName = listKeyLast.replace(/\.json$/, "").toLowerCase();
        const tokens = coreName.split(/[-_]+/).filter((t) => t.length >= 2 && !/^(phonics|sample|wordlists|level\d?)$/.test(t));
        const filteredSessions = (sessions || []).filter((sess) => {
          const listName = (sess.list_name || "").toLowerCase();
          if (listName.includes(coreName) || listName.includes(listKeyLast.toLowerCase())) {
            return true;
          }
          if (tokens.length >= 2) {
            const matchCount = tokens.filter((t) => listName.includes(t)).length;
            if (matchCount >= Math.min(2, tokens.length)) return true;
          }
          return false;
        });
        filteredSessions.forEach((sess) => {
          const row = byStudent.get(sess.user_id);
          if (!row) return;
          if (Number.isFinite(sess.list_size) && sess.list_size > 0) {
            row.list_size = sess.list_size;
          }
          const summary = parseSummary(sess.summary);
          const stars = deriveStars(summary, sess.mode);
          const modeKey = normalizeMode(sess.mode, category) || "unknown";
          const rawMode = sess.mode || "unknown";
          const prev = row.modes[modeKey];
          if (prev) {
            if (stars > prev.stars) prev.stars = stars;
            prev.sessions += 1;
            if (!prev.rawModes) prev.rawModes = [];
            if (!prev.rawModes.includes(rawMode)) prev.rawModes.push(rawMode);
          } else {
            row.modes[modeKey] = { stars, sessions: 1, rawModes: [rawMode] };
          }
        });
        let totalModes;
        if (category === "phonics") {
          totalModes = 4;
        } else if (category === "grammar") {
          const listKeyPath = (assignment.list_key || "").toLowerCase();
          let grammarLevel = 2;
          const levelMatch = listKeyPath.match(/\/grammar\/level(\d)/);
          if (levelMatch) {
            grammarLevel = parseInt(levelMatch[1], 10);
          }
          totalModes = grammarLevel === 1 ? 4 : 6;
        } else {
          totalModes = 6;
        }
        const metaModes = assignment.list_meta?.modes_total || assignment.list_meta?.total_modes || assignment.list_meta?.mode_count;
        if (Number.isFinite(metaModes) && metaModes > 0 && metaModes <= 10) {
          if (category === "phonics" && metaModes <= 4) totalModes = metaModes;
          else if (category === "grammar" && metaModes >= 4 && metaModes <= 6) totalModes = metaModes;
          else if (category === "vocab" && metaModes >= 4 && metaModes <= 8) totalModes = metaModes;
        }
        const progress = Array.from(byStudent.values()).map((r) => {
          const modesArr = Object.entries(r.modes).map(([mode2, v]) => ({
            mode: mode2,
            bestStars: v.stars,
            sessions: v.sessions,
            rawModes: v.rawModes || []
            // Include raw mode names for debugging
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
            category,
            // A homework is considered completed only when every mode has at least 1 star
            status: assignment.active ? completionPercent >= 100 ? "Completed" : "In Progress" : "Ended"
          };
        });
        return jsonResponse({
          success: true,
          assignment_id: assignment.id,
          class: targetClass,
          total_modes: totalModes,
          category,
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
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
