var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var ALLOWED_ORIGINS = [
  "https://willenaenglish.com",
  "https://www.willenaenglish.com",
  "https://cf.willenaenglish.com",
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
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function jsonResponse(status, body, origin) {
  return new Response(JSON.stringify(body), {
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
  cookieHeader.split(/;\s*/).forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
}
__name(parseCookies, "parseCookies");
function generateRunToken(assignmentId) {
  const t = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `run_${assignmentId}_${t}_${rand}`;
}
__name(generateRunToken, "generateRunToken");
function normalizeListIdentifier(value) {
  if (!value) return "";
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
__name(normalizeListIdentifier, "normalizeListIdentifier");
function normalizeModeName(mode) {
  if (!mode) return "unknown";
  const m = String(mode).toLowerCase().trim();
  if (m.includes("spell") || m === "spelling_test" || m === "spelling_practice") {
    return "spelling";
  }
  if (m.includes("translation") && !m.includes("grammar")) {
    return "translation";
  }
  if (m === "typing" || m === "dictation") {
    return "typing";
  }
  return m;
}
__name(normalizeModeName, "normalizeModeName");
function determineCategory(assignment) {
  const text = `${assignment.list_key || ""} ${assignment.title || ""} ${assignment.list_title || ""}`.toLowerCase();
  if (text.includes("phonics")) return "phonics";
  if (text.includes("grammar")) return "grammar";
  return "vocab";
}
__name(determineCategory, "determineCategory");
function determineGrammarLevel(listKey) {
  if (!listKey) return 1;
  const lk = listKey.toLowerCase();
  if (lk.includes("/level3/") || lk.includes("level3")) return 3;
  if (lk.includes("/level2/") || lk.includes("level2")) return 2;
  return 1;
}
__name(determineGrammarLevel, "determineGrammarLevel");
function getGrammarModeCount(listKey) {
  if (!listKey) return 5;
  const lk = listKey.toLowerCase();
  const level = determineGrammarLevel(listKey);
  if (level === 3) {
    return 6;
  }
  if (level === 2) {
    if (lk.includes("prepositions_")) return 4;
    if (lk.includes("wh_who_what") || lk.includes("wh_where_when") || lk.includes("wh_how_why")) return 4;
    if (lk.includes("present_simple_questions_wh")) return 5;
    return 5;
  }
  return 4;
}
__name(getGrammarModeCount, "getGrammarModeCount");
function getExpectedModes(category, listKey, encounteredModes) {
  if (category === "phonics") return 4;
  if (category === "grammar") {
    return getGrammarModeCount(listKey);
  }
  return 6;
}
__name(getExpectedModes, "getExpectedModes");
var SupabaseClient = class {
  static {
    __name(this, "SupabaseClient");
  }
  constructor(url, serviceKey) {
    this.url = url;
    this.serviceKey = serviceKey;
  }
  async query(table, options = {}) {
    const { select = "*", filters = [], single = false, order, limit, method = "GET", body } = options;
    let url = `${this.url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    filters.forEach((f) => {
      url += `&${f.column}=${f.op}.${encodeURIComponent(f.value)}`;
    });
    if (order) {
      url += `&order=${order.column}.${order.ascending ? "asc" : "desc"}`;
    }
    if (limit) {
      url += `&limit=${limit}`;
    }
    const headers = {
      "apikey": this.serviceKey,
      "Authorization": `Bearer ${this.serviceKey}`,
      "Content-Type": "application/json",
      "Prefer": single ? "return=representation" : "return=representation"
    };
    if (single) {
      headers["Accept"] = "application/vnd.pgrst.object+json";
    }
    const fetchOptions = { method, headers };
    if (body && (method === "POST" || method === "PATCH")) {
      fetchOptions.body = JSON.stringify(body);
    }
    const resp = await fetch(url, fetchOptions);
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Supabase error ${resp.status}: ${errText}`);
    }
    return resp.json();
  }
  async insert(table, data) {
    const url = `${this.url}/rest/v1/${table}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": this.serviceKey,
        "Authorization": `Bearer ${this.serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify(data)
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Insert error ${resp.status}: ${errText}`);
    }
    const result = await resp.json();
    return Array.isArray(result) ? result[0] : result;
  }
  async update(table, filters, data) {
    let url = `${this.url}/rest/v1/${table}?`;
    filters.forEach((f, i) => {
      if (i > 0) url += "&";
      url += `${f.column}=${f.op}.${encodeURIComponent(f.value)}`;
    });
    const resp = await fetch(url, {
      method: "PATCH",
      headers: {
        "apikey": this.serviceKey,
        "Authorization": `Bearer ${this.serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify(data)
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Update error ${resp.status}: ${errText}`);
    }
    const result = await resp.json();
    return Array.isArray(result) ? result[0] : result;
  }
  async getUserFromToken(token) {
    const url = `${this.url}/auth/v1/user`;
    const resp = await fetch(url, {
      headers: {
        "apikey": this.serviceKey,
        "Authorization": `Bearer ${token}`
      }
    });
    if (!resp.ok) return null;
    return resp.json();
  }
};
async function getUserIdFromCookie(request, supabase) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["sb_access"] || cookies["sb-access-token"] || cookies["sb_access_token"];
  if (!token) return null;
  try {
    const user = await supabase.getUserFromToken(token);
    return user?.id || null;
  } catch {
    return null;
  }
}
__name(getUserIdFromCookie, "getUserIdFromCookie");
async function getProfile(supabase, userId) {
  try {
    return await supabase.query("profiles", {
      select: "id,role,approved,class,name,korean_name",
      filters: [{ column: "id", op: "eq", value: userId }],
      single: true
    });
  } catch {
    return null;
  }
}
__name(getProfile, "getProfile");
async function handleCreateAssignment(request, supabase, origin) {
  const userId = await getUserIdFromCookie(request, supabase);
  if (!userId) {
    return jsonResponse(401, { success: false, error: "Not signed in" }, origin);
  }
  const prof = await getProfile(supabase, userId);
  if (!prof || !["teacher", "admin"].includes(String(prof.role || "").toLowerCase())) {
    return jsonResponse(403, { success: false, error: "Only teachers can create assignments" }, origin);
  }
  if (prof.approved === false) {
    return jsonResponse(403, { success: false, error: "Teacher not approved" }, origin);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { success: false, error: "Invalid JSON body" }, origin);
  }
  const { class: className, title, description, list_key, list_title, list_meta, start_at, due_at, goal_type, goal_value } = body;
  if (!className || !title || !list_key || !due_at) {
    return jsonResponse(400, { success: false, error: "Missing required fields: class, title, list_key, due_at" }, origin);
  }
  const autoToken = `run_auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const initialMeta = {
    ...list_meta || {},
    run_tokens: [{ token: autoToken, created_at: (/* @__PURE__ */ new Date()).toISOString(), auto: true }]
  };
  try {
    const data = await supabase.insert("homework_assignments", {
      class: className,
      title,
      description: description || null,
      list_key,
      list_title,
      list_meta: initialMeta,
      start_at: start_at || (/* @__PURE__ */ new Date()).toISOString(),
      due_at,
      goal_type: goal_type || "stars",
      goal_value: goal_value || 5,
      active: true,
      created_by: prof.id
    });
    console.log(`[homework_api] Created assignment ${data.id} with auto run_token: ${autoToken}`);
    return jsonResponse(200, { success: true, assignment: data, run_token: autoToken }, origin);
  } catch (err) {
    console.error("create_assignment error:", err);
    return jsonResponse(500, { success: false, error: `Failed to create assignment: ${err.message}` }, origin);
  }
}
__name(handleCreateAssignment, "handleCreateAssignment");
async function handleCreateRun(request, supabase, params, origin) {
  const userId = await getUserIdFromCookie(request, supabase);
  if (!userId) {
    return jsonResponse(401, { success: false, error: "Not signed in" }, origin);
  }
  const prof = await getProfile(supabase, userId);
  if (!prof || !["teacher", "admin"].includes(String(prof.role || "").toLowerCase())) {
    return jsonResponse(403, { success: false, error: "Only teachers can create run tokens" }, origin);
  }
  const assignmentId = params.get("assignment_id") || params.get("id");
  if (!assignmentId) {
    return jsonResponse(400, { success: false, error: "Missing assignment_id" }, origin);
  }
  try {
    const assignment = await supabase.query("homework_assignments", {
      select: "id,list_meta",
      filters: [{ column: "id", op: "eq", value: assignmentId }],
      single: true
    });
    const list_meta = assignment.list_meta || {};
    const prev = Array.isArray(list_meta.run_tokens) ? list_meta.run_tokens : [];
    const token = generateRunToken(assignmentId);
    const updated = { ...list_meta, run_tokens: [...prev, { token, created_at: (/* @__PURE__ */ new Date()).toISOString() }] };
    await supabase.update("homework_assignments", [{ column: "id", op: "eq", value: assignmentId }], { list_meta: updated });
    return jsonResponse(200, { success: true, assignment_id: assignmentId, run_token: token }, origin);
  } catch (err) {
    return jsonResponse(500, { success: false, error: `Failed to persist run token: ${err.message}` }, origin);
  }
}
__name(handleCreateRun, "handleCreateRun");
async function handleListAssignments(request, supabase, params, origin) {
  const mode = params.get("mode") || "teacher";
  if (mode === "student") {
    const userId = await getUserIdFromCookie(request, supabase);
    if (!userId) {
      return jsonResponse(401, { success: false, error: "Not signed in" }, origin);
    }
    const prof = await getProfile(supabase, userId);
    if (!prof || !prof.class) {
      return jsonResponse(400, { success: false, error: "No class set for this profile" }, origin);
    }
    try {
      const url = `${supabase.url}/rest/v1/homework_assignments?select=*,profiles!homework_assignments_created_by_fkey(name)&class=eq.${encodeURIComponent(prof.class)}&active=eq.true&start_at=lte.${(/* @__PURE__ */ new Date()).toISOString()}&order=due_at.asc`;
      const resp = await fetch(url, {
        headers: {
          "apikey": supabase.serviceKey,
          "Authorization": `Bearer ${supabase.serviceKey}`
        }
      });
      const data = await resp.json();
      const assignments = (data || []).map((a) => ({
        ...a,
        teacher_name: a.profiles?.name || null
      }));
      return jsonResponse(200, {
        success: true,
        class: prof.class,
        student_name: prof.name || prof.korean_name || null,
        assignments
      }, origin);
    } catch (err) {
      return jsonResponse(500, { success: false, error: `Failed to fetch student homework: ${err.message}` }, origin);
    }
  }
  const className = params.get("class");
  try {
    let url = `${supabase.url}/rest/v1/homework_assignments?select=*&order=created_at.desc`;
    if (className) {
      url += `&class=eq.${encodeURIComponent(className)}`;
    }
    const resp = await fetch(url, {
      headers: {
        "apikey": supabase.serviceKey,
        "Authorization": `Bearer ${supabase.serviceKey}`
      }
    });
    const data = await resp.json();
    return jsonResponse(200, { success: true, assignments: data || [] }, origin);
  } catch (err) {
    return jsonResponse(500, { success: false, error: `Failed to fetch assignments: ${err.message}` }, origin);
  }
}
__name(handleListAssignments, "handleListAssignments");
async function handleEndAssignment(request, supabase, origin) {
  const userId = await getUserIdFromCookie(request, supabase);
  if (!userId) {
    return jsonResponse(401, { success: false, error: "Not signed in" }, origin);
  }
  const prof = await getProfile(supabase, userId);
  if (!prof || !["teacher", "admin"].includes(String(prof.role || "").toLowerCase())) {
    return jsonResponse(403, { success: false, error: "Only teachers can end assignments" }, origin);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { success: false, error: "Bad JSON" }, origin);
  }
  const assignmentId = body.id || body.assignment_id;
  if (!assignmentId) {
    return jsonResponse(400, { success: false, error: "Missing assignment id" }, origin);
  }
  try {
    const data = await supabase.update(
      "homework_assignments",
      [{ column: "id", op: "eq", value: assignmentId }],
      { active: false, ended_at: (/* @__PURE__ */ new Date()).toISOString() }
    );
    return jsonResponse(200, { success: true, assignment: data }, origin);
  } catch (err) {
    return jsonResponse(500, { success: false, error: `Failed to end assignment: ${err.message}` }, origin);
  }
}
__name(handleEndAssignment, "handleEndAssignment");
async function handleAssignmentProgress(request, supabase, params, origin) {
  const assignmentId = params.get("assignment_id") || params.get("id");
  const className = params.get("class");
  const requestRunToken = params.get("run_token");
  if (!assignmentId) {
    return jsonResponse(400, { success: false, error: "Missing assignment_id" }, origin);
  }
  try {
    let parseSummary = function(summary) {
      if (!summary) return null;
      if (typeof summary === "string") {
        try {
          return JSON.parse(summary);
        } catch {
          return null;
        }
      }
      return summary;
    }, deriveStars = function(summary) {
      const s = summary || {};
      let acc = null;
      if (typeof s.accuracy === "number") acc = s.accuracy;
      else if (typeof s.score === "number" && typeof s.total === "number" && s.total > 0) acc = s.score / s.total;
      else if (typeof s.score === "number" && typeof s.max === "number" && s.max > 0) acc = s.score / s.max;
      if (acc != null) {
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
    let assignment = await supabase.query("homework_assignments", {
      select: "*",
      filters: [{ column: "id", op: "eq", value: assignmentId }],
      single: true
    });
    if (!assignment) {
      return jsonResponse(404, { success: false, error: "Assignment not found" }, origin);
    }
    let assignmentRunTokens = Array.isArray(assignment.list_meta?.run_tokens) ? assignment.list_meta.run_tokens.map((r) => r?.token).filter(Boolean) : [];
    if (assignmentRunTokens.length === 0) {
      const autoToken = `run_backfill_${assignmentId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const updatedMeta = {
        ...assignment.list_meta || {},
        run_tokens: [{ token: autoToken, created_at: (/* @__PURE__ */ new Date()).toISOString(), auto: true, backfilled: true }]
      };
      await supabase.update(
        "homework_assignments",
        [{ column: "id", op: "eq", value: assignmentId }],
        { list_meta: updatedMeta }
      );
      assignment.list_meta = updatedMeta;
      assignmentRunTokens = [autoToken];
      console.log(`[assignmentProgress] Backfilled run_token for assignment ${assignmentId}: ${autoToken}`);
    }
    const targetClass = className || assignment.class;
    const category = determineCategory(assignment);
    const studentsUrl = `${supabase.url}/rest/v1/profiles?select=id,name,korean_name&class=eq.${encodeURIComponent(targetClass)}`;
    const studentsResp = await fetch(studentsUrl, {
      headers: {
        "apikey": supabase.serviceKey,
        "Authorization": `Bearer ${supabase.serviceKey}`
      }
    });
    const students = await studentsResp.json();
    if (!students || !students.length) {
      return jsonResponse(200, {
        success: true,
        assignment_id: assignment.id,
        class: targetClass,
        total_modes: getExpectedModes(category, assignment.list_key, /* @__PURE__ */ new Set()),
        category,
        progress: []
      }, origin);
    }
    const listKeyLast = assignment.list_key.split("/").pop();
    const coreName = listKeyLast.replace(/\.json$/, "");
    const studentIds = students.map((s) => s.id);
    async function fetchSessions(orFilter) {
      const url = new URL(`${supabase.url}/rest/v1/progress_sessions`);
      url.searchParams.set("select", "user_id,list_name,mode,summary,list_size");
      url.searchParams.set("user_id", `in.(${studentIds.join(",")})`);
      url.searchParams.set("ended_at", "not.is.null");
      url.searchParams.set("or", orFilter);
      const resp = await fetch(url.toString(), {
        headers: {
          "apikey": supabase.serviceKey,
          "Authorization": `Bearer ${supabase.serviceKey}`
        }
      });
      if (!resp.ok) {
        console.error(`[fetchSessions] Error ${resp.status}: ${await resp.text()}`);
        return [];
      }
      return resp.json();
    }
    __name(fetchSessions, "fetchSessions");
    let sessions = [];
    const eq1 = listKeyLast;
    const like1 = `%/${listKeyLast}`;
    const like2 = `%/${listKeyLast}.json`;
    const fuzzy1 = `%${coreName}%`;
    const fuzzy2 = assignment.list_title ? `%${assignment.list_title.toLowerCase().replace(/\s+/g, "_")}%` : null;
    let orFilters = [
      `list_name.eq.${eq1}`,
      `list_name.ilike.${like1}`,
      `list_name.ilike.${like2}`,
      `list_name.ilike.${fuzzy1}`
    ];
    if (fuzzy2) orFilters.push(`list_name.ilike.${fuzzy2}`);
    const normalizedFilename = normalizeListIdentifier(coreName);
    const normalizedListKey = normalizeListIdentifier(assignment.list_key);
    const normalizedTitle = normalizeListIdentifier(`${assignment.title || ""} ${assignment.list_title || ""}`);
    const normalizedTokens = Array.from(new Set([normalizedFilename, normalizedListKey, normalizedTitle].filter(Boolean))).filter((token) => token.length >= 3);
    normalizedTokens.forEach((token) => {
      const safeToken = token.replace(/\s+/g, "%");
      orFilters.push(`list_name.ilike.%${safeToken}%`);
    });
    const primaryOrFilter = `(${orFilters.join(",")})`;
    sessions = await fetchSessions(primaryOrFilter);
    console.log(`[assignmentProgress] Primary query found ${sessions.length} sessions`);
    if (sessions.length) {
      console.log(`[assignmentProgress] Sample list_names:`, sessions.slice(0, 5).map((s) => s.list_name));
    }
    if (sessions.length === 0 && assignment.list_key) {
      const broadLike = `%${assignment.list_key}%`;
      const broadFilter = `(list_name.ilike.${broadLike})`;
      sessions = await fetchSessions(broadFilter);
      console.log(`[assignmentProgress] Broad list_key fallback found ${sessions.length} sessions`);
    }
    if (sessions.length === 0 && coreName) {
      const normalized = coreName.replace(/[^a-z0-9]+/gi, "%");
      const normFilter = `(list_name.ilike.%${normalized}%)`;
      sessions = await fetchSessions(normFilter);
      console.log(`[assignmentProgress] Normalized coreName fallback found ${sessions.length} sessions`);
    }
    if (sessions.length === 0 && assignment.title) {
      const titleCore = assignment.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      if (titleCore) {
        const titleFilter = `(list_name.ilike.%${titleCore}%)`;
        sessions = await fetchSessions(titleFilter);
        console.log(`[assignmentProgress] Title fallback found ${sessions.length} sessions`);
      }
    }
    if (sessions.length) {
      const uniqueModes = [...new Set(sessions.map((s) => s.mode))];
      console.log(`[assignmentProgress] Unique modes found: ${uniqueModes.join(", ")}`);
    }
    const runTokens = [requestRunToken, ...assignmentRunTokens].filter(Boolean);
    if (runTokens.length && sessions.length) {
      const withToken = sessions.filter((s) => {
        try {
          const sum = typeof s.summary === "string" ? JSON.parse(s.summary) : s.summary;
          const tok = sum?.assignment_run;
          return tok && runTokens.includes(tok);
        } catch {
          return false;
        }
      });
      if (withToken.length) {
        sessions = withToken;
        console.log(`[assignmentProgress] Using ${withToken.length} run-linked sessions`);
      }
    }
    const byStudent = /* @__PURE__ */ new Map();
    students.forEach((st) => byStudent.set(st.id, {
      user_id: st.id,
      name: st.name,
      korean_name: st.korean_name,
      modes: {},
      _score: 0,
      _total: 0
    }));
    const encounteredModes = /* @__PURE__ */ new Set();
    sessions.forEach((sess) => {
      const row = byStudent.get(sess.user_id);
      if (!row) return;
      const summary = parseSummary(sess.summary);
      const stars = deriveStars(summary);
      const rawMode = sess.mode || "unknown";
      const modeKey = normalizeModeName(rawMode);
      encounteredModes.add(modeKey);
      if (summary && typeof summary.score === "number" && typeof summary.total === "number" && summary.total > 0) {
        row._score += summary.score;
        row._total += summary.total;
      } else if (summary && typeof summary.correct === "number" && typeof summary.total === "number" && summary.total > 0) {
        row._score += summary.correct;
        row._total += summary.total;
      }
      const prev = row.modes[modeKey];
      const acc = summary && typeof summary.accuracy === "number" ? Math.round(summary.accuracy * 100) : summary && typeof summary.score === "number" && typeof summary.total === "number" && summary.total > 0 ? Math.round(summary.score / summary.total * 100) : 0;
      if (prev) {
        if (stars > prev.stars) prev.stars = stars;
        if (acc > prev.accuracy) prev.accuracy = acc;
        prev.sessions += 1;
      } else {
        row.modes[modeKey] = { stars, accuracy: acc, sessions: 1 };
      }
    });
    const totalModes = assignment.list_meta?.modes_total || assignment.list_meta?.total_modes || getExpectedModes(category, assignment.list_key, encounteredModes);
    console.log(`[assignmentProgress] Category: ${category}, Total modes: ${totalModes}, Encountered: ${[...encounteredModes].join(", ")}`);
    const progress = Array.from(byStudent.values()).map((r) => {
      const rawModesArr = Object.entries(r.modes).map(([mode, v]) => ({
        mode,
        bestStars: v.stars,
        bestAccuracy: v.accuracy,
        sessions: v.sessions
      }));
      const starsEarned = rawModesArr.reduce((sum, m) => sum + (m.bestStars || 0), 0);
      const bestAccuracy = rawModesArr.reduce((best, m) => Math.max(best, m.bestAccuracy || 0), 0);
      const overallAccuracy = r._total > 0 ? Math.round(r._score / r._total * 100) : 0;
      const countedModesArr = rawModesArr.filter(
        (m) => m.bestStars >= 1 || /grammar_lesson|lesson/i.test(m.mode)
      );
      const distinctModesAttempted = countedModesArr.length;
      const completionPercent = totalModes > 0 ? Math.round(distinctModesAttempted / totalModes * 100) : 0;
      return {
        user_id: r.user_id,
        name: r.name,
        korean_name: r.korean_name,
        stars: starsEarned,
        accuracy_best: bestAccuracy,
        accuracy_overall: overallAccuracy,
        completion: completionPercent,
        modes_attempted: distinctModesAttempted,
        modes_total: totalModes,
        modes: rawModesArr,
        status: assignment.active ? completionPercent >= 100 || starsEarned >= (assignment.goal_value || 5) ? "Completed" : "In Progress" : "Ended",
        category
      };
    });
    return jsonResponse(200, {
      success: true,
      assignment_id: assignment.id,
      class: targetClass,
      total_modes: totalModes,
      category,
      progress,
      debug: {
        encountered_modes: [...encounteredModes],
        sessions_count: sessions.length
      }
    }, origin);
  } catch (err) {
    console.error("[assignmentProgress] Error:", err);
    return jsonResponse(500, { success: false, error: err.message }, origin);
  }
}
__name(handleAssignmentProgress, "handleAssignmentProgress");
async function handleGetRunToken(request, supabase, params, origin) {
  const userId = await getUserIdFromCookie(request, supabase);
  if (!userId) {
    return jsonResponse(401, { success: false, error: "Not signed in" }, origin);
  }
  const prof = await getProfile(supabase, userId);
  if (!prof) {
    return jsonResponse(401, { success: false, error: "Profile not found" }, origin);
  }
  const assignmentId = params.get("assignment_id") || params.get("id");
  const listKey = params.get("list_key") || params.get("listName") || params.get("list_name");
  if (!assignmentId && !listKey) {
    return jsonResponse(400, { success: false, error: "Missing assignment_id or list_key" }, origin);
  }
  try {
    let assignment;
    if (assignmentId) {
      assignment = await supabase.query("homework_assignments", {
        select: "*",
        filters: [{ column: "id", op: "eq", value: assignmentId }],
        single: true
      });
    } else {
      const url = `${supabase.url}/rest/v1/homework_assignments?select=*&class=eq.${encodeURIComponent(prof.class)}&active=eq.true&list_key=ilike.%${encodeURIComponent(listKey)}%&order=created_at.desc&limit=1`;
      const resp = await fetch(url, {
        headers: {
          "apikey": supabase.serviceKey,
          "Authorization": `Bearer ${supabase.serviceKey}`
        }
      });
      const data = await resp.json();
      assignment = data?.[0];
    }
    if (!assignment || String(assignment.class) !== String(prof.class)) {
      return jsonResponse(403, { success: false, error: "Not assigned to this class" }, origin);
    }
    const tokens = Array.isArray(assignment.list_meta?.run_tokens) ? assignment.list_meta.run_tokens.map((r) => r?.token).filter(Boolean) : [];
    return jsonResponse(200, { success: true, assignment_id: assignment.id, tokens }, origin);
  } catch (err) {
    return jsonResponse(500, { success: false, error: err.message }, origin);
  }
}
__name(handleGetRunToken, "handleGetRunToken");
async function handleLinkSessions(request, supabase, params, origin) {
  const userId = await getUserIdFromCookie(request, supabase);
  if (!userId) {
    return jsonResponse(401, { success: false, error: "Not signed in" }, origin);
  }
  const prof = await getProfile(supabase, userId);
  if (!prof || !["teacher", "admin"].includes(String(prof.role || "").toLowerCase())) {
    return jsonResponse(403, { success: false, error: "Only teachers can link sessions" }, origin);
  }
  const assignmentId = params.get("assignment_id") || params.get("id");
  if (!assignmentId) {
    return jsonResponse(400, { success: false, error: "Missing assignment_id" }, origin);
  }
  try {
    const assignment = await supabase.query("homework_assignments", {
      select: "*",
      filters: [{ column: "id", op: "eq", value: assignmentId }],
      single: true
    });
    if (!assignment) {
      return jsonResponse(404, { success: false, error: "Assignment not found" }, origin);
    }
    let runToken;
    const existingTokens = Array.isArray(assignment.list_meta?.run_tokens) ? assignment.list_meta.run_tokens.map((r) => r?.token).filter(Boolean) : [];
    if (existingTokens.length > 0) {
      runToken = existingTokens[0];
    } else {
      runToken = `run_link_${assignmentId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const updatedMeta = {
        ...assignment.list_meta || {},
        run_tokens: [{ token: runToken, created_at: (/* @__PURE__ */ new Date()).toISOString(), auto: true }]
      };
      await supabase.update(
        "homework_assignments",
        [{ column: "id", op: "eq", value: assignmentId }],
        { list_meta: updatedMeta }
      );
    }
    const studentsUrl = `${supabase.url}/rest/v1/profiles?select=id&class=eq.${encodeURIComponent(assignment.class)}`;
    const studentsResp = await fetch(studentsUrl, {
      headers: {
        "apikey": supabase.serviceKey,
        "Authorization": `Bearer ${supabase.serviceKey}`
      }
    });
    const students = await studentsResp.json();
    if (!students || !students.length) {
      return jsonResponse(400, { success: false, error: "No students found in class" }, origin);
    }
    const studentIds = students.map((s) => s.id);
    const listKeyLast = assignment.list_key.split("/").pop();
    const coreName = listKeyLast.replace(/\.json$/, "");
    const orConditions = [
      `list_name.eq.${listKeyLast}`,
      `list_name.ilike.%/${listKeyLast}`,
      `list_name.ilike.%${coreName}%`
    ];
    const sessionsUrl = `${supabase.url}/rest/v1/progress_sessions?select=id,session_id,user_id,list_name,mode,summary&user_id=in.(${studentIds.join(",")})&ended_at=not.is.null&or=(${orConditions.join(",")})`;
    const sessionsResp = await fetch(sessionsUrl, {
      headers: {
        "apikey": supabase.serviceKey,
        "Authorization": `Bearer ${supabase.serviceKey}`
      }
    });
    const sessions = await sessionsResp.json();
    if (!sessions || !sessions.length) {
      return jsonResponse(200, { success: true, message: "No matching sessions found", linked: 0 }, origin);
    }
    const sessionsToLink = sessions.filter((s) => {
      try {
        const sum = typeof s.summary === "string" ? JSON.parse(s.summary) : s.summary;
        return !sum || !sum.assignment_run;
      } catch {
        return true;
      }
    });
    if (!sessionsToLink.length) {
      return jsonResponse(200, {
        success: true,
        message: "All matching sessions already linked",
        linked: 0,
        total_found: sessions.length
      }, origin);
    }
    let linkedCount = 0;
    const errors = [];
    for (const sess of sessionsToLink) {
      try {
        let existingSummary = {};
        try {
          existingSummary = typeof sess.summary === "string" ? JSON.parse(sess.summary) : sess.summary || {};
        } catch {
          existingSummary = {};
        }
        const updatedSummary = {
          ...existingSummary,
          assignment_run: runToken,
          linked_at: (/* @__PURE__ */ new Date()).toISOString(),
          linked_by: "teacher_action"
        };
        await supabase.update(
          "progress_sessions",
          [{ column: "id", op: "eq", value: sess.id }],
          { summary: updatedSummary }
        );
        linkedCount++;
      } catch (e) {
        errors.push({ session_id: sess.session_id, error: e.message });
      }
    }
    console.log(`[link_sessions] Linked ${linkedCount}/${sessionsToLink.length} sessions to assignment ${assignmentId}`);
    return jsonResponse(200, {
      success: true,
      message: `Linked ${linkedCount} sessions to assignment`,
      linked: linkedCount,
      total_found: sessions.length,
      already_linked: sessions.length - sessionsToLink.length,
      errors: errors.length > 0 ? errors : void 0,
      run_token: runToken
    }, origin);
  } catch (err) {
    console.error("[link_sessions] Error:", err);
    return jsonResponse(500, { success: false, error: err.message }, origin);
  }
}
__name(handleLinkSessions, "handleLinkSessions");
var index_default = {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = getCorsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return jsonResponse(500, {
        success: false,
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
      }, origin);
    }
    const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const url = new URL(request.url);
    const params = url.searchParams;
    const action = params.get("action") || "list_assignments";
    try {
      switch (action) {
        case "create_assignment":
          return await handleCreateAssignment(request, supabase, origin);
        case "create_run":
          return await handleCreateRun(request, supabase, params, origin);
        case "get_run_token":
          return await handleGetRunToken(request, supabase, params, origin);
        case "list_assignments":
          return await handleListAssignments(request, supabase, params, origin);
        case "end_assignment":
          return await handleEndAssignment(request, supabase, origin);
        case "assignment_progress":
          return await handleAssignmentProgress(request, supabase, params, origin);
        case "link_sessions":
          return await handleLinkSessions(request, supabase, params, origin);
        case "delete_assignment":
          return jsonResponse(501, { success: false, error: "delete_assignment not yet implemented" }, origin);
        default:
          return jsonResponse(400, { success: false, error: `Unknown action: ${action}` }, origin);
      }
    } catch (err) {
      console.error("[homework_api] Unhandled error:", err);
      return jsonResponse(500, { success: false, error: err.message || "Server error" }, origin);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
