// Review Manager & Mode Utilities
// Provides provenance-aware tracking for review sessions without altering existing mode code drastically.
// Phase 1: Adds attempt_context, source_list(s), first_correct_in_review, review_session_id, word_id enrichment.

// NOTE: path requires three '..' segments to reach repo root from /Games/Word Arcade/modes/
import { logAttempt } from '../../../students/records.js';

// Simple deterministic hash for a word object combining eng/kor forms.
function hashWord(w) {
  const eng = (w.eng || w.word || '').toString().trim().toLowerCase();
  const kor = (w.kor || w.word_kr || '').toString().trim().toLowerCase();
  const base = `${eng}|${kor}`;
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'w_' + (h >>> 0).toString(36);
}

export class ReviewManager {
  constructor({ words = [], provenanceMap = new Map(), primaryAttribution = 'first' } = {}) {
    // words: array of word objects used in review.
    // provenanceMap: Map(wordKey -> array of source list names)
    // primaryAttribution: 'first' | 'all' | 'none' (how to attribute list progress later if needed)
    this.words = words;
    this.provenanceMap = provenanceMap; // key -> [listNames]
    this.primaryAttribution = primaryAttribution;
    this.reviewSessionId = `review-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    this.firstCorrect = new Set(); // set of word_id values already credited this session
    this.wordMeta = new Map(); // word_id -> { source_lists, primary }
    for (const w of words) {
      const wid = hashWord(w);
      const lists = provenanceMap.get(wid) || provenanceMap.get(w.eng) || [];
      const primary = lists[0] || null;
      this.wordMeta.set(wid, { source_lists: lists, primary });
    }
  }

  buildExtraFor(wordObj) {
    const wid = hashWord(wordObj);
    const meta = this.wordMeta.get(wid) || { source_lists: [], primary: null };
    return {
      attempt_context: 'review',
      review_session_id: this.reviewSessionId,
      word_id: wid,
      source_list: meta.source_lists.length === 1 ? meta.source_lists[0] : null,
      source_lists: meta.source_lists.length > 1 ? meta.source_lists : undefined,
      primary_source_list: meta.primary || null
    };
  }

  // Log an attempt with enrichment; returns whether this was first unique correct.
  logReviewAttempt({ session_id, mode = 'review', wordObj, is_correct, answer = null, correct_answer = null, points = null, attempt_index = null, duration_ms = null, round = null, baseExtra = {} }) {
    const extra = { ...baseExtra, ...this.buildExtraFor(wordObj) };
    const wid = extra.word_id;
    let first_correct_in_review = false;
    if (is_correct && !this.firstCorrect.has(wid)) {
      this.firstCorrect.add(wid);
      first_correct_in_review = true;
    }
    extra.first_correct_in_review = first_correct_in_review;
    // Downstream progress logic (Phase 2) can use (is_correct && first_correct_in_review)
    logAttempt({
      session_id,
      mode,
      word: (wordObj.eng || wordObj.word || '').toString(),
      is_correct,
      answer,
      correct_answer,
      points,
      attempt_index,
      duration_ms,
      round,
      extra
    });
    return first_correct_in_review;
  }

  summary() {
    return {
      review_session_id: this.reviewSessionId,
      unique_correct: this.firstCorrect.size,
      total_words: this.words.length,
      attribution_policy: this.primaryAttribution
    };
  }
}

// Helper to construct provenance map from an array of raw words where each word may already carry a _lists field.
export function buildProvenance(words) {
  const map = new Map();
  for (const w of words) {
    const wid = hashWord(w);
    const lists = (w._lists && Array.isArray(w._lists) ? w._lists : (w.source_lists || [])).filter(Boolean);
    if (!map.has(wid)) map.set(wid, []);
    for (const L of lists) {
      if (L && !map.get(wid).includes(L)) map.get(wid).push(L);
    }
  }
  return map;
}

export function tagWordWithList(word, listName) {
  if (!word) return word;
  if (!word._lists) word._lists = [];
  if (listName && !word._lists.includes(listName)) word._lists.push(listName);
  return word;
}
