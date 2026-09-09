import {applyQuestionGradingPolicy} from '../shared/question-grading-policy.js?v=2.0.0';

export const FORMS={choice:'choice',multi:'multi',write:'write',multipart:'multipart',correction:'correction',identifiedCorrection:'identified_correction',order:'order',chunks:'chunks',blanks:'blanks',learn:'learn',unsupported:'unsupported'};

export function cleanAnswers(value){
  const a=Array.isArray(value)?value:[value];
  return a.filter(v=>v!=null&&String(v).trim()!=='').map(v=>String(v).trim());
}

export function sourceCode(row){
  const s=String(row?.student_source_label||'').toLowerCase();
  if(s.includes('z reference')||s.includes('zocbo'))return'Z';
  if(s.includes('b reference')||s.includes('book reference')||s.includes('서술형'))return'B';
  if(s.includes('willena')||String(row?.content_status||'').toLowerCase()==='willena_published')return'W';
  return'';
}

export function parseCorrection(value){
  const raw=String(value||'').trim(),m=raw.match(/^(.+?)\s*→\s*(.+)$/);
  if(!m)return null;
  let left=m[1].trim(),right=m[2].trim(),prefix='',label='';
  const pm=left.match(/^([①-⑳ⓐ-ⓩ]|\d+\s*:?)\s*(.+)$/u);
  if(pm&&pm[2]){prefix=pm[1].trim();left=pm[2].trim();label=prefix.replace(/:$/,'')}
  return{raw,wrong:left,right,prefix,label};
}

function blankCount(value){
  if(value==null)return 0;
  if(typeof value==='string')return (value.match(/_{2,}/g)||[]).length;
  if(Array.isArray(value))return value.reduce((n,x)=>n+blankCount(x),0);
  if(typeof value==='object')return Object.values(value).reduce((n,x)=>n+blankCount(x),0);
  return 0;
}
function expandedAnswers(row){
  const answers=cleanAnswers(row?.correct_answer??row?.correct_text);
  if(answers.length!==1||!answers[0].includes(' / '))return{answers,packed:false};
  const parts=answers[0].split(/\s+\/\s+/).map(x=>x.trim()).filter(Boolean),blanks=blankCount(row?.context||{});
  if(parts.length>1&&blanks===parts.length)return{answers:parts,packed:true};
  return{answers,packed:false};
}
function alternativeMode(row){const m=row?.metadata&&typeof row.metadata==='object'?row.metadata:{};return m.answer_array_mode==='alternatives'||m.answers_are_alternatives===true||m.answers_are_alternatives==='true'}

export function detectForm(row){
  if(row?.form&&Object.values(FORMS).includes(row.form))return row.form;
  const mode=String(row?.answer_mode||'').toLowerCase();
  const choices=Array.isArray(row?.choices)?row.choices.filter(Boolean):[];
  const answers=expandedAnswers(row).answers;
  if(choices.length)return mode==='multi_select'?FORMS.multi:FORMS.choice;
  if(mode==='text'||row?.correct_text!=null){
    const parsed=answers.map(parseCorrection);
    if(answers.length&&parsed.every(Boolean)){
      if(parsed.some(x=>x.prefix))return FORMS.identifiedCorrection;
      return FORMS.correction;
    }
    if(answers.length>1&&!alternativeMode(row))return FORMS.multipart;
    return FORMS.write;
  }
  return FORMS.unsupported;
}

function normalizeChoices(raw){
  return (Array.isArray(raw)?raw:[]).map(x=>typeof x==='string'?x:String(x?.text??x?.label??'').trim()).filter(Boolean);
}

function normalizeCorrect(row,choices,form){
  let answers=expandedAnswers(row).answers;
  if([FORMS.choice,FORMS.multi].includes(form)){
    answers=answers.map(a=>{
      if(/^\d+$/.test(a))return a;
      const i=choices.findIndex(x=>String(x).trim().toLowerCase()===a.toLowerCase());
      return i>=0?String(i+1):a;
    });
  }
  return answers;
}

const KOREAN_NUMBERS={한:1,하나:1,두:2,둘:2,세:3,셋:3,네:4,넷:4,다섯:5,여섯:6,일곱:7,여덟:8,아홉:9,열:10,'열한':11,'열두':12};
function countToken(raw){const s=String(raw||'').trim();return /^\d+$/.test(s)?Number(s):(KOREAN_NUMBERS[s]||0)}
function wordCountIn(text){
  const s=String(text||'');if(!s||/번째/.test(s))return 0;
  const m=s.match(/(?:총\s*)?(\d+|열두|열한|하나|한|둘|두|셋|세|넷|네|다섯|여섯|일곱|여덟|아홉|열)\s*단어/u);
  return m?countToken(m[1]):0;
}
function conditionStrings(context){
  const raw=context?.conditions;
  if(Array.isArray(raw))return raw.map(x=>String(x||'')).filter(Boolean);
  return raw?String(raw).split(/\n+/).map(x=>x.trim()).filter(Boolean):[];
}
function inferGlobalWordCount(row,answerCount){
  const m=row?.metadata&&typeof row.metadata==='object'?row.metadata:{},c=row?.context&&typeof row.context==='object'?row.context:{};
  const explicit=Number(c.word_count||m.hard_word_count||0)||0;if(explicit)return explicit;
  if(answerCount>1)return 0;
  return wordCountIn(row?.prompt_text)||conditionStrings(c).map(wordCountIn).find(Boolean)||0;
}
function markerIndex(text){
  const s=String(text||'');
  const circ=['ⓐ','ⓑ','ⓒ','ⓓ','ⓔ','ⓕ','ⓖ','ⓗ'];for(let i=0;i<circ.length;i++)if(s.includes(circ[i]))return i;
  const m=s.match(/(?:^|\s|\()([1-8])(?:\)|번|\s)/);return m?Number(m[1])-1:-1;
}
function inferPartWordCounts(row,answerCount){
  if(answerCount<=1)return[];
  const conditions=conditionStrings(row?.context||{}),counts=Array(answerCount).fill(0);
  for(const text of conditions){
    const n=wordCountIn(text);if(!n)continue;
    if(/각각/.test(text)){counts.fill(n);continue}
    const i=markerIndex(text);if(i>=0&&i<counts.length)counts[i]=n;
  }
  if(counts.every(Boolean))return counts;
  if(conditions.length===answerCount){
    const byLine=conditions.map(wordCountIn);if(byLine.every(Boolean))return byLine;
  }
  return counts.some(Boolean)?counts:[];
}
function conditionFlag(row,kind){
  const m=row?.metadata&&typeof row.metadata==='object'?row.metadata:{},c=row?.context&&typeof row.context==='object'?row.context:{},texts=[row?.prompt_text,...conditionStrings(c)].join(' ');
  if(kind==='noContractions')return !!(c.no_contractions||m.no_contractions||(/축약형/.test(texts)&&/(사용하지|쓰지|금지)/.test(texts)));
  if(kind==='contractionRequired')return !!(c.contraction_required||m.contraction_required||(/축약형/.test(texts)&&!/(사용하지|쓰지|금지)/.test(texts)&&/(사용|쓸|써)/.test(texts)));
  return false;
}
function answerLanguage(answers){
  const text=(answers||[]).join(' '),ko=/[가-힣]/.test(text),en=/[A-Za-z]/.test(text);
  if(ko&&!en)return'ko';if(en&&!ko)return'en';if(!ko&&!en)return'symbol';return'mixed';
}

export function adaptStored(row){
  const choices=normalizeChoices(row?.choices);
  const form=detectForm({...row,choices});
  const answer=normalizeCorrect(row,choices,form);
  const metadata=row?.metadata&&typeof row.metadata==='object'?row.metadata:{};
  const id=String(row?.id||'');
  const partWordCounts=inferPartWordCounts(row,answer.length),wordCount=inferGlobalWordCount(row,answer.length);
  const question={
    id,
    masteryKey:String(row?.masteryKey||metadata.mastery_key||`stored:${id}`),
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
    chips:(Array.isArray(row?.chips)?row.chips:[]).map(x=>String(x)),
    answer,
    input:{
      language:answerLanguage(answer),
      partCount:[FORMS.multipart,FORMS.correction,FORMS.identifiedCorrection].includes(form)?answer.length:1,
      multiline:form===FORMS.write
    },
    grading:{
      constraints:{
        wordCount,
        partWordCounts,
        noContractions:conditionFlag(row,'noContractions'),
        contractionRequired:conditionFlag(row,'contractionRequired'),
        answerOrderIrrelevant:metadata.answer_order_irrelevant===true,
        alternatives:alternativeMode(row)
      }
    },
    tracking:{
      practiceType:String(row?.section||'').toLowerCase(),
      questionType:row?.question_type||null,
      targets:Array.isArray(row?.targets)?row.targets:[]
    },
    metadata
  };
  return applyQuestionGradingPolicy(question);
}

export function isAuthoredWritten(row){
  const m=row?.metadata&&typeof row.metadata==='object'?row.metadata:{};
  const authored=m.constructed_response_authored===true||m.constructed_response_authored==='true'||m.authored_constructed_response===true||m.authored_constructed_response==='true';
  return String(row?.answer_mode||'').toLowerCase()==='text'&&authored;
}
