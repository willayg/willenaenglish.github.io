import {loadTeacherBookCatalog,loadUnits,loadSentences} from '/students/sentence-genius/content.js?v=sg-no-approval-v4.1';
import {matchSentence} from '/students/sentence-genius/speech.js?v=sg-no-approval-v4.1';
import {gradeUnfamiliarSentence,usableAlternatives} from '/students/sentence-genius/ai-grading.js?v=sg-phase3b';
import {grammarClueFor} from '/students/sentence-genius/grammar-clues.js?v=sg-clues-v1b';
const by=id=>document.getElementById(id);
let books=[],units=[],sentences=[];
let bookRequest=0,unitRequest=0,gradingBusy=false;
const state={book:null,unit:null};
function option(rows,placeholder,label){return '<option value="">'+placeholder+'</option>'+rows.map(r=>'<option value="'+String(r.id).replace(/"/g,'&quot;')+'">'+label(r).replace(/</g,'&lt;')+'</option>').join('')}
async function request(url,body){const f=window.WillenaAPI?.fetch?.bind(window.WillenaAPI)||fetch;const r=await f(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const x=await r.json().catch(()=>({}));if(!r.ok||!x.success)throw Error(x.error||'Request failed ('+r.status+')');return x}
function notice(text){by('sgtStatus').textContent=text}
async function selectBook(id){const generation=++bookRequest;++unitRequest;state.book=books.find(x=>x.id===id)||null;units=[];sentences=[];by('sgtSentence').innerHTML='<option value="">Select a sentence</option>';by('sgtUnit').innerHTML='<option value="">Loading units…</option>';if(!id)return;
  units=await loadUnits(id);if(generation!==bookRequest)return;by('sgtUnit').innerHTML=option(units,'Select a unit',u=>'Unit '+u.unit_number+(u.title?' · '+u.title:''));notice(units.length+' units available')}
async function selectUnit(id){const generation=++unitRequest;state.unit=units.find(x=>x.id===id)||null;sentences=[];by('sgtSentence').innerHTML='<option value="">Loading sentences…</option>';if(!id)return;
  sentences=await loadSentences(state.book.id,id,state.unit);if(generation!==unitRequest)return;by('sgtSentence').innerHTML=option(sentences,'Select a sentence',s=>s.en);notice(sentences.length+' textbook sentences');}
async function grading(){if(gradingBusy)return;const sentence=sentences.find(s=>s.id===by('sgtSentence').value),answer=by('sgtAnswer').value.trim();if(!sentence||!answer)return notice('Select a sentence and enter an answer.');
  const clue=grammarClueFor(sentence);const result=matchSentence(sentence.en,[answer],sentence.gradingContext);
  const node=by('sgtVerdict');node.textContent='Checking…';gradingBusy=true;by('sgtGrade').disabled=true;
  let judged=result;
  try{if(!result.correct&&!result.almostRight){const useful=usableAlternatives([answer],sentence.en);if(!useful.length)judged={unusable:true};else judged=await gradeUnfamiliarSentence(sentence,answer,{subjectClue:clue});}}finally{gradingBusy=false;by('sgtGrade').disabled=false;}
  node.textContent=judged.unusable?'Unclear transcript · no penalty':judged.unavailable?'AI unavailable · no score':judged.correct?'Correct · 4 points':judged.almostRight?'Almost Right · 2 points':'Incorrect · retry';
  node.textContent+=' · '+(judged.matchedBy||judged.reasonCode||'AI Willi');
  if(judged.explanationKo)node.textContent+=' · '+judged.explanationKo;
  if(clue)node.textContent+=' · Student clue: '+clue.word;
}
async function boot(){
 by('sgtLoad').addEventListener('click',()=>void populate());
 by('sgtBook').addEventListener('change',e=>void selectBook(e.target.value).catch(err=>notice(err.message)));
 by('sgtUnit').addEventListener('change',e=>void selectUnit(e.target.value).catch(err=>notice(err.message)));
 by('sgtGrade').addEventListener('click',()=>void grading().catch(err=>notice('Grade error: '+err.message)));
 await populate();
}
async function populate(){notice('Loading textbook catalog…');books=await loadTeacherBookCatalog();by('sgtBook').innerHTML=option(books,'Select a textbook',b=>b.title);notice(books.length+' textbooks loaded.')}
boot().catch(err=>notice('Sentence Genius setup failed: '+err.message));
