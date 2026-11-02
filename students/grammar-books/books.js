const DB='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const list=document.getElementById('grammarBookList');
const home=document.getElementById('grammarBooksHome');
const detail=document.getElementById('grammarBookDetail');
const back=document.getElementById('grammarBookBack');
const title=document.getElementById('grammarBookTitle');
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\"':'&quot;',"'":'&#39;'}[c]));
let books=[];
async function loadGrammarBooks(){
 try{
  const url=DB+'/rest/v1/content_books?select=id,title,book_number,series_id,metadata&status=eq.published&metadata->>subject=eq.grammar&order=title.asc&limit=100';
  const response=await fetch(url,{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
  if(!response.ok)throw Error('Book catalog '+response.status);
  books=await response.json();
  list.innerHTML=books.length?books.map(book=>'<button class="vocab-front-book-card" type="button" data-grammar-book="'+escapeHtml(book.id)+'"><span class="vocab-front-card-main"><span class="vocab-front-card-copy"><strong>'+escapeHtml(book.title)+'</strong></span></span><span class="vocab-front-arrow" aria-hidden="true">›</span></button>').join(''):'<div class="vocab-front-empty">등록된 문법 교재가 없습니다.</div>';
 }catch(error){console.warn('[Grammar books] catalog unavailable',error);list.innerHTML='<div class="vocab-front-empty">교재를 불러오지 못했어요. <button type="button" id="grammarBooksRetry">다시 시도</button></div>';document.getElementById('grammarBooksRetry')?.addEventListener('click',loadGrammarBooks)}
}
function showBook(book){if(!book)return;title.textContent=book.title;home.hidden=true;detail.hidden=false;history.pushState({grammarBook:book.id},'',location.pathname+'?book='+encodeURIComponent(book.id));window.scrollTo(0,0)}
list.addEventListener('click',event=>{const b=event.target.closest('[data-grammar-book]');if(b)showBook(books.find(book=>String(book.id)===b.dataset.grammarBook))});
function showHome(update=true){detail.hidden=true;home.hidden=false;if(update)history.pushState({},'',location.pathname);window.scrollTo(0,0)}
back.addEventListener('click',()=>showHome());
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('book');const book=books.find(b=>String(b.id)===id);if(book){title.textContent=book.title;home.hidden=true;detail.hidden=false}else showHome(false)});
document.addEventListener('DOMContentLoaded',()=>{const mount=document.getElementById('appMissionBasket');window.WillenaMissionBasket?.mount(mount,{app:'Grammar Genius Books'});loadGrammarBooks().then(()=>{const id=new URLSearchParams(location.search).get('book');const b=books.find(x=>String(x.id)===id);if(b){title.textContent=b.title;home.hidden=true;detail.hidden=false}})});
