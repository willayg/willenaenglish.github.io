// Shared Grammar Config Resolver
// Provides getGrammarConfigFromListKey(listKey, displayTitle?) returning
// { grammarFile, grammarName, grammarConfig } using Level 1 definitions.
// Avoids duplicating logic between homework autostart and level1 modal.

// Minimal Level 1 mapping (importing full modal list is heavier; keep lean).
// Source of truth: ui/level1_grammar_modal.js; keep IDs/answerChoices in sync.
const LEVEL1_DEFS = [
  { file: 'data/grammar/level1/articles.json', id: 'articles', label: 'A vs An', answerChoices: ['a','an'], lessonModule: 'grammar_lesson', lessonId: 'articles' },
  { file: 'data/grammar/level1/he_she_it.json', id: 'he_vs_she_vs_it', label: 'He vs She vs It', answerChoices: ['he','she','it'], lessonModule: 'grammar_lesson_he_she_it', lessonId: 'he_vs_she_vs_it' },
  { file: 'data/grammar/level1/want_vs_wants.json', id: 'want_vs_wants', label: 'Want vs Wants', answerChoices: ['want','wants'], lessonModule: 'grammar_lesson_want_wants', lessonId: 'want_vs_wants' },
  { file: 'data/grammar/level1/like_vs_likes.json', id: 'like_vs_likes', label: 'Like vs Likes', answerChoices: ['like','likes'], lessonModule: 'grammar_lesson_like_likes', lessonId: 'like_vs_likes' },
  { file: 'data/grammar/level1/in_on_under.json', id: 'in_on_under', label: 'In vs On vs Under', answerChoices: ['in','on','under'], lessonModule: 'grammar_lesson_in_on_under', lessonId: 'in_on_under' },
  { file: 'data/grammar/level1/am_are_is.json', id: 'am_are_is', label: 'Am vs Are vs Is', answerChoices: ['am','is','are'], lessonModule: 'grammar_lesson_am_are_is', lessonId: 'am_are_is' },
  { file: 'data/grammar/level1/have_vs_has.json', id: 'have_vs_has', label: 'Have vs Has', answerChoices: ['have','has'], lessonModule: 'grammar_lesson_have_has', lessonId: 'have_vs_has' },
  { file: 'data/grammar/level1/contractions_be.json', id: 'contractions_be', label: 'I am → I\'m', answerChoices: ["'m","'re","'s"], lessonModule: 'grammar_lesson_contractions_be', lessonId: 'contractions_be' },
  { file: 'data/grammar/level1/it_vs_they.json', id: 'it_vs_they', label: 'It vs They', answerChoices: ['it','they'], lessonModule: 'grammar_lesson_it_vs_they', lessonId: 'it_vs_they' },
  { file: 'data/grammar/level1/this_vs_that.json', id: 'this_vs_that', label: 'This vs That', answerChoices: ['this','that'], lessonModule: 'grammar_lesson_this_that', lessonId: 'this_vs_that' },
  { file: 'data/grammar/level1/these_vs_those.json', id: 'these_vs_those', label: 'These vs Those', answerChoices: ['these','those'], lessonModule: 'grammar_lesson_these_those', lessonId: 'these_vs_those' },
  { file: 'data/grammar/level1/is_are_questions.json', id: 'is_are_questions', label: 'Is vs Are (Questions)', answerChoices: ['is','are'], lessonModule: 'grammar_lesson_is_are_questions', lessonId: 'is_are_questions' },
  { file: 'data/grammar/level1/do_does_questions.json', id: 'do_does_questions', label: 'Do vs Does (Questions)', answerChoices: ['do','does'], lessonModule: 'grammar_lesson_do_does_questions', lessonId: 'do_does_questions' },
  { file: 'data/grammar/level1/can_cant.json', id: 'can_vs_cant', label: 'Can vs Can\'t', answerChoices: ['can','can\'t'], lessonModule: 'grammar_lesson_can_cant', lessonId: 'can_vs_cant' },
  { file: 'data/grammar/level1/isnt_arent.json', id: 'isnt_vs_arent', label: "Isn't vs Aren't", answerChoices: ["isn't","aren't"], lessonModule: 'grammar_lesson_isnt_arent', lessonId: 'isnt_vs_arent' },
  { file: 'data/grammar/level1/dont_doesnt.json', id: 'dont_vs_doesnt', label: "Don't vs Doesn't", answerChoices: ["don't","doesn't"], lessonModule: 'grammar_lesson_dont_doesnt', lessonId: 'dont_vs_doesnt' },
  // Plural / countable modes use internal singular/plural choices (special flag)
  { file: 'data/grammar/level1/plurals_s.json', id: 'plurals_s', label: 'bear/bears', answerChoices: ['singular','plural'], lessonModule: 'grammar_lesson_plurals_s', lessonId: 'plurals_s', isPluralMode: true },
  { file: 'data/grammar/level1/plurals_es.json', id: 'plurals_es', label: 'watch/watches', answerChoices: ['singular','plural'], lessonModule: 'grammar_lesson_plurals_es', lessonId: 'plurals_es', isPluralMode: true },
  { file: 'data/grammar/level1/plurals_ies.json', id: 'plurals_ies', label: 'baby/babies', answerChoices: ['singular','plural'], lessonModule: 'grammar_lesson_plurals_ies', lessonId: 'plurals_ies', isPluralMode: true },
  { file: 'data/grammar/level1/plurals_irregular.json', id: 'plurals_irregular', label: 'mouse/mice', answerChoices: ['singular','plural'], lessonModule: 'grammar_lesson_plurals_irregular', lessonId: 'plurals_irregular', isPluralMode: true },
  { file: 'data/grammar/level1/countable_uncountable.json', id: 'countable_vs_uncountable', label: 'Count vs Non-Count', answerChoices: ['countable','uncountable'], lessonModule: 'grammar_lesson_countable_uncountable', lessonId: 'countable_vs_uncountable' }
];

const byBase = new Map();
// Level 2 definitions (mirrors ui/level2_grammar_modal.js). Lists without fixed answerChoices use empty array; specialized modes infer choices dynamically.
const LEVEL2_DEFS = [
  { file: 'data/grammar/level2/some_vs_any.json', id: 'some_vs_any', label: 'Some vs Any', answerChoices: ['some','any'], lessonModule: 'grammar_lesson', lessonId: 'some_vs_any' },
  { file: 'data/grammar/level2/there_is_vs_there_are.json', id: 'there_is_vs_there_are', label: 'There is vs There are', answerChoices: ['there is','there are'], lessonModule: 'grammar_lesson', lessonId: 'there_is_vs_there_are' },
  { file: 'data/grammar/level2/are_there_vs_is_there.json', id: 'are_there_vs_is_there', label: 'Is there vs Are there?', answerChoices: ['Is there','Are there'], lessonModule: 'grammar_lesson', lessonId: 'are_there_vs_is_there' },
  { file: 'data/grammar/level2/wh_who_what.json', id: 'wh_who_what', label: 'WH: Who & What', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'wh_who_what' },
  { file: 'data/grammar/level2/wh_where_when_whattime.json', id: 'wh_where_when_whattime', label: 'WH: Where, When & Time', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'wh_where_when_whattime' },
  { file: 'data/grammar/level2/wh_how_why_which.json', id: 'wh_how_why_which', label: 'WH: How, Why & Which', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'wh_how_why_which' },
  { file: 'data/grammar/level2/short_questions_1.json', id: 'short_questions_1', label: 'Short Questions 1', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'short_questions_1' },
  { file: 'data/grammar/level2/short_questions_2.json', id: 'short_questions_2', label: 'Short Questions 2', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'short_questions_2' },
  { file: 'data/grammar/level2/present_simple_sentences.json', id: 'present_simple_sentences', label: 'Present Simple: Sentences', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'present_simple_sentences', mode: 'present_simple_verb_choose' },
  { file: 'data/grammar/level2/present_simple_negative.json', id: 'present_simple_negative', label: 'Present Simple: Negative', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'present_simple_negative' },
  { file: 'data/grammar/level2/present_simple_questions_yesno.json', id: 'present_simple_questions_yesno', label: 'Present Simple: Yes/No Questions', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'present_simple_questions_yesno' },
  { file: 'data/grammar/level2/present_simple_questions_wh.json', id: 'present_simple_questions_wh', label: 'Present Simple: WH Questions', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'present_simple_questions_wh' },
  { file: 'data/grammar/level2/present_progressive.json', id: 'present_progressive', label: 'Present Progressive', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'present_progressive' },
  { file: 'data/grammar/level2/present_progressive_negative.json', id: 'present_progressive_negative', label: 'Present Progressive: Negative', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'present_progressive_negative' },
  { file: 'data/grammar/level2/present_progressive_questions_yesno.json', id: 'present_progressive_questions_yesno', label: 'Present Progressive: Yes/No', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'present_progressive_questions_yesno' },
  { file: 'data/grammar/level2/present_progressive_questions_wh.json', id: 'present_progressive_questions_wh', label: 'Present Progressive: WH Questions', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'present_progressive_questions_wh' },
  { file: 'data/grammar/level2/present_simple_vs_progressive.json', id: 'present_simple_vs_progressive', label: 'Simple vs Progressive', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'present_simple_vs_progressive' },
  { file: 'data/grammar/level2/prepositions_between_above_below.json', id: 'prepositions_between_above_below', label: 'Prepositions: Between, Above, Below', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'prepositions_between_above_below' },
  { file: 'data/grammar/level2/prepositions_next_to_behind_infront.json', id: 'prepositions_next_to_behind_infront', label: 'Prepositions: Next to, Behind, In front', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'prepositions_next_to_behind_infront' },
  { file: 'data/grammar/level2/prepositions_between_near_acrossfrom.json', id: 'prepositions_between_near_acrossfrom', label: 'Prepositions: Near, Across from', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'prepositions_between_near_acrossfrom' },
  { file: 'data/grammar/level2/prepositions_review.json', id: 'prepositions_review', label: 'Prepositions: Review', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'prepositions_review' },
  { file: 'data/grammar/level2/in_on_at_time.json', id: 'in_on_at_time', label: 'Time: In, On, At', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'in_on_at_time' },
  { file: 'data/grammar/level2/how_many_is_that.json', id: 'how_many_is_that', label: 'How Many & Counting', answerChoices: [], lessonModule: 'grammar_lesson', lessonId: 'how_many_is_that' }
];

LEVEL1_DEFS.concat(LEVEL2_DEFS).forEach(def => {
  const base = def.file.split('/').pop().replace(/\.json$/i,'').toLowerCase();
  byBase.set(base, def);
  byBase.set(def.id.toLowerCase(), def);
});

function sanitizeDisplayName(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (s.includes('/') || s.includes('\\')) s = s.split(/[/\\]/).pop();
  s = s.replace(/\.json$/i,'').replace(/[_-]+/g,' ');
  s = s.replace(/\s+/g,' ').trim();
  return s.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
}

export function getGrammarConfigFromListKey(listKey, displayTitle) {
  if (!listKey) return null;
  let key = listKey.trim();
  if (/^Games\/english_arcade\//.test(key)) key = key.replace(/^Games\/english_arcade\//,'');
  // Ensure full path for bare filenames
  if (!/data\/grammar\//i.test(key)) {
    const base = key.split(/[/\\]/).pop().replace(/\.json$/i,'');
    // Default to level1 path; caller may pass explicit level2 path already
    key = `data/grammar/level1/${base}.json`;
  }
  const base = key.split(/[/\\]/).pop().replace(/\.json$/i,'').toLowerCase();
  const def = byBase.get(base);
  if (!def) {
    return {
      grammarFile: key,
      grammarName: base,
      grammarConfig: { displayTitle: displayTitle || sanitizeDisplayName(base) }
    };
  }
  return {
    grammarFile: def.file,
    grammarName: def.id,
    grammarConfig: {
      displayTitle: displayTitle || def.label,
      lessonModule: def.lessonModule,
      lessonId: def.lessonId,
      answerChoices: def.answerChoices.slice(),
      ...(def.isPluralMode ? { isPluralMode: true } : {}),
      ...(def.mode ? { mode: def.mode } : {})
    }
  };
}
