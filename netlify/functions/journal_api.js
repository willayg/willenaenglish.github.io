const { createClient } = require('@supabase/supabase-js');

const ALLOWLIST = new Set([
  'https://www.willenaenglish.com',
  'https://willenaenglish.com',
  'https://willenaenglish.github.io',
  'https://willenaenglish.netlify.app',
  'https://cf.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://api.willenaenglish.com',
  'http://localhost:9000',
  'http://localhost:8888'
]);

function headers(event) {
  const h = event.headers || {};
  const origin = (h.origin || h.Origin || '').trim();
  return {
    'Access-Control-Allow-Origin': ALLOWLIST.has(origin) ? origin : 'https://willenaenglish.netlify.app',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  };
}

function reply(event, statusCode, body) {
  return { statusCode, headers: headers(event), body: JSON.stringify(body) };
}

function accessToken(event) {
  const cookie = event.headers?.cookie || event.headers?.Cookie || '';
  const match = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : null;
}

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
}

function kstDayBounds(dateText) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dateText || '') ? dateText : new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const start = new Date(`${day}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { day, start: start.toISOString(), end: end.toISOString() };
}

function cleanChanges(changes) {
  if (!Array.isArray(changes)) return [];
  return changes.slice(0, 20).map(change => ({
    type: String(change?.type || 'correction').slice(0, 40),
    original: String(change?.original || '').slice(0, 500),
    corrected: String(change?.corrected || '').slice(0, 500),
    reason: String(change?.reason || '').slice(0, 500)
  }));
}

async function ownedEntry(admin, studentId, entryId) {
  const { data, error } = await admin.from('journal_entries').select('*').eq('id', entryId).eq('student_id', studentId).single();
  if (error || !data) return null;
  return data;
}

async function getEntryBundle(admin, entry) {
  if (!entry) return null;
  const { data: sentences, error } = await admin.from('journal_sentences')
    .select('*').eq('journal_entry_id', entry.id).order('sentence_order', { ascending: true });
  if (error) throw error;
  return { entry, sentences: sentences || [] };
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: headers(event), body: '' };
  if (!['GET', 'POST'].includes(event.httpMethod)) return reply(event, 405, { success: false, error: 'Method not allowed' });

  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return reply(event, 500, { success: false, error: 'Journal service is not configured' });

    const token = accessToken(event);
    if (!token) return reply(event, 401, { success: false, error: 'Not signed in' });

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const studentId = authData?.user?.id;
    if (authError || !studentId) return reply(event, 401, { success: false, error: 'Session expired' });

    const query = event.queryStringParameters || {};
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const action = query.action || body.action || 'today';

    if (action === 'today' && event.httpMethod === 'GET') {
      const bounds = kstDayBounds(query.date);
      const { data, error } = await admin.from('journal_entries')
        .select('*')
        .eq('student_id', studentId)
        .gte('started_at', bounds.start)
        .lt('started_at', bounds.end)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return reply(event, 200, { success: true, date: bounds.day, journal: await getEntryBundle(admin, data) });
    }

    if (action === 'save_draft' && event.httpMethod === 'POST') {
      const bounds = kstDayBounds(body.date);
      const target = Math.max(6, Math.min(20, Number(body.target_sentences) || 6));
      const originalText = String(body.original_text || '').slice(0, 20000);
      const promptText = String(body.prompt_text || 'Write about your day.').slice(0, 1000);
      let entry = null;

      if (body.entry_id) entry = await ownedEntry(admin, studentId, body.entry_id);
      if (!entry) {
        const { data: existing, error: findError } = await admin.from('journal_entries')
          .select('*').eq('student_id', studentId).gte('started_at', bounds.start).lt('started_at', bounds.end)
          .neq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (findError) throw findError;
        entry = existing || null;
      }

      if (entry && entry.status !== 'draft') {
        return reply(event, 409, { success: false, error: 'Submitted writing is locked and cannot be changed.' });
      }

      if (entry) {
        const { data, error } = await admin.from('journal_entries').update({
          original_text: originalText,
          original_sentence_count: Number(body.sentence_count) || 0,
          target_sentences: target,
          prompt_text: promptText,
          updated_at: new Date().toISOString()
        }).eq('id', entry.id).eq('student_id', studentId).select('*').single();
        if (error) throw error;
        entry = data;
      } else {
        const { data, error } = await admin.from('journal_entries').insert({
          student_id: studentId,
          original_text: originalText,
          original_sentence_count: Number(body.sentence_count) || 0,
          target_sentences: target,
          prompt_text: promptText,
          status: 'draft',
          started_at: new Date().toISOString()
        }).select('*').single();
        if (error) throw error;
        entry = data;
      }
      return reply(event, 200, { success: true, entry });
    }

    if (action === 'submit' && event.httpMethod === 'POST') {
      const entry = await ownedEntry(admin, studentId, body.entry_id);
      if (!entry) return reply(event, 404, { success: false, error: 'Journal not found' });
      if (entry.status !== 'draft' && entry.status !== 'correcting') {
        return reply(event, 409, { success: false, error: 'This journal has already been submitted.' });
      }
      const originalText = String(body.original_text || '').trim();
      const count = Number(body.sentence_count) || 0;
      if (!originalText || count < entry.target_sentences) return reply(event, 400, { success: false, error: 'Sentence target has not been reached.' });

      const lockedText = entry.submitted_at ? entry.original_text : originalText;
      const lockedCount = entry.submitted_at ? entry.original_sentence_count : count;
      const { data, error } = await admin.from('journal_entries').update({
        original_text: lockedText,
        original_sentence_count: lockedCount,
        status: 'correcting',
        submitted_at: entry.submitted_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', entry.id).eq('student_id', studentId).select('*').single();
      if (error) throw error;
      return reply(event, 200, { success: true, entry: data });
    }

    if (action === 'save_correction' && event.httpMethod === 'POST') {
      const entry = await ownedEntry(admin, studentId, body.entry_id);
      if (!entry) return reply(event, 404, { success: false, error: 'Journal not found' });
      if (!['correcting', 'review'].includes(entry.status)) return reply(event, 409, { success: false, error: 'Journal is not ready for correction.' });
      const incoming = Array.isArray(body.sentences) ? body.sentences : [];
      if (!incoming.length || incoming.length > 100) return reply(event, 400, { success: false, error: 'Correction response is incomplete.' });

      const rows = incoming.map((s, i) => {
        const original = String(s?.original || '').trim();
        const corrected = String(s?.corrected || '').trim();
        if (!original || !corrected) throw new Error(`Correction sentence ${i + 1} is invalid.`);
        return {
          journal_entry_id: entry.id,
          sentence_order: i + 1,
          original_sentence: original.slice(0, 4000),
          corrected_sentence: corrected.slice(0, 4000),
          changes: cleanChanges(s?.changes),
          speech_completed: false,
          speech_attempts: 0,
          speech_best_score: 0,
          updated_at: new Date().toISOString()
        };
      });

      const { error: deleteError } = await admin.from('journal_sentences').delete().eq('journal_entry_id', entry.id);
      if (deleteError) throw deleteError;
      const { data: savedSentences, error: insertError } = await admin.from('journal_sentences').insert(rows).select('*').order('sentence_order', { ascending: true });
      if (insertError) throw insertError;

      const correctedText = rows.map(r => r.corrected_sentence).join(' ');
      const metadata = Object.assign({}, entry.ai_metadata || {}, body.ai_metadata || {}, { review_index: 0, speak_index: 0 });
      const { data: savedEntry, error: updateError } = await admin.from('journal_entries').update({
        corrected_text: correctedText,
        status: 'review',
        ai_model: String(body.ai_model || '').slice(0, 100) || null,
        ai_metadata: metadata,
        updated_at: new Date().toISOString()
      }).eq('id', entry.id).eq('student_id', studentId).select('*').single();
      if (updateError) throw updateError;
      return reply(event, 200, { success: true, journal: { entry: savedEntry, sentences: savedSentences || [] } });
    }

    if (action === 'progress' && event.httpMethod === 'POST') {
      const entry = await ownedEntry(admin, studentId, body.entry_id);
      if (!entry) return reply(event, 404, { success: false, error: 'Journal not found' });
      const metadata = Object.assign({}, entry.ai_metadata || {});
      if (Number.isInteger(body.review_index)) metadata.review_index = Math.max(0, body.review_index);
      if (Number.isInteger(body.speak_index)) metadata.speak_index = Math.max(0, body.speak_index);
      const patch = { ai_metadata: metadata, updated_at: new Date().toISOString() };
      if (['review', 'speaking'].includes(body.status)) patch.status = body.status;
      const { data, error } = await admin.from('journal_entries').update(patch).eq('id', entry.id).eq('student_id', studentId).select('*').single();
      if (error) throw error;
      return reply(event, 200, { success: true, entry: data });
    }

    if (action === 'speech_attempt' && event.httpMethod === 'POST') {
      const entry = await ownedEntry(admin, studentId, body.entry_id);
      if (!entry) return reply(event, 404, { success: false, error: 'Journal not found' });
      const order = Number(body.sentence_order);
      const { data: sentence, error: sentenceError } = await admin.from('journal_sentences')
        .select('*').eq('journal_entry_id', entry.id).eq('sentence_order', order).single();
      if (sentenceError || !sentence) return reply(event, 404, { success: false, error: 'Sentence not found' });

      const score = Math.max(0, Math.min(100, Number(body.match_score) || 0));
      const accepted = !!body.accepted;
      const transcript = String(body.transcript || '').slice(0, 4000);
      const normalized = String(body.normalized_transcript || '').slice(0, 4000);
      const { error: attemptError } = await admin.from('journal_speech_attempts').insert({
        journal_sentence_id: sentence.id,
        student_id: studentId,
        transcript,
        normalized_transcript: normalized,
        match_score: score,
        accepted
      });
      if (attemptError) throw attemptError;

      const { data: updatedSentence, error: updateError } = await admin.from('journal_sentences').update({
        speech_completed: sentence.speech_completed || accepted,
        speech_attempts: (sentence.speech_attempts || 0) + 1,
        speech_best_score: Math.max(sentence.speech_best_score || 0, score),
        updated_at: new Date().toISOString()
      }).eq('id', sentence.id).select('*').single();
      if (updateError) throw updateError;
      return reply(event, 200, { success: true, sentence: updatedSentence });
    }

    if (action === 'mark_spoken' && event.httpMethod === 'POST') {
      const entry = await ownedEntry(admin, studentId, body.entry_id);
      if (!entry) return reply(event, 404, { success: false, error: 'Journal not found' });
      const order = Number(body.sentence_order);
      const { data, error } = await admin.from('journal_sentences').update({ speech_completed: true, updated_at: new Date().toISOString() })
        .eq('journal_entry_id', entry.id).eq('sentence_order', order).select('*').single();
      if (error) throw error;
      return reply(event, 200, { success: true, sentence: data });
    }

    if (action === 'complete' && event.httpMethod === 'POST') {
      const entry = await ownedEntry(admin, studentId, body.entry_id);
      if (!entry) return reply(event, 404, { success: false, error: 'Journal not found' });
      const { data, error } = await admin.from('journal_entries').update({
        status: 'completed', completed_at: entry.completed_at || new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq('id', entry.id).eq('student_id', studentId).select('*').single();
      if (error) throw error;
      return reply(event, 200, { success: true, entry: data });
    }

    if (action === 'reset' && event.httpMethod === 'POST') {
      const entry = await ownedEntry(admin, studentId, body.entry_id);
      if (!entry) return reply(event, 404, { success: false, error: 'Journal not found' });
      if (entry.status === 'completed') return reply(event, 409, { success: false, error: 'Completed journals are kept as history.' });
      const { error: sentenceDeleteError } = await admin.from('journal_sentences').delete().eq('journal_entry_id', entry.id);
      if (sentenceDeleteError) throw sentenceDeleteError;
      const { data, error } = await admin.from('journal_entries').update({
        original_text: '', corrected_text: null, original_sentence_count: 0, status: 'draft', ai_model: null, ai_metadata: {}, submitted_at: null, completed_at: null, updated_at: new Date().toISOString()
      }).eq('id', entry.id).eq('student_id', studentId).select('*').single();
      if (error) throw error;
      return reply(event, 200, { success: true, entry: data });
    }

    return reply(event, 404, { success: false, error: 'Unknown journal action' });
  } catch (error) {
    console.error('[journal_api]', error);
    const message = error instanceof SyntaxError ? 'Invalid request body' : (error?.message || 'Journal request failed');
    return reply(event, error instanceof SyntaxError ? 400 : 500, { success: false, error: message });
  }
};
