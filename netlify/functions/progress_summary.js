const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const url = new URL(event.rawUrl || `http://localhost${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const user_id = url.searchParams.get('user_id');
    const section = url.searchParams.get('section') || 'kpi';
    if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id' }) };

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_key;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    if (section === 'kpi') {
      const { data: attempts } = await supabase
        .from('progress_attempts')
        .select('is_correct, points')
        .eq('user_id', user_id);
      const attemptsCount = attempts?.length || 0;
      const correct = attempts?.filter(a => a.is_correct)?.length || 0;
      const points = attempts?.reduce((s, a) => s + (a.points || 0), 0) || 0;
      // best streak: simple pass over attempts (ordered by created_at)
      const { data: ordered } = await supabase
        .from('progress_attempts')
        .select('is_correct, created_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: true });
      let best = 0, cur = 0;
      (ordered||[]).forEach(a => { cur = a.is_correct ? cur+1 : 0; best = Math.max(best, cur); });
      return { statusCode: 200, body: JSON.stringify({ attempts: attemptsCount, accuracy: attemptsCount? correct/attemptsCount : null, points, best_streak: best }) };
    }

    if (section === 'modes') {
      const { data } = await supabase
        .from('progress_attempts')
        .select('mode, is_correct')
        .eq('user_id', user_id);
      const byMode = {};
      (data||[]).forEach(r => {
        const m = r.mode || 'unknown';
        byMode[m] ||= { mode: m, correct: 0, total: 0 };
        byMode[m].total += 1;
        if (r.is_correct) byMode[m].correct += 1;
      });
      return { statusCode: 200, body: JSON.stringify(Object.values(byMode)) };
    }

  if (section === 'sessions') {
      const list_name = url.searchParams.get('list_name');
      let query = supabase
        .from('progress_sessions')
        .select('session_id, mode, list_name, started_at, ended_at, summary')
        .eq('user_id', user_id);
      if (list_name) query = query.eq('list_name', list_name);
      const { data, error } = await query
        .order('ended_at', { ascending: false })
        .limit(500);
      if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 200, body: JSON.stringify(data || []) };
    }

    if (section === 'attempts') {
      const { data } = await supabase
        .from('progress_attempts')
        .select('created_at, mode, word, is_correct, points')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(50);
      return { statusCode: 200, body: JSON.stringify(data || []) };
    }

    if (section === 'badges') {
      // Simple derived badges from attempts/sessions (can be replaced with a table later)
      const [{ data: attempts }, { data: sessions }] = await Promise.all([
        supabase.from('progress_attempts').select('is_correct, points, created_at').eq('user_id', user_id),
        supabase.from('progress_sessions').select('summary').eq('user_id', user_id)
      ]);
      const totalCorrect = (attempts||[]).filter(a => a.is_correct).length;
      const points = (attempts||[]).reduce((s,a)=>s+(a.points||0),0);
      let best = 0, cur = 0; (attempts||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).forEach(a=>{cur=a.is_correct?cur+1:0;best=Math.max(best,cur)});
      const badges = [];
      if (totalCorrect >= 1) badges.push({ id:'first_correct', name:'First Steps', emoji:'🥇' });
      if (best >= 5) badges.push({ id:'streak_5', name:'Hot Streak', emoji:'🔥' });
      if (totalCorrect >= 100) badges.push({ id:'hundred_correct', name:'Century', emoji:'💯' });
      if (points >= 1000) badges.push({ id:'thousand_points', name:'Scorer', emoji:'🏆' });
      // look for sessions with summary.accuracy >= 1 and total >= 10
      try {
        (sessions||[]).forEach(s=>{
          let sum = s.summary; if (typeof sum === 'string') sum = JSON.parse(sum);
          if (sum && (sum.accuracy === 1 || sum.perfect === true) && (sum.total||0) >= 10) badges.push({ id:'perfect_round', name:'Perfectionist', emoji:'🌟' });
        });
      } catch {}
      return { statusCode: 200, body: JSON.stringify(badges) };
    }

    if (section === 'overview') {
      // Build a positive, exploration-focused overview
      const [sessRes, attRes] = await Promise.all([
        supabase.from('progress_sessions').select('session_id, mode, list_name, summary, started_at, ended_at').eq('user_id', user_id),
        supabase.from('progress_attempts').select('word, is_correct, points, created_at, mode').eq('user_id', user_id)
      ]);
      const sessions = sessRes.data || [];
      const attempts = attRes.data || [];

      // Helper: parse summary JSON (may be string)
      const parseSummary = (s) => {
        try { if (!s) return null; if (typeof s === 'string') return JSON.parse(s); return s; } catch { return null; }
      };
      const isPerfect = (sum) => {
        const s = parseSummary(sum) || {};
        if (s.accuracy === 1 || s.perfect === true) return true;
        if (typeof s.score === 'number' && typeof s.total === 'number') return s.score >= s.total;
        if (typeof s.score === 'number' && typeof s.max === 'number') return s.score >= s.max;
        return false;
      };

      // 1) Lists Explored: distinct non-null list_name
      const listNames = new Set((sessions.filter(s => s.list_name).map(s => s.list_name)));
      const lists_explored = listNames.size;

      // 2) Perfect Runs: sessions with perfect summary
      const perfect_runs = sessions.reduce((n, s) => n + (isPerfect(s.summary) ? 1 : 0), 0);

      // 3) Mastered: count distinct (list_name, mode) combos where there is at least one perfect session
      const masteredPairs = new Set();
      sessions.forEach(s => {
        const ln = s.list_name || null; if (!ln) return;
        if (isPerfect(s.summary)) masteredPairs.add(`${ln}||${s.mode||'unknown'}`);
      });
      const mastered = masteredPairs.size;
      // Back-compat alias for older UIs
      const mastered_lists = mastered;

      // 4) Best Streak: longest run of correct attempts over time
      let best = 0, cur = 0;
      attempts.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).forEach(a => { cur = a.is_correct ? cur+1 : 0; best = Math.max(best, cur); });
      const best_streak = best;

      // 5) Words Discovered: distinct words attempted
      const words_discovered = new Set((attempts.map(a => a.word).filter(Boolean))).size;

      // 6) Words Mastered: per word accuracy > 80%
      const perWord = new Map();
      attempts.forEach(a => {
        if (!a.word) return;
        const cur = perWord.get(a.word) || { total: 0, correct: 0 };
        cur.total += 1; if (a.is_correct) cur.correct += 1; perWord.set(a.word, cur);
      });
      let words_mastered = 0;
      perWord.forEach(({ total, correct }) => { if (total > 0 && (correct/total) >= 0.8) words_mastered += 1; });

  // 7) Sessions Played: count
      const sessions_played = sessions.length;

      // Points and Stars:
      const total_points = attempts.reduce((sum, a) => sum + (Number.isFinite(a.points) ? a.points : (parseFloat(a.points) || 0)), 0);
      // Stars criteria (strict):
      // 100% -> 3 stars; >= 90% -> 2; >= 80% -> 1; else 0.
      // Prefer derived accuracy (accuracy or score/total) over any pre-set stars in summary.
      function deriveStars(summ) {
        const s = summ || {};
        let acc = null;
        if (typeof s.accuracy === 'number') acc = s.accuracy;
        else if (typeof s.score === 'number' && typeof s.total === 'number' && s.total > 0) acc = s.score / s.total;
        else if (typeof s.score === 'number' && typeof s.max === 'number' && s.max > 0) acc = s.score / s.max;
        if (acc != null) {
          if (acc >= 1) return 3; // only 100% earns 3 stars
          if (acc >= 0.9) return 2;
          if (acc >= 0.8) return 1;
          return 0;
        }
        // Fallback to provided stars if no accuracy info
        if (typeof s.stars === 'number') return s.stars;
        return 0;
      }
      let stars_total = 0;
      sessions.forEach(s => { stars_total += deriveStars(parseSummary(s.summary)); });

      // 8) Badges Earned: derive like the badges section
      let badges_count = 0;
      try {
        const totalCorrect = attempts.filter(a => a.is_correct).length;
        let localBest = 0, c = 0; attempts.sort((a,b) => new Date(a.created_at)-new Date(b.created_at)).forEach(a=>{c=a.is_correct?c+1:0;localBest=Math.max(localBest,c)});
        const badges = [];
        if (totalCorrect >= 1) badges.push('first_correct');
        if (localBest >= 5) badges.push('streak_5');
        // points not fetched here; skip points-based badge or compute from separate query if needed
        (sessions||[]).forEach(s=>{ const sum = parseSummary(s.summary); if (sum && (sum.accuracy === 1 || sum.perfect === true || (typeof sum.score==='number' && typeof sum.total==='number' && sum.score>=sum.total) || (typeof sum.score==='number' && typeof sum.max==='number' && sum.score>=sum.max))) badges.push('perfect_round'); });
        badges_count = badges.length;
      } catch {}

      // 9) Favorite Word List: most played list_name
      const listCounts = new Map();
      sessions.forEach(s => { if (s.list_name) listCounts.set(s.list_name, (listCounts.get(s.list_name)||0)+1); });
      let favorite_list = null;
      if (listCounts.size) {
        let top = null; listCounts.forEach((cnt, name) => { if (!top || cnt > top.cnt) top = { name, cnt }; });
        favorite_list = top;
      }

      // 10) Hardest Word: most incorrect (min 3 attempts and incorrect > correct)
      const wordStats = new Map();
      attempts.forEach(a => { if (!a.word) return; const s = wordStats.get(a.word) || { total:0, correct:0 }; s.total += 1; if (a.is_correct) s.correct += 1; wordStats.set(a.word, s); });
      let hardest_word = null;
      wordStats.forEach((s, w) => {
        const incorrect = s.total - s.correct;
        if (s.total < 3 || incorrect <= s.correct) return;
        const acc = s.correct / s.total;
        if (!hardest_word) hardest_word = { word: w, misses: incorrect, attempts: s.total, accuracy: acc };
        else if (incorrect > hardest_word.misses || (incorrect === hardest_word.misses && acc < hardest_word.accuracy)) hardest_word = { word: w, misses: incorrect, attempts: s.total, accuracy: acc };
      });

      return { statusCode: 200, body: JSON.stringify({
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
      }) };
    }

    if (section === 'challenging') {
      // Return words where the student is wrong > 60% for a given skill.
      // Normalize ENG/KOR and exclude meaning-mode noise.
      const { data: attempts } = await supabase
        .from('progress_attempts')
        .select('mode, word, is_correct, points, correct_answer, extra')
        .eq('user_id', user_id);

      const normalize = (s) => (s && typeof s === 'string') ? s.trim().toLowerCase() : null;
      const hasHangul = (s) => typeof s === 'string' && /[\u3131-\uD79D\uAC00-\uD7AF]/.test(s);
      const hasLatin = (s) => typeof s === 'string' && /[A-Za-z]/.test(s);
      const toObj = (x) => { try { return typeof x === 'string' ? JSON.parse(x) : (x||null); } catch { return null; } };
      const normMode = (m) => (m||'').toString().toLowerCase().replace(/[^a-z0-9]+/g,'_');
      const skillOf = (mode) => {
        const m = normMode(mode);
        if (m.includes('spell')) return 'spelling';
        if (m.includes('listen')) return 'listening';
        if (m.includes('meaning')) return 'meaning';
        if (m.includes('multi') || m.includes('choice') || m.includes('picture') || m.includes('read')) return 'reading';
        return null;
      };
      const EXCLUDE_MEANING = true; // reduce noise

      // Aggregate per normalized ENGLISH word + skill
      // value: { total, correct, word_en, word_kr }
      const agg = new Map();

      (attempts||[]).forEach(a => {
        const skill = skillOf(a.mode);
        if (!skill) return;
        if (EXCLUDE_MEANING && skill === 'meaning') return;
        const ex = toObj(a.extra) || {};
        // Determine english and korean representations from various fields
        let eng = null, kor = null;
        const dir = (ex.direction || ex.dir || '').toString().toLowerCase();
        // Priority by direction hints
        if (dir === 'kor_to_eng' && hasLatin(a.correct_answer)) eng = a.correct_answer;
        if (dir === 'eng_to_kor' && hasLatin(a.word)) eng = a.word;
        // Fallback scan of candidates
        const engCands = [eng, a.word, a.correct_answer, ex.word_en, ex.en, ex.eng, ex.english, ex.answer, ex.target, ex.prompt, ex.answer_text].filter(Boolean);
        for (const c of engCands) { if (!eng && hasLatin(c)) { eng = c; break; } }
        const korCands = [ex.word_kr, ex.kr, ex.kor, ex.korean, ex.prompt, a.word, a.correct_answer, ex.question].filter(Boolean);
        for (const c of korCands) { if (!kor && hasHangul(c)) { kor = c; break; } }
        if (!eng) return; // skip if we cannot resolve an English key
        const key = normalize(eng) + '||' + skill;
        if (!key || key.startsWith('||')) return;

        // Weight: use simple correctness for all to avoid points variance
        const w = a.is_correct ? 1 : 0;
        const cur = agg.get(key) || { total:0, correct:0, word_en: eng, word_kr: kor || null };
        cur.total += 1;
        cur.correct += w;
        // Keep the latest seen pretty display forms (not normalized)
        if (!cur.word_en && eng) cur.word_en = eng;
        if (!cur.word_kr && kor) cur.word_kr = kor;
        agg.set(key, cur);
      });

      const out = [];
      agg.forEach((v, key) => {
        const [, skill] = key.split('||');
        const acc = v.total ? (v.correct / v.total) : 0;
        if (acc < 0.4) { // wrong > 60%
          out.push({ word: v.word_en, word_en: v.word_en, word_kr: v.word_kr || null, skill, accuracy: acc, attempts: v.total });
        }
      });
      out.sort((a,b) => (a.accuracy - b.accuracy) || (b.attempts - a.attempts));
      return { statusCode: 200, body: JSON.stringify(out.slice(0, 20)) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown section' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
