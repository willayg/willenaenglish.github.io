// Writing Genius sentence exercises sourced from the student's assigned books.
// Source examples are authentic bilingual textbook records; generated questions
// and connectors are scaffolds, never presented as literal textbook quotations.
import {contentDbGet} from '/students/shared/content-db.js?v=1.0.0';
import {assignedBooks,loadUnits} from '/students/sentence-genius/content.js?v=20261024-wg-auth1';

const usable='in.(published,review)';
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const sentence=s=>clean(s).replace(/[.!?]+$/,'').trim();
const wc=s=>(s.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)||[]).length;
const randomize=items=>{
 const out=[...items];
 for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
 return out;
};
function eligible(record){
 const en=clean(record.canonical_text||record.text),ko=clean(record.translation_ko);
 if(!en||!ko||wc(en)<3||wc(en)>19||en.length>140||ko.length>175)return false;
 if(!/[.!?]$/.test(en)||/[.!?][\s\S]*[A-Za-z]/.test(en.replace(/[.!?]$/,'')))return false;
 if(/^[\"'“”‘’—–\-]|^because\b/i.test(en))return false;
 return true;
}
export async function getAssignedPracticeBooks(className){
 const books=await assignedBooks(className);
 return books.filter(b=>b?.id).map(b=>({id:b.id,title:clean(b.title)||'Textbook'}));
}
export async function getPracticeUnits(bookId){
 const units=await loadUnits(bookId);
 return units.map(u=>({id:u.id,title:clean(u.title)||'Unit '+u.unit_number,number:u.unit_number}))
   .sort((a,b)=>Number(a.number)-Number(b.number));
}
const chunks=(xs,size=55)=>Array.from({length:Math.ceil(xs.length/size)},(_,i)=>xs.slice(i*size,(i+1)*size));
export async function getTextbookSentences(bookId,unitId='',units=[]){
 // An explicit unit is respected. All units allows enough material for the
 // open-ended writing types, without mixing in an unrelated textbook.
 const qs='?select=sentence_id,unit_id,book_id&book_id=eq.'+encodeURIComponent(bookId)+
  '&sentence_id=not.is.null&status='+usable+(unitId?'&unit_id=eq.'+encodeURIComponent(unitId):'')+
  '&limit=900';
 const occurrences=await contentDbGet('/rest/v1/source_content_occurrences'+qs);
 if(!Array.isArray(occurrences)||!occurrences.length)return [];
 const idSet=new Set(),items=[];
 for(const row of occurrences){
  if(!row.sentence_id||idSet.has(row.sentence_id))continue;
  idSet.add(row.sentence_id);
  items.push(row);
 }
 const pages=await Promise.all(chunks(items.map(x=>x.sentence_id)).map(ids=>
  contentDbGet('/rest/v1/sentences?select=id,canonical_text,text,translation_ko,status'+
   '&status='+usable+'&id=in.'+encodeURIComponent('('+ids.join(',')+')'))));
 const byId=new Map(pages.flat().filter(eligible).map(row=>[row.id,row]));
 const unitNames=new Map(units.map(u=>[u.id,u.title]));
 return items.flatMap(row=>{
  const ref=byId.get(row.sentence_id);
  if(!ref)return [];
  return [{id:ref.id,unitId:row.unit_id,unitName:unitNames.get(row.unit_id)||'Unit',
   en:clean(ref.canonical_text||ref.text),ko:clean(ref.translation_ko)}];
 });
}
function base(item){return{sourceIds:[item.id],sourceUnitId:item.unitId,unitName:item.unitName}}
function makeCards(items){
 return items.map(item=>({...base(item),kind:'make',prompt:'한국어를 읽고 영어 문장을 만들어 보세요.',
  display:item.ko,detail:'자신의 표현으로 써도 좋아요.',model:item.en,
  hint:'핵심 단어 · '+sentence(item.en).split(' ').filter(w=>w.length>=4).slice(0,3).join(' / '),
  help:'한국어 뜻을 표현해 보세요. 교재 예문은 여러 가능한 표현 중 하나예요.'}));
}
// A source-backed prompt can be open-ended. Samples generated from source
// sentences are labelled as examples, not verbatim quotations.
const declarative=item=>!/[?]$/.test(item.en)&&!/^\s*(yes|no|okay|ok|hi|hello|thanks|thank you)\b/i.test(item.en)
 &&!/^\s*(please|let's|let us|don't)\b/i.test(item.en) && wc(item.en)>=4;
const fullStop=str=>sentence(str).replace(/\s+$/,'')+'.';
const bareEnglish=eng=>sentence(eng).replace(/^([a-z])/,x=>x.toLowerCase());
const phrase=/^(.+?)\s+(with|at|in|on|after|before|because|during|every|next to|in front of)\s+(.+)[.!]$/i;
const extensionRules=[
 {re:/^I (can|could)\s+[a-z]+.*[.!]$/i,extra:'after school',hint:'when · 언제'},
 {re:/^I (like|love|enjoy)\b.+[.!]$/i,extra:'very much',hint:'how much · 얼마나'},
 {re:/^(?:She|He|They|We|I)\s+(?:is|are|am|was|were|\x27s|\x27re)\b.*[.!]$/i,extra:'today',hint:'when · 언제'},
 {re:/^(?:She|He|They|We|I)\s+\w+s\b.+[.!]$/i,extra:'every day',hint:'when · 언제'}
];
function expandCards(items){
 const result=[];
 for(const item of items){
  if(!declarative(item)||wc(item.en)>15)continue;
  const m=item.en.match(phrase);
  if(m&&wc(m[1])>=2&&wc(m[3])>=1&&!/^(?:what|where|when|who|why|how|is|are|do|does|did|can|could|will|would|was|were)\b/i.test(m[1])){
   result.push({...base(item),kind:'expand',
    prompt:'짧은 문장에 더 자세한 정보를 넣어 보세요.',
    display:fullStop(m[1]),detail:'언제, 어디서, 누구와, 왜를 추가해 보세요.',
    model:item.en,hint:'교재 속 표현: '+m[2]+' …',
    help:'원래 교재 예문에는 '+m[2]+' 뒤에 설명이 더 있어요. 내 정보를 넣어도 좋아요.'});
  }else{
   const rule=extensionRules.find(x=>x.re.test(item.en));
   if(!rule)continue;
   const model=fullStop(sentence(item.en)+' '+rule.extra);
   result.push({...base(item),kind:'expand',prompt:'문장에 새로운 정보를 더해 보세요.',
    display:item.en,detail:'시간, 장소, 사람, 이유를 추가해 더 긴 문장으로 써 보세요.',
    model,hint:rule.hint,help:'이 예시는 교재 문장에 정보를 새로 더해 만든 문장이에요. 내 아이디어를 써도 좋아요.'});
  }
 }
 return result;
}
const answerRules=[
 [/^I like (.+)[.!]$/i,'What do you like?'],
 [/^I can (.+)[.!]$/i,'What can you do?'],
 [/^I want (.+)[.!]$/i,'What do you want?'],
 [/^My favorite (\w+(?:\s\w+)?) is (.+)[.!]$/i,m=>'What is your favorite '+m[1]+'?'],
 [/^I (?:live|am living) in (.+)[.!]$/i,'Where do you live?'],
 [/^I went to (.+)[.!]$/i,'Where did you go?'],
 [/^I am (?:very )?(happy|sad|tired|hungry|excited|angry)[.!]$/i,'How do you feel?'],
 [/^(?:She|He|They|I|We) (?:is|are|am|was|were|\x27s|\x27re) in (.+)[.!]$/i,'Where is this person?'],
 [/^(?:She|He|They|I|We) (?:is|are|am|was|were|\x27s|\x27re) at (.+)[.!]$/i,'Where is this person?'],
 [/^She (?:likes|loves|wants) (.+)[.!]$/i,'What does she like or want?'],
 [/^He (?:likes|loves|wants) (.+)[.!]$/i,'What does he like or want?'],
 [/^They (?:like|love|want) (.+)[.!]$/i,'What do they like or want?'],
 [/^(?:She|He|They|We) (?:is|are|am|was|were|\x27s|\x27re) going to (.+)[.!]$/i,'Where are they going?'],
 [/^I have (.+)[.!]$/i,'What do you have?'],
 [/^He has (.+)[.!]$/i,'What does he have?'],
 [/^She has (.+)[.!]$/i,'What does she have?']
];
function answerCards(items){
 const result=[];
 for(const item of items){
  if(!declarative(item)||wc(item.en)>14)continue;
  const found=answerRules.map(([re,q])=>{const m=item.en.match(re);return m?(typeof q==='function'?q(m):q):null}).find(Boolean);
  const question=found||
   (/^I\b/i.test(item.en)?'What would you like to tell us about yourself?':
    /^(?:He|She)\b/i.test(item.en)?'What can you tell us about this person?':
    /^(?:We|They)\b/i.test(item.en)?'What can you tell us about this group?':
    /^There (?:is|are)\b/i.test(item.en)?'What is in this place?':
    /^It\b/i.test(item.en)?'What can you tell us about it?':null);
  if(!question)continue;
  result.push({...base(item),kind:'answer',
   prompt:'영어 질문에 완전한 문장으로 답해 보세요.',display:question,
   detail:'나의 생각을 영어로 써 보세요.',model:item.en,
   hint:'교재 표현: '+sentence(item.en).split(' ').slice(0,2).join(' ')+' …',
   help:'예문은 한 가지 답이에요. 질문에 맞는 내 답을 자유롭게 써 보세요.'});
 }
 return result;
}
const pronounOf=s=>{
 const m=s.match(/^(I|you|he|she|we|they|it|there|my\s+[a-z]+)\b/i);
 return m?.[1]?.toLowerCase()||'';
};
function connectCards(items){
 const result=[],seen=new Set();
 const groups=new Map();
 for(const item of items){
  if(!declarative(item)||wc(item.en)>11||!/\.$/.test(item.en))continue;
  const key=pronounOf(item.en);
  if(!key)continue;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(item);
 }
 for(const group of groups.values()){
  for(const a of group){
   const neighbors=group.filter(b=>b.id!==a.id &&
    (b.unitId===a.unitId||group.length<6) && wc(b.en)<=11);
   for(const b of neighbors){
    const key=[a.id,b.id].sort().join('|');if(seen.has(key))continue;
    seen.add(key);
    const second=bareEnglish(b.en);
    const negative=/\b(?:not|don't|doesn't|isn't|aren't|can't|won't)\b/i;
    const connector=negative.test(a.en)!==negative.test(b.en)?'but':'and';
    const model=sentence(a.en)+', '+connector+' '+second+'.';
    if(wc(model)>22)continue;
    result.push({...base(a),kind:'connect',sourceIds:[a.id,b.id],
     unitName:a.unitName===b.unitName?a.unitName:'My textbook',
     prompt:'두 문장을 연결어로 한 문장으로 만들어 보세요.',
     display:a.en+'\n'+b.en,
     detail:'and 또는 but을 사용해 보세요.',
     model,hint:'and (그리고) / but (하지만)',
     help:'교재 문장 두 개를 연결해 만든 예시예요. 연결어를 바꾸거나 다른 자연스러운 표현을 써도 좋아요.'});
   }
  }
 }
 return result;
}
export const EXERCISE_LABELS={make:'문장 만들기',expand:'문장 늘리기',answer:'질문에 답하기',connect:'생각 연결하기'};
export function generatePracticeQuestions(kind,items){
 const pool=({make:makeCards,expand:expandCards,answer:answerCards,connect:connectCards}[kind]);
 if(!pool)throw Error('Unknown exercise type');
 const cards=randomize(pool(items));
 // Retain distinct prompts. In Connect Ideas, a source pair is unique.
 const used=new Set(),result=[];
 for(const card of cards){
  const key=card.kind+'|'+card.display;
  if(used.has(key))continue;used.add(key);
  result.push(card);
  if(result.length===5)break;
 }
 return result.length===5?result:[];
}
