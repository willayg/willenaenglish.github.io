// netlify/functions/progress_summary.js
// Secure version: NO ?user_id. Uses Supabase Auth token + RLS.
// Requires env: SUPABASE_URL, SUPABASE_ANON_KEY
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.supabase_anon_key;

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') {
      return json(405, { error: 'Method Not Allowed' });
    }

    const auth = event.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return json(401, { error: 'Missing bearer token' });
    }

    // Initialize Supabase with the caller's token so Row Level Security applies
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: auth } }
    });

    const url = new URL(
      event.rawUrl || `http://localhost${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`
    );
    const section = (url.searchParams.get('section') || 'kpi').toLowerCase();

    // Helper to parse summary blobs safely
    const parseSummary = (s) => {
      try { if (!s) return null; if (typeof s === 'string') return JSON.parse(s); return s; }
      catch { return null; }
    };

    // ---------- KPI ----------
    if (section === 'kpi') {
      const { data: attempts, error: e1 } = await supabase
        .from('progress_attempts')
        .select('is_correct, points');

      if (e1) return json(400, { error: e1.message });

      const attemptsCount = attempts?.length || 0;
      const correct = attempts?.filter(a => a.is_correct)?.length || 0;
      const points = attempts?.reduce((s, a) => s + (Number(a.points) || 0), 0) || 0;

      const { data: ordered, error: e2 } = await supabase
        .from('progress_attempts')
        .select('is_correct, created_at')
        .order('created_at', { ascending: true });

      if (e2) return json(400, { error: e2.message });

      let best = 0, cur = 0;
      (ordered || []).forEach(a => { cur = a.is_correct ? cur + 1 : 0; best = Math.max(best, cur); });

      return json(200, {
        attempts: attemptsCount,
        accuracy: attemptsCount ? correct / attemptsCount : null,
        points,
        best_streak: best
      });
    }

    // ---------- MODES ----------
    if (section === 'modes') {
      const { data, error } = await supabase
        .from('progress_attempts')
        .select('mode, is_correct');

      if (error) return json(400, { error: error.message });

      const byMode = {};
      (data || []).forEach(r => {
        const m = (r.mode || 'unknown');
        byMode[m] ||= { mode: m, correct: 0, total: 0 };
        byMode[m].total += 1;
        if (r.is_correct) byMode[m].correct += 1;
      });
      return json(200, Object.values(byMode));
    }

    // ---------- SESSIONS ----------
    if (section === 'sessions') {
      const list_name = url.searchParams.get('list_name');
      let query = supabase
        .from('progress_sessions')
        .select('session_id, mode, list_name, started_at, ended_at, summary');

      if (list_name) query = query.eq('list_name', list_name);

      const { data, error } = await query
        .order('ended_at', { ascending: false })
        .limit(500);

      if (error) return json(400, { error: error.message });
      return json(200, data || []);
    }

    // ---------- ATTEMPTS ----------
    if (section === 'attempts') {
      const { data, error } = await supabase
        .from('progress_attempts')
        .select('created_at, mode, word, is_correct, points')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return json(400, { error: error.message });
      return json(200, data || []);
    }

    // ---------- BADGES ----------
    if (section === 'badges') {
      const [{ data: attempts, error: eA }, { data: sessions, error: eS }] = await Promise.all([
        supabase.from('progress_attempts').select('is_correct, points, created_at'),
        supabase.from('progress_sessions').select('summary')
      ]);
      if (eA) return json(400, { error: eA.message });
      if (eS) return json(400, { error: eS.message });

      const totalCorrect = (attempts || []).filter(a => a.is_correct).length;
      const points = (attempts || []).reduce((s, a) => s + (Number(a.points) || 0), 0);

      let best = 0, cur = 0;
      (attempts || [])
        .slice()
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .forEach(a => { cur = a.is_correct ? cur + 1 : 0; best = Math.max(best, cur); });

      const badges = [];
      if (totalCorrect >= 1) badges.push({ id: 'first_correct', name: 'First Steps', emoji: '🥇' });
      if (best >= 5) badges.push({ id: 'streak_5', name: 'Hot Streak', emoji: '🔥' });
      if (totalCorrect >= 100) badges.push({ id: 'hundred_correct', name: 'Century', emoji: '💯' });
      if (points >= 1000) badges.push({ id: 'thousand_points', name: 'Scorer', emoji: '🏆' });

      try {
        (sessions || []).forEach(s => {
          const sum = parseSummary(s.summary);
          if (!sum) return;
          const acc =
            typeof sum.accuracy === 'number' ? sum.accuracy
              : (typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) ? sum.score / sum.total
              : (typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) ? sum.score / sum.max
              : null;
          if ((acc !== null && acc >= 1) || sum.perfect === true) {
            badges.push({ id: 'perfect_round', name: 'Perfectionist', emoji: '🌟' });
          }
        });
      } catch {}

      return json(200, badges);
    }

    // ---------- OVERVIEW ----------
    if (section === 'overview') {
      const [sessRes, attRes] = await Promise.all([
        supabase.from('progress_sessions').select('session_id, mode, list_name, summary, started_at, ended_at'),
        supabase.from('progress_attempts').select('word, is_correct, points, created_at, mode')
      ]);
      if (sessRes.error) return json(400, { error: sessRes.error.message });
      if (attRes.error) return json(400, { error: attRes.error.message });

      const sessions = sessRes.data || [];
      const attempts = attRes.data || [];

      const isPerfect = (sumRaw) => {
        const s = parseSummary(sumRaw) || {};
        if (s.accuracy === 1 || s.perfect === true) return true;
        if (typeof s.score === 'number' && typeof s.total === 'number') return s.score >= s.total;
        if (typeof s.score === 'number' && typeof s.max === 'number') return s.score >= s.max;
        return false;
      };

      const listNames = new Set(sessions.filter(s => s.list_name).map(s => s.list_name));
      const lists_explored = listNames.size;

      const perfect_runs = sessions.reduce((n, s) => n + (isPerfect(s.summary) ? 1 : 0), 0);

      const masteredPairs = new Set();
      sessions.forEach(s => {
        const ln = s.list_name || null;
        if (!ln) return;
        if (isPerfect(s.summary)) masteredPairs.add(`${ln}||${s.mode || 'unknown'}`);
      });
      const mastered = masteredPairs.size;
      const mastered_lists = mastered;

      let best = 0, cur = 0;
      attempts
        .slice()
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .forEach(a => { cur = a.is_correct ? cur + 1 : 0; best = Math.max(best, cur); });
      const best_streak = best;

      const words_discovered = new Set((attempts.map(a => a.word).filter(Boolean))).size;

      const perWord = new Map();
      attempts.forEach(a => {
        if (!a.word) return;
        const cur = perWord.get(a.word) || { total: 0, correct: 0 };
        cur.total += 1; if (a.is_correct) cur.correct += 1; perWord.set(a.word, cur);
      });
      let words_mastered = 0;
      perWord.forEach(({ total, correct }) => { if (total > 0 && (correct / total) >= 0.8) words_mastered += 1; });

      const sessions_played = sessions.length;

      const total_points = attempts.reduce((sum, a) => sum + (Number(a.points) || 0), 0);

      function deriveStars(summ) {
        const s = summ || {};
        let acc = null;
        if (typeof s.accuracy === 'number') acc = s.accuracy;
        else if (typeof s.score === 'number' && typeof s.total === 'number' && s.total > 0) acc = s.score / s.total;
        else if (typeof s.score === 'number' && typeof s.max === 'number' && s.max > 0) acc = s.score / s.max;
        if (acc != null) {
          if (acc >= 1) return 3;
          if (acc >= 0.9) return 2;
          if (acc >= 0.8) return 1;
          return 0;
        }
        if (typeof s.stars === 'number') return s.stars;
        return 0;
      }
      let stars_total = 0;
      sessions.forEach(s => { stars_total += deriveStars(parseSummary(s.summary)); });

      let badges_count = 0;
      try {
        const totalCorrect = attempts.filter(a => a.is_correct).length;
        let localBest = 0, c = 0;
        attempts
          .slice()
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .forEach(a => { c = a.is_correct ? c + 1 : 0; localBest = Math.max(localBest, c); });
        const badges = [];
        if (totalCorrect >= 1) badges.push('first_correct');
        if (localBest >= 5) badges.push('streak_5');
        (sessions || []).forEach(s => {
          const sum = parseSummary(s.summary);
          if (!sum) return;
          const acc =
            typeof sum.accuracy === 'number' ? sum.accuracy
              : (typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) ? sum.score / sum.total
              : (typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) ? sum.score / sum.max
              : null;
          if ((acc !== null && acc >= 1) || sum.perfect === true) badges.push('perfect_round');
        });
        badges_count = badges.length;
      } catch {}

      const listCounts = new Map();
      sessions.forEach(s => { if (s.list_name) listCounts.set(s.list_name, (listCounts.get(s.list_name) || 0) + 1); });
      let favorite_list = null;
      if (listCounts.size) {
        let top = null; listCounts.forEach((cnt, name) => { if (!top || cnt > top.cnt) top = { name, cnt }; });
        favorite_list = top;
      }

      const wordStats = new Map();
      attempts.forEach(a => {
        if (!a.word) return;
        const s = wordStats.get(a.word) || { total: 0, correct: 0 };
        s.total += 1; if (a.is_correct) s.correct += 1; wordStats.set(a.word, s);
      });
      let hardest_word = null;
      wordStats.forEach((s, w) => {
        const incorrect = s.total - s.correct;
        if (s.total < 3 || incorrect <= s.correct) return;
        const acc = s.correct / s.total;
        if (!hardest_word) hardest_word = { word: w, misses: incorrect, attempts: s.total, accuracy: acc };
        else if (incorrect > hardest_word.misses || (incorrect === hardest_word.misses && acc < hardest_word.accuracy)) {
          hardest_word = { word: w, misses: incorrect, attempts: s.total, accuracy: acc };
        }
      });

      return json(200, {
        points: total_points,
        stars: stars_total,
        lists_explored,
        perfect_runs,
        mastered,
        mastered_lists,
        best_streak,
        words_discovered,
        words_mastered,
        sessions_played,
        badges_count,
        favorite_list,
        hardest_word
      });
    }

    // ---------- CHALLENGING ----------
    if (section === 'challenging') {
      const { data: attempts, error } = await supabase
        .from('progress_attempts')
        .select('mode, word, is_correct, points, correct_answer, extra, created_at');

      if (error) return json(400, { error: error.message });

      const normalize = (s) => (s && typeof s === 'string') ? s.trim().toLowerCase() : null;
      const hasHangul = (s) => typeof s === 'string' && /[\u3131-\uD79D\uAC00-\uD7AF]/.test(s);
      const hasLatin = (s) => typeof s === 'string' && /[A-Za-z]/.test(s);
      const toObj = (x) => { try { return typeof x === 'string' ? JSON.parse(x) : (x || null); } catch { return null; } };
      const normMode = (m) => (m || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const skillOf = (mode) => {
        const m = normMode(mode);
        if (m.includes('spell')) return 'spelling';
        if (m.includes('listen')) return 'listening';
        if (m.includes('meaning')) return 'meaning';
        if (m.includes('multi') || m.includes('choice') || m.includes('picture') || m.includes('read')) return 'reading';
        return null;
      };

      const korLookup = new Map();
      (attempts || []).forEach(a => {
        const ex = toObj(a.extra) || {};
        let eng = null, kor = null;
        const dir = (ex.direction || ex.dir || '').toString().toLowerCase();
        if (dir === 'kor_to_eng' && hasLatin(a.correct_answer)) eng = a.correct_answer;
        if (dir === 'eng_to_kor' && hasLatin(a.word)) eng = a.word;
        const engCands = [eng, a.word, a.correct_answer, ex.word_en, ex.en, ex.eng, ex.english, ex.answer, ex.target, ex.prompt, ex.answer_text].filter(Boolean);
        for (const c of engCands) { if (!eng && hasLatin(c)) { eng = c; break; } }
        const korCands = [ex.word_kr, ex.kr, ex.kor, ex.korean, ex.prompt, a.word, a.correct_answer, ex.question].filter(Boolean);
        for (const c of korCands) { if (!kor && hasHangul(c)) { kor = c; break; } }
        if (eng && kor) { const key = normalize(eng); if (key) korLookup.set(key, kor); }
      });

      const byWord = new Map();
      (attempts || []).forEach(a => {
        const skill = skillOf(a.mode);
        const ex = toObj(a.extra) || {};
        let eng = null, kor = null;
        const dir = (ex.direction || ex.dir || '').toString().toLowerCase();
        if (dir === 'kor_to_eng' && hasLatin(a.correct_answer)) eng = a.correct_answer;
        if (dir === 'eng_to_kor' && hasLatin(a.word)) eng = a.word;
        const engCands = [eng, a.word, a.correct_answer, ex.word_en, ex.en, ex.eng, ex.english, ex.answer, ex.target, ex.prompt, ex.answer_text].filter(Boolean);
        for (const c of engCands) { if (!eng && hasLatin(c)) { eng = c; break; } }
        const korCands = [ex.word_kr, ex.kr, ex.kor, ex.korean, ex.prompt, a.word, a.correct_answer, ex.question].filter(Boolean);
        for (const c of korCands) { if (!kor && hasHangul(c)) { kor = c; break; } }
        if (!eng) return;
        const engKey = normalize(eng);
        if (!engKey) return;
        const arr = byWord.get(engKey) || [];
        arr.push({ created_at: a.created_at, is_correct: !!a.is_correct, skill, word_en: eng, word_kr: kor || null });
        byWord.set(engKey, arr);
      });

      const out = [];
      byWord.forEach((arr, engKey) => {
        arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const recent = arr.slice(-5);
        const total = recent.length;
        const correct = recent.reduce((n, r) => n + (r.is_correct ? 1 : 0), 0);
        const overallAcc = total ? (correct / total) : 0;
        if (overallAcc >= 0.7) return;

        const perSkill = new Map();
        recent.forEach(r => {
          const s = r.skill || 'any';
          const cur = perSkill.get(s) || { total: 0, correct: 0, word_en: r.word_en, word_kr: r.word_kr };
          cur.total += 1;
          cur.correct += (r.is_correct ? 1 : 0);
          if (!cur.word_en && r.word_en) cur.word_en = r.word_en;
          if (!cur.word_kr && r.word_kr) cur.word_kr = r.word_kr;
          perSkill.set(s, cur);
        });

        let worst = null;
        perSkill.forEach((v, s) => {
          const acc = v.total ? (v.correct / v.total) : 0;
          if (!worst || acc < worst.acc || (acc === worst.acc && v.total > worst.attempts)) {
            worst = { acc, attempts: v.total, skill: s, word_en: v.word_en, word_kr: v.word_kr };
          }
        });

        const skill = worst?.skill || 'any';
        let word_en = (recent[recent.length - 1] && recent[recent.length - 1].word_en) || (worst && worst.word_en) || null;
        let word_kr = (worst && worst.word_kr) || null;
        if (!word_kr) {
          const backfill = korLookup.get(engKey);
          if (backfill) word_kr = backfill;
        }
        if (!word_en) word_en = engKey;

        out.push({ word: word_en, word_en, word_kr, skill, accuracy: overallAcc, attempts: total });
      });

      out.sort((a, b) => (a.accuracy - b.accuracy) || (b.attempts - a.attempts));
      return json(200, out.slice(0, 20));
    }

    return json(400, { error: 'Unknown section' });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
