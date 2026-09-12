// Canonical question boundary for Level Test v2.
// Raw database/source records must be normalized here before they reach the
// renderer, grader, selector, or calculation engine.

export const QUESTION_FORMS=Object.freeze({
  CHOICE:'choice',
  SENTENCE_ORDER:'sentence_order',
  WRITTEN:'written',
  READING_CHOICE:'reading_choice',
  LISTENING_CHOICE:'listening_choice'
});

export const QUESTION_SKILLS=Object.freeze({
  VOCABULARY:'vocabulary',
  GRAMMAR:'grammar',
  LANGUAGE:'language_knowledge',
  READING:'reading',
  LISTENING:'listening',
  WRITING:'writing',
  UNKNOWN:'unknown'
});

const clean=value=>String(value??'').trim();
const numberOrNull=value=>Number.isFinite(Number(value))?Number(value):null;
const array=value=>Array.isArray(value)?value:[];
const unique=values=>[...new Set(values.map(clean).filter(Boolean))];

function normalizeMetadata(row){
  const metadata=row?.metadata;
  return metadata&&typeof metadata==='object'&&!Array.isArray(metadata)?{...metadata}:{};
}

function normalizedOptions(row){
  const related=array(row?.assessment_item_options);
  if(related.length){
    return [...related]
      .sort((a,b)=>(Number(a?.display_order)||0)-(Number(b?.display_order)||0))
      .map(option=>({
        text:clean(option?.option_text),
        correct:option?.is_correct===true
      }))
      .filter(option=>option.text);
  }

  return array(row?.choices)
    .map(text=>({text:clean(text),correct:false}))
    .filter(option=>option.text);
}

function inferSkill(row,metadata,type){
  const raw=clean(
    metadata.skill??metadata.subject??metadata.category??row?.skill??row?.subject??row?.subject_name
  ).toLowerCase();

  if(type==='listening'||raw.includes('listen'))return QUESTION_SKILLS.LISTENING;
  if(type==='reading'||raw.includes('read'))return QUESTION_SKILLS.READING;
  if(type==='writing'||raw.includes('writ')||raw.includes('sentence making'))return QUESTION_SKILLS.WRITING;
  if(raw.includes('vocab')||raw.includes('word'))return QUESTION_SKILLS.VOCABULARY;
  if(raw.includes('grammar'))return QUESTION_SKILLS.GRAMMAR;
  if(raw.includes('communication')||raw.includes('language'))return QUESTION_SKILLS.LANGUAGE;
  return QUESTION_SKILLS.UNKNOWN;
}

function inferForm(row,metadata,type,skill){
  const explicit=clean(metadata.form??metadata.question_form??row?.question_form).toLowerCase();
  if(Object.values(QUESTION_FORMS).includes(explicit))return explicit;

  if(type==='sentence_unscramble'||type==='sentence_order'||type==='word_order')return QUESTION_FORMS.SENTENCE_ORDER;
  if(type==='written'||type==='text_entry'||type==='sentence_making'||type==='writing')return QUESTION_FORMS.WRITTEN;
  if(type==='listening'||skill===QUESTION_SKILLS.LISTENING)return QUESTION_FORMS.LISTENING_CHOICE;
  if(type==='reading'||skill===QUESTION_SKILLS.READING)return QUESTION_FORMS.READING_CHOICE;
  return QUESTION_FORMS.CHOICE;
}

function normalizeTokens(row,metadata,answer){
  const supplied=array(metadata.tokens).map(clean).filter(Boolean);
  if(supplied.length)return supplied;
  if(clean(row?.item_type)==='sentence_unscramble'&&answer)return answer.split(/\s+/).map(clean).filter(Boolean);
  return [];
}

function validate(question){
  const problems=[];
  if(!question.id)problems.push('missing id');
  if(!question.prompt)problems.push('missing prompt');
  if(!question.level)problems.push('missing/invalid level');

  if([QUESTION_FORMS.CHOICE,QUESTION_FORMS.READING_CHOICE,QUESTION_FORMS.LISTENING_CHOICE].includes(question.form)){
    if(question.choices.length<2)problems.push('choice question has fewer than 2 choices');
    if(!question.answer)problems.push('choice question missing answer');
    if(question.answer&&!question.choices.includes(question.answer))problems.push('answer is not present in choices');
  }

  if(question.form===QUESTION_FORMS.SENTENCE_ORDER){
    if(question.tokens.length<2)problems.push('sentence-order question has fewer than 2 tokens');
    if(!question.answer)problems.push('sentence-order question missing answer');
  }

  if(question.form===QUESTION_FORMS.WRITTEN&&!question.answer&&!question.accepted_answers.length){
    problems.push('written question missing answer/accepted answers');
  }

  if(question.form===QUESTION_FORMS.LISTENING_CHOICE&&!question.transcript&&!question.audio_url){
    problems.push('listening question missing transcript/audio');
  }

  return problems;
}

export function normalizeQuestion(row,{strict=true}={}){
  if(!row||typeof row!=='object')throw new TypeError('normalizeQuestion requires a source row object.');

  const metadata=normalizeMetadata(row);
  const type=clean(row.item_type||row.type||'question_response').toLowerCase();
  const prompt=clean(row.prompt_text??row.prompt??row.q);
  const context=clean(row.context_text??row.context??row.meaning);
  const answer=clean(row.correct_answer??row.answer??row.a);
  const options=normalizedOptions(row);
  const choices=unique(options.map(option=>option.text));
  const level=Math.max(1,Math.min(12,numberOrNull(row.level_id??row.level)??1));
  const difficulty=numberOrNull(row.difficulty_rating??row.difficulty)??level*20;
  const skill=inferSkill(row,metadata,type);
  const form=inferForm(row,metadata,type,skill);
  const acceptedAnswers=unique([
    ...array(metadata.accepted_answers),
    ...array(row.accepted_answers)
  ]);

  const passage=clean(metadata.passage??metadata.reading_passage??row.passage_text??(skill===QUESTION_SKILLS.READING?context:''));
  const transcript=clean(metadata.transcript??row.transcript??(skill===QUESTION_SKILLS.LISTENING?context:''));
  const audioUrl=clean(metadata.audio_url??metadata.audioUrl??row.audio_url);

  const question={
    id:clean(row.source_key??row.id),
    source_id:row.id??null,
    source_key:clean(row.source_key),
    source_table:clean(row.source_table)||'assessment_items',
    source_type:type,
    skill,
    level,
    difficulty,
    form,
    prompt,
    context,
    passage,
    transcript,
    audio_url:audioUrl,
    choices,
    answer,
    accepted_answers:acceptedAnswers,
    tokens:normalizeTokens(row,metadata,answer),
    metadata,
    raw_status:clean(row.status),
    is_flagged:row.is_flagged===true,
    exclude_level_test:metadata.exclude_level_test===true||metadata.exclude_from_level_test===true||String(metadata.exclude_level_test??metadata.exclude_from_level_test).toLowerCase()==='true'
  };

  const problems=validate(question);
  if(strict&&problems.length){
    throw new Error(`Invalid Level Test question ${question.id||'(unknown)'}: ${problems.join('; ')}`);
  }

  return {...question,valid:problems.length===0,problems};
}

export function normalizeQuestionBank(rows,{strict=false}={}){
  const questions=[];
  const rejected=[];
  for(const row of array(rows)){
    try{
      const question=normalizeQuestion(row,{strict});
      if(question.valid)questions.push(question);
      else rejected.push({id:question.id,problems:question.problems,row});
    }catch(error){
      rejected.push({id:clean(row?.source_key??row?.id),problems:[error.message],row});
    }
  }
  return {questions,rejected};
}

export function isEligibleLevelTestQuestion(question){
  return Boolean(
    question?.valid&&
    !question?.is_flagged&&
    !question?.exclude_level_test&&
    (!question?.raw_status||question.raw_status==='published')
  );
}
