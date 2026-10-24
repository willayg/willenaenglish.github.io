// All presentation markup is Word Genius's original HTML/CSS.
// This file fills its cards, rings, unit tabs and sentence-list modal.
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
export function createScreens(actions){
  let books=[],units=[],book=null,unit=null,items=[],store=null;
  function visible(screen){
    for(const [id,on] of [['front',screen==='home'],['bookScreen',screen==='book'],['session',screen==='activity']])$(id).hidden=!on;
    if(screen!=='home')notice('');
  }
  function notice(value){$('message').textContent=value||''}
  function home(list){
    books=list||books;
    const root=$('bookList');root.replaceChildren();
    if(!books.length){root.append(el('div','vocab-front-empty','No assigned books found.'));return}
    for(const row of books){
      const b=el('button','vocab-front-book-card');b.type='button';
      const main=el('span','vocab-front-card-main'),copy=el('span','vocab-front-card-copy');
      copy.append(el('strong','',row.title));
      main.append(copy);b.append(main,el('span','vocab-front-arrow','›'));
      b.addEventListener('click',()=>actions.book(row.id));root.append(b);
    }
  }
  function showBook({newBook,newUnits,newUnit,newItems,newStore}){
    book=newBook;units=newUnits;unit=newUnit;items=newItems;store=newStore;
    $('bookName').textContent=book?.title||'Sentence Genius';
    $('unitTitle').textContent=unit?'Unit '+unit.unit_number+(unit.title?' · '+unit.title:''):'Unit';
    $('itemCount').textContent=items.length+' 문장 보기';
    $('itemCountOpen').disabled=!items.length;
    const tabs=$('unitStrip');tabs.replaceChildren();
    for(const u of units){
      const btn=el('button','study-v2-unit'+(u.id===unit?.id?' is-current':''));
      btn.type='button';btn.textContent='Unit '+(u.unit_number||'');
      if(u.id===unit?.id&&store?.gold(items))goldIcon(btn);
      btn.addEventListener('click',()=>actions.unit(u.id));tabs.append(btn);
    }
    progress();
  }
  function goldIcon(button){
    const img=document.createElement('img');img.className='vocab-unit-gold';
    img.src='/shared/svgs/golden-unit.svg?v=20260927-icons1';
    img.alt='Golden Unit';button.append(img);button.classList.add('is-golden');
  }
  function progress(){
    for(const [id,mode] of [['coachCard','coach'],['unscrambleCard','unscramble'],['speakingCard','speaking']]){
      const btn=$(id);btn.disabled=!items.length;
      const percent=store&&items.length?store.percent(mode,items):0;
      btn.querySelector('.vocab-skill-ring')?.style.setProperty('--progress',percent);
      const ring=btn.querySelector('.vocab-skill-ring span');if(ring)ring.textContent=percent+'%';
      if(mode!=='coach')$(mode+'Stars').textContent='★ '+(store?.stars(mode,items)||0)+'/5';
    }
    const gold=!!store?.gold(items);
    $('goldStatus').classList.toggle('is-gold',gold);
    $('goldLabel').textContent=gold?'Golden Unit · 완성!':'Unscramble + Speaking: complete both for Gold';
    const tab=$('unitStrip').querySelector('.is-current');
    if(tab){
      if(gold&&!tab.querySelector('img'))goldIcon(tab);
      if(!gold){tab.querySelector('img')?.remove();tab.classList.remove('is-golden')}
    }
  }
  function sentenceList(){
    if(!items.length)return;
    $('vocabWordModalTitle').textContent='문장 목록';
    $('vocabWordModalMeta').textContent=(book?.title||'')+' · Unit '+(unit?.unit_number||'');
    const list=$('vocabWordModalList');list.replaceChildren();
    for(const item of items){
      const card=el('div','vocab-word-row');
      card.append(el('strong','',item.en),el('span','',item.ko));
      list.append(card);
    }
    $('vocabWordModal').hidden=false;$('vocabWordModal').setAttribute('aria-hidden','false');
  }
  function closeList(){
    $('vocabWordModal').hidden=true;$('vocabWordModal').setAttribute('aria-hidden','true');
  }
  $('itemCountOpen').addEventListener('click',sentenceList);
  $('vocabWordModalClose').addEventListener('click',closeList);
  $('vocabWordModal').addEventListener('click',e=>{if(e.target===$('vocabWordModal'))closeList()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeList()});
  $('coachCard').addEventListener('click',()=>actions.start('coach'));
  $('unscrambleCard').addEventListener('click',()=>actions.start('unscramble'));
  $('speakingCard').addEventListener('click',()=>actions.start('speaking'));
  $('bookBack').addEventListener('click',actions.home);
  return {visible,notice,home,showBook,progress,sentenceList};
}
