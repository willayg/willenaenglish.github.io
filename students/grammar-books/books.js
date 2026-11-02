import {grammarEngine} from './engine.js?v=1';
const DB='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const $=id=>document.getElementById(id),list=$('grammarBookList'),home=$('grammarBooksHome'),detail=$('grammarBookDetail'),back=$('grammarBookBack'),title=$('grammarBookTitle');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modes=[{id:'choose',label:'Choose',ko:'빈칸 선택',icon:'◉'},{id:'check',label:'Sentence Check',ko:'문장 판단',icon:'✓'},{id:'hunt',label:'Error Hunt',ko:'오류 찾기',icon:'⌕'}];
let books=[],catalog=null,activeBook=null,activeMode=null,position=0,selected=-1,checked=false,correct=0;
const questionBank=()=>catalog?.modes||{};
function updateUrl(bookId=''){const p=new URLSearchParams(location.search);bookId?p.set('book',bookId):p.delete('book');const u=location.pathname+(p.size?'?'+p.toString():'');history.pushState({},'',u)}
function bookCard(book){return '<button class="vocab-front-book-card" type="button" data-grammar-book="'+esc(book.id)+'"><span class="vocab-front-card-main"><span class="vocab-front-card-copy"><strong>'+esc(book.title)+'</strong></span></span><span class="vocab-front-arrow" aria-hidden="true">›</span></button>'}
async function loadGrammarBooks(){
 try{
  const response=await fetch(DB+'/rest/v1/content_books?select=id,title,book_number,series_id,metadata&status=eq.published&metadata->>subject=eq.grammar&order=title.asc&limit=100',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
  if(!response.ok)throw Error('Book catalog '+response.status);
  books=await response.json();
  list.innerHTML=books.length?books.map(bookCard).join(''):'<div class="vocab-front-empty">등록된 문법 교재가 없습니다.</div>';
  const id=new URLSearchParams(location.search).get('book');
  const found=books.find(book=>String(book.id)===id);
  if(found)showBook(found,false);
 }catch(error){console.warn('[Grammar books] catalog unavailable',error);list.innerHTML='<div class="vocab-front-empty">교재를 불러오지 못했어요. <button type="button" id="grammarBooksRetry">다시 시도</button></div>';$('grammarBooksRetry')?.addEventListener('click',loadGrammarBooks)}
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
 mount.innerHTML=modes.map(mode=>'<button class="grammar-mode-card" type="button" data-grammar-mode="'+mode.id+'"><span class="grammar-mode-icon" aria-hidden="true">'+mode.icon+'</span><span class="grammar-mode-copy"><strong>'+mode.label+'</strong><small>'+mode.ko+' · 8문제</small></span><span class="vocab-front-arrow" aria-hidden="true">›</span></button>').join('');
}
function showBook(book,push=true){
 if(!book)return;activeBook=book;activeMode=null;
 title.textContent=book.title;home.hidden=true;detail.hidden=false;
 $('grammarModePanel').hidden=false;$('grammarRound').hidden=true;$('grammarResult').hidden=true;
 const playable=book.title.trim()==='Grammar Ten 완성 2';
 $('grammarUnitTitle').textContent=playable?'CHAPTER 1 · UNIT 01 · be동사의 현재형':'이 교재의 문법 활동은 준비 중이에요.';
 $('grammarModeCards').hidden=!playable;
 $('grammarNotReady').hidden=playable;
 if(playable)renderModeCards();
 if(push)updateUrl(book.id);
 window.scrollTo(0,0);
}
function showHome(push=true){activeBook=null;activeMode=null;detail.hidden=true;home.hidden=false;if(push)updateUrl();window.scrollTo(0,0)}
function renderQuestion(){
 const questions=questionBank()[activeMode]||[],q=questions[position];
 if(!q)return finishRound();
 const mode=modes.find(m=>m.id===activeMode);
 $('grammarRoundTitle').textContent=mode.label+' · '+mode.ko;
 $('grammarRoundCounter').textContent=(position+1)+' / '+questions.length;
 $('grammarRoundProgress').style.width=((position)/questions.length*100)+'%';
 $('grammarQuestionPrompt').textContent=q.prompt;
 $('grammarAnswerChoices').innerHTML=q.options.map((option,i)=>'<button class="grammar-answer-choice" type="button" data-option="'+i+'"><span class="grammar-answer-letter">'+String.fromCharCode(65+i)+'</span><span class="grammar-choice-text">'+esc(option)+'</span></button>').join('');
 $('grammarFeedback').hidden=true;$('grammarFeedback').textContent='';
 $('grammarNext').hidden=true;$('grammarCheck').hidden=false;$('grammarCheck').disabled=true;
 selected=-1;checked=false;
}
function startMode(mode){
 if(!modes.some(x=>x.id===mode)||!activeBook)return;
 const panel=$('grammarModeCards');panel.setAttribute('aria-busy','true');
 loadQuestions().then(()=>{
  activeMode=mode;position=0;correct=0;selected=-1;checked=false;
  $('grammarModePanel').hidden=true;$('grammarResult').hidden=true;$('grammarRound').hidden=false;
  renderQuestion();window.scrollTo(0,0);
 }).catch(err=>{console.error(err);$('grammarNotReady').textContent='문제를 불러오지 못했어요. 다시 시도해 주세요.';$('grammarNotReady').hidden=false}).finally(()=>panel.removeAttribute('aria-busy'));
}
function chooseOption(i){
 if(checked)return;selected=i;
 $('grammarAnswerChoices').querySelectorAll('[data-option]').forEach(el=>{const on=Number(el.dataset.option)===i;el.classList.toggle('selected',on);el.setAttribute('aria-pressed',String(on))});
 $('grammarCheck').disabled=false;
}
function checkAnswer(){
 if(checked||selected<0)return;
 checked=true;const q=questionBank()[activeMode][position],isCorrect=selected===q.answerIndex;
 if(isCorrect)correct++;
 $('grammarAnswerChoices').querySelectorAll('[data-option]').forEach(el=>{
  const i=Number(el.dataset.option);el.disabled=true;
  el.classList.toggle('correct',i===q.answerIndex);
  el.classList.toggle('incorrect',i===selected&&!isCorrect);
 });
 const fb=$('grammarFeedback');fb.hidden=false;fb.className='grammar-feedback '+(isCorrect?'correct':'incorrect');fb.textContent=(isCorrect?'정답! ':'다시 확인해 봐요. ')+q.explanation;
 $('grammarCheck').hidden=true;$('grammarNext').hidden=false;
 $('grammarNext').textContent=position===questionBank()[activeMode].length-1?'결과 보기':'다음 문제';
}
function finishRound(){
 $('grammarRound').hidden=true;$('grammarResult').hidden=false;
 const total=questionBank()[activeMode].length;
 $('grammarResultScore').textContent=correct+' / '+total;
 $('grammarResultPercent').textContent=Math.round(correct/total*100)+'%';
 $('grammarResultText').textContent='이번 연습 결과예요. 다른 모드에도 도전해 보세요.';
 window.scrollTo(0,0);
}
function goToModes(){
 $('grammarRound').hidden=true;$('grammarResult').hidden=true;$('grammarModePanel').hidden=false;activeMode=null;window.scrollTo(0,0);
}
list?.addEventListener('click',e=>{const el=e.target.closest('[data-grammar-book]');if(el)showBook(books.find(b=>String(b.id)===el.dataset.grammarBook))});
$('grammarModeCards')?.addEventListener('click',e=>{const el=e.target.closest('[data-grammar-mode]');if(el)startMode(el.dataset.grammarMode)});
$('grammarAnswerChoices')?.addEventListener('click',e=>{const el=e.target.closest('[data-option]');if(el)chooseOption(Number(el.dataset.option))});
$('grammarCheck')?.addEventListener('click',checkAnswer);
$('grammarNext')?.addEventListener('click',()=>{position++;renderQuestion()});
$('grammarRetry')?.addEventListener('click',()=>{if(activeMode)startMode(activeMode)});
$('grammarResultBack')?.addEventListener('click',goToModes);
$('grammarRoundBack')?.addEventListener('click',goToModes);
back?.addEventListener('click',()=>{if(!$('grammarRound').hidden||!$('grammarResult').hidden){goToModes();return}showHome()});
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('book');const book=books.find(b=>String(b.id)===id);book?showBook(book,false):showHome(false)});
document.addEventListener('DOMContentLoaded',()=>{window.WillenaMissionBasket?.mount($('appMissionBasket'),{app:'Grammar Genius Books'});loadGrammarBooks()});
