export const FORMS={choice:'choice',multi:'multi',write:'write',multipart:'multipart',correction:'correction',order:'order',chunks:'chunks',blanks:'blanks',learn:'learn',unsupported:'unsupported'};

export function cleanAnswers(value){
  const a=Array.isArray(value)?value:[value];
  return a.filter(v=>v!=null&&String(v).trim()!=='').map(v=>String(v).trim());
}

export function sourceCode(row){
  const s=String(row?.student_source_label||'').toLowerCase();
  if(s.includes('z reference')||s.includes('zocbo'))return'Z';
  if(s.includes('b reference')||s.includes('book reference'))return'B';
  if(s.includes('willena')||String(row?.content_status||'').toLowerCase()==='willena_published')return'W';
  return'';
}

export function parseCorrection(value){
  const m=String(value||'').trim().match(/^(.+?)\s*→\s*(.+)$/);
  return m?{wrong:m[1].trim(),right:m[2].trim()}:null;
}

export function detectForm(row){
  if(row?.form&&Object.values(FORMS).includes(row.form))return row.form;
  const mode=String(row?.answer_mode||'').toLowerCase();
  const choices=Array.isArray(row?.choices)?row.choices.filter(Boolean):[];
  const answers=cleanAnswers(row?.correct_answer??row?.correct_text);
  if(choices.length)return mode==='multi_select'?FORMS.multi:FORMS.choice;
  if(mode==='text'||row?.correct_text!=null){
    if(answers.length&&answers.every(parseCorrection))return FORMS.correction;
    if(answers.length>1&&row?.metadata?.answer_array_mode!=='alternatives'&&row?.metadata?.answers_are_alternatives!==true)return FORMS.multipart;
    return FORMS.write;
  }
  return FORMS.unsupported;
}

function normalizeChoices(raw){
  return (Array.isArray(raw)?raw:[]).map(x=>typeof x==='string'?x:String(x?.text??x?.label??'').trim()).filter(Boolean);
}

function normalizeCorrect(row,choices,form){
  let answers=cleanAnswers(row?.correct_answer??row?.correct_text);
  if([FORMS.choice,FORMS.multi].includes(form)){
    answers=answers.map(a=>{
      if(/^\d+$/.test(a))return a;
      const i=choices.findIndex(x=>String(x).trim().toLowerCase()===a.toLowerCase());
      return i>=0?String(i+1):a;
    });
  }
  return answers;
}

export function adaptStored(row){
  const choices=normalizeChoices(row?.choices);
  const form=detectForm({...row,choices});
  const answer=normalizeCorrect(row,choices,form);
  const metadata=row?.metadata&&typeof row.metadata==='object'?row.metadata:{};
  return {
    id:String(row?.id||''),
    masteryKey:`stored:${String(row?.id||'')}`,
    bookId:row?.book_id||null,
    unitId:row?.unit_id||null,
    skill:String(row?.section||'').toLowerCase(),
    form,
    source:{
      code:sourceCode(row),
      label:row?.student_source_label||null,
      sourceId:row?.source_id||null,
      sourceQuestionNumber:row?.source_question_number??null,
      page:row?.source_page??null
    },
    prompt:String(row?.prompt_text||''),
    context:row?.context&&typeof row.context==='object'?row.context:{},
    choices,
    answer,
    grading:{
      mode:String(metadata.grading_mode||'exact_normalized'),
      aiAllowed:metadata.ai_allowed===true||metadata.ai_allowed==='true',
      constraints:{
        wordCount:Number(row?.context?.word_count||metadata.hard_word_count||0)||0,
        noContractions:!!(row?.context?.no_contractions||metadata.no_contractions),
        contractionRequired:!!(row?.context?.contraction_required||metadata.contraction_required),
        answerOrderIrrelevant:metadata.answer_order_irrelevant===true,
        alternatives:metadata.answer_array_mode==='alternatives'||metadata.answers_are_alternatives===true
      }
    },
    tracking:{
      practiceType:String(row?.section||'').toLowerCase(),
      questionType:row?.question_type||null,
      targets:Array.isArray(row?.targets)?row.targets:[]
    },
    metadata
  };
}

export function isAuthoredWritten(row){
  const m=row?.metadata&&typeof row.metadata==='object'?row.metadata:{};
  return String(row?.answer_mode||'').toLowerCase()==='text'&&(m.constructed_response_authored===true||m.authored_constructed_response===true);
}
