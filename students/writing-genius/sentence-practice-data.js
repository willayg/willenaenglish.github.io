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
const expansion=/^(.+?)\s+(with|at|in|on|after|before|because|during|every)\s+(.+)[.!?]$/i;
function expandCards(items){
 const results=[];
 for(const item of items){
  const m=item.en.match(expansion);if(!m)continue;
  const stem=m[1],extra=m[3],prep=m[2].toLowerCase();
  if(wc(stem)<4||wc(extra)<2||/\b(?:is|are|am|was|were|to|of|the|a|an|will|can|have|has|had)$/.test(stem.toLowerCase()))continue;
  const prompt=prep==='because'?'왜 그런지 이유를 더해 보세요.':
   prep==='with'?'누구와 또는 무엇과 함께인지 더해 보세요.':
   prep==='during'||prep==='after'||prep==='before'||prep==='every'?'언제인지 더해 보세요.':
   '언제, 어디서, 무엇을 하는지 자세히 덧붙여 보세요.';
  results.push({...base(item),kind:'expand',prompt,display:stem+'.',detail:'원래 문장을 더 길고 자세하게 만들어 보세요.',
   model:item.en,hint:'예문에서 추가된 정보: '+prep+' …',help:'추가할 정보는 자유롭게 골라도 좋아요. 예문과 달라도 괜찮아요.'});
 }
 return results;
}
const answerRules=[
 [/^I like (.+)[.!]$/i,'What do you like?'],
 [/^I can (.+)[.!]$/i,'What can you do?'],
 [/^I want (.+)[.!]$/i,'What do you want?'],
 [/^My favorite (\w+(?:\s\w+)?) is (.+)[.!]$/i,match=>'What is your favorite '+match[1]+'?'],
 [/^I live in (.+)[.!]$/i,'Where do you live?'],
 [/^I went to (.+)[.!]$/i,'Where did you go?'],
 [/^I am (?:very )?(happy|sad|tired|hungry|excited|angry)[.!]$/i,'How do you feel?']
];
function answerCards(items){
 const rows=[];
 for(const item of items){
  const found=answerRules.map(([re,q])=>{const m=item.en.match(re);return m?typeof q==='function'?q(m):q:null}).find(Boolean);
  if(!found)continue;
  rows.push({...base(item),kind:'answer',prompt:'영어 질문에 완전한 문장으로 답해 보세요.',
   display:found,detail:'나의 생각을 영어로 써 보세요.',model:item.en,
   hint:'예시에서 사용할 수 있는 표현: '+sentence(item.en).split(' ').slice(0,2).join(' ')+' …',
   help:'이 예시는 교재의 한 가지 답이에요. 내 답이 다르더라도 괜찮아요.'});
 }
 return rows;
}
const commonStarts=['I can ','I like ','I have ','I want ','She is ','He is ','They are ','We are ','I am ','It is ','I was ','We can ','They can '];
function connectCards(items){
 const results=[],seen=new Set();
 const byUnit=new Map();
 for(const item of items){
  if(!byUnit.has(item.unitId))byUnit.set(item.unitId,[]);
  byUnit.get(item.unitId).push(item);
 }
 for(const group of byUnit.values()){
  for(const first of group){
   if(wc(first.en)<3||wc(first.en)>10||!/[.]$/.test(first.en))continue;
   const prefix=commonStarts.find(x=>first.en.startsWith(x));
   if(!prefix)continue;
   for(const second of group){
    if(second.id===first.id||!second.en.startsWith(prefix)||!/[.]$/.test(second.en)||wc(second.en)>10)continue;
    const tail=sentence(second.en).slice(prefix.length).trim();
    const front=sentence(first.en);
    if(!tail||tail.toLowerCase()===front.slice(prefix.length).toLowerCase())continue;
    const key=[first.id,second.id].sort().join('|');if(seen.has(key))continue;seen.add(key);
    const output=front+' and '+tail+'.';
    if(wc(output)>20)continue;
    results.push({...base(first),sourceIds:[first.id,second.id],kind:'connect',
     prompt:'두 생각을 and로 연결해 한 문장으로 만들어 보세요.',
     display:first.en+'\n'+second.en,detail:'반복되는 말을 줄여 더 자연스럽게 쓸 수 있어요.',
     model:output,hint:'연결어: and',help:'두 문장 모두 같은 주어로 시작해요. 교재 예문의 단어들을 이어 보세요.'});
   }
  }
 }
 return results;
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
