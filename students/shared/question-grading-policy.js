export const GRADING_POLICY_VERSION='2.0.1';

const AI_FORMS=new Set(['write','multipart']);
const TRANSLATION_TYPES=new Set([
  'conditional_translation','translation_constrained','translation_write','translation','comparison_translation',
  'conditional_reading_translation','conditional_comparative_translation','purpose_translation_constrained',
  'as_as_translation','as_possible_translation','dialogue_translation','plan_translation','phrase_translation',
  'dummy_it_pair_translation','reading_translation_korean','translation_grammar','korean_to_english'
]);
const READING_ANSWER_TYPES=new Set([
  'reading_short_answer','reading_short_answer_text','reading_short_answer_korean','passage_short_answer',
  'short_answer','short_answer_korean','content_reason','content_answer_korean','korean_content_answer',
  'reading_full_sentence_answer','reading_two_direct_answers','reading_direct_answer','three_fact_answer',
  'detail_three_items','additional_method_question','referent_list_text'
]);
const DIALOGUE_TYPES=new Set([
  'dialogue_completion','dialogue_response_write','response_write','constrained_suggestion',
  'dialogue_alternative_expressions','dialogue_answer_completion','request_expression_write',
  'dialogue_paraphrase_with_word'
]);
const COMPOSITION_TYPES=new Set([
  'summary_write','reading_summary_write','constrained_summary','dialogue_summary','sentence_creation',
  'rule_based_writing','purpose_write','purpose_phrase_write','cause_sentence','integrated_response',
  'paraphrase_write','request_paraphrase_constrained'
]);

const toList=v=>Array.isArray(v)?v:(v==null?[]:[v]);
const strings=v=>toList(v).map(x=>String(x??'').trim()).filter(Boolean);
const bool=v=>v===true||v==='true';

function questionType(q){return String(q?.tracking?.questionType||q?.questionType||q?.metadata?.question_type||'').trim().toLowerCase()}
function override(q){return String(q?.metadata?.grading_policy_override||'').trim().toLowerCase()}
function isExactOverride(q){return ['exact','deterministic','strict_exact'].includes(override(q))}
function isSemanticOverride(q){return ['semantic','ai_semantic_strict'].includes(override(q))}

function familyFor(type){
  if(TRANSLATION_TYPES.has(type))return'translation';
  if(READING_ANSWER_TYPES.has(type))return'reading_answer';
  if(DIALOGUE_TYPES.has(type))return'dialogue';
  if(COMPOSITION_TYPES.has(type))return'composition';
  return'exact';
}

function semanticRule(family){
  if(family==='translation')return 'Judge whether the response accurately expresses the required Korean/source meaning in grammatical standard English while obeying every stated condition. Different wording and harmless word-order variation are allowed. A required grammar form or supplied condition may not be ignored.';
  if(family==='reading_answer')return 'Judge the answer against the passage and the exact question being asked. Accept a concise paraphrase when it gives the decisive answer, cause, reason, referent, or fact needed to answer the question, even if it is less specific than the model answer or omits nonessential descriptive detail. The model answer is evidence, not a checklist. Only require every listed detail when the prompt explicitly asks for multiple facts, a list, a number, an exact item, or another specifically requested detail. Reject contradictions, invented facts, answers that miss the decisive point, or answers that are too vague to answer the question.';
  if(family==='dialogue')return 'Judge whether the response is fully grammatical, natural standard English and unquestionably fits the exact dialogue and communicative function. Different wording is allowed only when it satisfies the stated cue or condition.';
  if(family==='composition')return 'Judge the task itself rather than requiring the model sentence. The reference is an example where the prompt allows original wording. Require grammatical standard English and every supplied word, meaning, grammar target, fact, or condition that the task asks for.';
  return 'Require deterministic equivalence to the reference answer.';
}

function baseConstraints(q){
  const c=q?.grading?.constraints&&typeof q.grading.constraints==='object'?q.grading.constraints:{};
  return{
    wordCount:Number(c.wordCount||0)||0,
    partWordCounts:Array.isArray(c.partWordCounts)?c.partWordCounts.map(x=>Number(x)||0):[],
    noContractions:bool(c.noContractions),
    contractionRequired:bool(c.contractionRequired),
    answerOrderIrrelevant:bool(c.answerOrderIrrelevant),
    alternatives:bool(c.alternatives),
    requiredWords:strings(c.requiredWords),
    requiredExpressions:strings(c.requiredExpressions)
  };
}

function contextConstraints(q,base){
  const c=q?.context&&typeof q.context==='object'?q.context:{},m=q?.metadata&&typeof q.metadata==='object'?q.metadata:{};
  const requiredWords=[...base.requiredWords,...strings(c.required_words),...strings(m.required_words)];
  const requiredExpressions=[...base.requiredExpressions,...strings(c.required_expressions),...strings(m.required_expressions),...strings(c.use)];
  return{
    ...base,
    wordCount:base.wordCount||Number(c.word_count||m.hard_word_count||0)||0,
    noContractions:base.noContractions||bool(c.no_contractions)||bool(m.no_contractions),
    contractionRequired:base.contractionRequired||bool(c.contraction_required)||bool(m.contraction_required),
    requiredWords:[...new Set(requiredWords)],
    requiredExpressions:[...new Set(requiredExpressions)]
  };
}

export function resolveQuestionGradingPolicy(question){
  const type=questionType(question),form=String(question?.form||'').toLowerCase(),constraints=contextConstraints(question,baseConstraints(question));
  if(isExactOverride(question))return{version:GRADING_POLICY_VERSION,mode:'exact_normalized',aiAllowed:false,family:'exact',reason:'explicit_exact_override',semanticRule:semanticRule('exact'),constraints};
  const family=familyFor(type),semantic=(isSemanticOverride(question)||family!=='exact')&&AI_FORMS.has(form);
  return{
    version:GRADING_POLICY_VERSION,
    mode:semantic?'ai_semantic_strict':'exact_normalized',
    aiAllowed:semantic,
    family:semantic?family:'exact',
    reason:semantic?(isSemanticOverride(question)?'explicit_semantic_override':`type:${type||'unknown'}`):`exact:${type||form||'unknown'}`,
    semanticRule:semanticRule(semantic?family:'exact'),
    constraints
  };
}

export function applyQuestionGradingPolicy(question){
  const policy=resolveQuestionGradingPolicy(question);
  return{...question,grading:{...(question?.grading||{}),...policy,constraints:policy.constraints}};
}

export function questionUsesSemanticAi(question){return resolveQuestionGradingPolicy(question).aiAllowed===true}

export function gradingPolicyDiagnostics(question){
  const p=resolveQuestionGradingPolicy(question);
  return{version:p.version,type:questionType(question),form:String(question?.form||''),mode:p.mode,ai:p.aiAllowed,family:p.family,reason:p.reason,constraints:p.constraints};
}
