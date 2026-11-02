import {grammarEngine} from './engine.js?v=1';
const DB='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const $=id=>document.getElementById(id),list=$('grammarBookList'),home=$('grammarBooksHome'),detail=$('grammarBookDetail'),back=$('grammarBookBack'),title=$('grammarBookTitle');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modes=[{id:'choose',label:'Choose',ko:'빈칸 선택',icon:'◉'},{id:'check',label:'Sentence Check',ko:'문장 판단',icon:'✓'},{id:'hunt',label:'Error Hunt',ko:'오류 찾기',icon:'⌕'}];
let books=[],catalog=null,activeBook=null,activeMode=null,position=0,checked=false,correct=0,renderer=null;
const questionBank=()=>catalog?.modes||{};
function updateUrl(bookId=''){const p=new URLSearchParams(location.search);bookId?p.set('book',bookId):p.delete('book');const u=location.pathname+(p.size?'?'+p.toString():'');history.pushState({},'',u)}
function bookCard(book){return '<button class="vocab-front-book-card" type="button" data-grammar-book="'+esc(book.id)+'"><span class="vocab-front-card-main"><span class="vocab-front-card-copy"><strong>'+esc(book.title)+'</strong></span></span><span class="vocab-front-arrow" aria-hidden="true">›</span></button>'}
async function loadGrammarBooks(){
 try{
  const response=await fetch(DB+'/rest/v1/content_books?select=id,title,book_number,series_id,metadata&status=eq.published&metadata->>subject=eq.grammar&order=title.asc&limit=100',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
  if(!response.ok)throw Error('Book catalog '+response.status);
  books=await response.json();
  if(!books.some(b=>b.title==='Grammar Ten 완성 2'))books.unshift({id:'grammar-ten-2-practice',title:'Grammar Ten 완성 2'});
  list.innerHTML=books.length?books.map(bookCard).join(''):'<div class="vocab-front-empty">등록된 문법 교재가 없습니다.</div>';
  const id=new URLSearchParams(location.search).get('book');
  const found=books.find(book=>String(book.id)===id);
  if(found)showBook(found,false);
 }catch(error){console.warn('[Grammar books] catalog unavailable',error);books=[{id:'grammar-ten-2-practice',title:'Grammar Ten 완성 2'}];list.innerHTML=books.map(bookCard).join('');}
}
async function loadQuestions(){
 if(catalog)return catalog;
 const response=await fetch('./grammar-ten-2-unit-1.json?v=1',{cache:'no-store'});
 if(!response.ok)throw Error('Practice content unavailable');
 const data=await response.json();
 for(const mode of modes){const qs=data.modes?.[mode.id];if(!Array.isArray(qs)||qs.length!==8||qs.some(q=>q.options?.length!==4||!Number.isInteger(q.answerIndex)||q.answerIndex<0||q.answerIndex>=4))throw Error('Invalid '+mode.id+' questions')}
 catalog=data;return data;
}
function renderModeCards(){
 const mount=$('grammarModeCards');if(!mount)return;
 mount.innerHTML=modes.map((mode,i)=>'<button class="vocab-skill-card '+['vocab-skill-quiz','vocab-skill-spelling','vocab-skill-pronunciation'][i]+'" type="button" data-grammar-mode="'+mode.id+'"><span class="vocab-skill-ring" style="--progress:0"><span>0%</span></span><span class="vocab-skill-copy"><small class="vocab-skill-step">STEP '+(i+1)+'</small><strong>'+mode.label+'</strong><span class="vocab-card-stars">'+mode.ko+' · 8문제</span></span></button>').join('');
}
function showBook(book,push=true){
 if(!book)return;activeBook=book;activeMode=null;
 title.textContent=book.title;home.hidden=true;detail.hidden=false;
 $('grammarModePanel').hidden=false;$('grammarRound').hidden=true;$('grammarResult').hidden=true;$('grammarQuestionBottom').hidden=true;
 const playable=book.title.trim()==='Grammar Ten 완성 2';
 $('grammarUnitTitle').textContent=playable?'CHAPTER 1 · UNIT 01 · be동사의 현재형':'이 교재의 문법 활동은 준비 중이에요.';
 const strip=$('grammarUnitStrip');
 strip.innerHTML=playable?'<button type="button" class="study-v2-unit-pill is-active" aria-current="true">1</button>':'';
 strip.hidden=!playable;
 $('grammarModeCards').hidden=!playable;
 $('grammarNotReady').hidden=playable;
 if(playable)renderModeCards();
 if(push)updateUrl(book.id);
 window.scrollTo(0,0);
}
function showHome(push=true){activeBook=null;activeMode=null;detail.hidden=true;home.hidden=false;$('grammarQuestionBottom').hidden=true;if(push)updateUrl();window.scrollTo(0,0)}
function toSharedQuestion(q){
 return {id:q.id,form:'choice',prompt:q.prompt,choices:q.options,answer:[String(q.answerIndex+1)],context:activeMode==='hunt'?{underlined_spans:q.options}: {},metadata:{sourceKey:q.id,practiceType:'grammar_books'}};
}
function renderQuestion(){
 const questions=questionBank()[activeMode]||[],q=questions[position];
 if(!q)return finishRound();
 const mode=modes.find(m=>m.id===activeMode);
 $('grammarRoundTitle').textContent=mode.label+' · '+mode.ko;
 $('grammarRoundCounter').textContent=(position+1)+' / '+questions.length;
 $('grammarRoundProgress').style.width=(position/questions.length*100)+'%';
 const old=$('grammarSharedQuestionHost');
 const host=old.cloneNode(false);old.replaceWith(host);
 renderer=new grammarEngine.QuestionRenderer(host).render(toSharedQuestion(q),{onChange:(_,has)=>{if(!checked)$('grammarCheck').disabled=!has}});
 $('grammarNext').hidden=true;$('grammarNext').classList.remove('is-next');$('grammarCheck').hidden=false;$('grammarCheck').disabled=true;$('grammarSkip').hidden=false;
 $('grammarQuestionBottom').hidden=false;
 checked=false;
}
function startMode(mode){
 if(!modes.some(x=>x.id===mode)||!activeBook)return;
 const panel=$('grammarModeCards');panel.setAttribute('aria-busy','true');
 loadQuestions().then(()=>{
  activeMode=mode;position=0;correct=0;checked=false;
  $('grammarModePanel').hidden=true;$('grammarResult').hidden=true;$('grammarRound').hidden=false;$('grammarQuestionBottom').hidden=false;
  renderQuestion();window.scrollTo(0,0);
 }).catch(err=>{console.error(err);$('grammarNotReady').textContent='문제를 불러오지 못했어요. 다시 시도해 주세요.';$('grammarNotReady').hidden=false}).finally(()=>panel.removeAttribute('aria-busy'));
}
async function checkAnswer(){
 if(checked||!renderer)return;
 const q=questionBank()[activeMode][position],shared=toSharedQuestion(q),response=renderer.getResponse();
 if(!Array.isArray(response)||!response.length)return;
 const btn=$('grammarCheck');btn.disabled=true;renderer.setDisabled(true);
 let result;
 try{result=await grammarEngine.gradeQuestion(shared,response)}catch(e){console.error('[grammar books] grading failed',e);renderer.setDisabled(false);btn.disabled=false;return}
 checked=true;if(result.correct)correct++;
 renderer.showFeedback(result);
 btn.hidden=true;$('grammarSkip').hidden=true;$('grammarNext').hidden=false;$('grammarNext').classList.add('is-next');
 $('grammarNext').textContent=position===questionBank()[activeMode].length-1?'Finish':'Next Question →';
}
function finishRound(){
 $('grammarRound').hidden=true;$('grammarResult').hidden=false;$('grammarQuestionBottom').hidden=true;
 const total=questionBank()[activeMode].length;
 $('grammarResultScore').textContent=correct+' / '+total;
 $('grammarResultPercent').textContent=Math.round(correct/total*100)+'%';
 $('grammarResultText').textContent='이번 연습 결과예요. 다른 모드에도 도전해 보세요.';
 window.scrollTo(0,0);
}
function goToModes(){
 $('grammarRound').hidden=true;$('grammarResult').hidden=true;$('grammarQuestionBottom').hidden=true;$('grammarModePanel').hidden=false;activeMode=null;window.scrollTo(0,0);
}
list?.addEventListener('click',e=>{const el=e.target.closest('[data-grammar-book]');if(el)showBook(books.find(b=>String(b.id)===el.dataset.grammarBook))});
$('grammarModeCards')?.addEventListener('click',e=>{const el=e.target.closest('[data-grammar-mode]');if(el)startMode(el.dataset.grammarMode)});
$('grammarCheck')?.addEventListener('click',checkAnswer);
$('grammarSkip')?.addEventListener('click',()=>{if(checked||!activeMode)return;position++;renderQuestion()});
$('grammarNext')?.addEventListener('click',()=>{position++;renderQuestion()});
$('grammarRetry')?.addEventListener('click',()=>{if(activeMode)startMode(activeMode)});
$('grammarResultBack')?.addEventListener('click',goToModes);
$('grammarRoundBack')?.addEventListener('click',goToModes);
back?.addEventListener('click',()=>{if(!$('grammarRound').hidden||!$('grammarResult').hidden){goToModes();return}showHome()});
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('book');const book=books.find(b=>String(b.id)===id);book?showBook(book,false):showHome(false)});
document.addEventListener('DOMContentLoaded',()=>{window.WillenaMissionBasket?.mount($('appMissionBasket'),{app:'Grammar Genius Books'});loadGrammarBooks()});
