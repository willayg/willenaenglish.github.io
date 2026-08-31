(function(){
'use strict';

// Safety guard for the 서술형 generator.
// Some source MC questions ask for the INAPPROPRIATE / INCORRECT choice.
// Their keyed answer is therefore a distractor and must never be promoted
// into a productive model answer by seosul-engine.js.

const nativeFetch = window.fetch.bind(window);
const SEOSUL_SELECT = 'id,section,question_type,prompt_text,context,choices,correct_answer,targets,student_usable,replacement_needed';
const NEGATIVE_STEM = /(적절하지\s*않|옳지\s*않|맞지\s*않|자연스럽지\s*않|일치하지\s*않|어색|틀린|잘못된|아닌\s*것|않는\s*것)/;

function isSeosulQuestionBankRequest(input){
  const raw = typeof input === 'string' ? input : (input && input.url) || '';
  if (!raw || !raw.includes('/rest/v1/test_prep_questions')) return false;
  try {
    const u = new URL(raw, location.href);
    return decodeURIComponent(u.searchParams.get('select') || '') === SEOSUL_SELECT;
  } catch (_) {
    const decoded = decodeURIComponent(raw);
    return decoded.includes('select=' + SEOSUL_SELECT);
  }
}

function unsafeForProductiveConversion(q){
  if (!q || !NEGATIVE_STEM.test(String(q.prompt_text || ''))) return false;
  const type = String(q.question_type || '');
  return new Set([
    'dialogue_blank',
    'contextual_reply_blank',
    'translation_dialogue_blank',
    'blank_question',
    'location_blank',
    'sentence_order',
    'translation_grammar',
    'korean_to_english',
    'translation_constrained'
  ]).has(type);
}

window.fetch = async function(input, init){
  const response = await nativeFetch(input, init);
  if (!isSeosulQuestionBankRequest(input) || !response.ok) return response;

  try {
    const rows = await response.clone().json();
    if (!Array.isArray(rows)) return response;
    const filtered = rows.filter(q => !unsafeForProductiveConversion(q));
    const removed = rows.length - filtered.length;
    if (!removed) return response;

    console.warn('[test-prep][seosul-source-safety] excluded negative-stem MC rows from productive conversion', { removed });
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(filtered), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (err) {
    console.warn('[test-prep][seosul-source-safety] guard failed; returning original response', err);
    return response;
  }
};
})();
