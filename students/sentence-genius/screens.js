// All presentation markup is Word Genius's original HTML/CSS.
// This file fills its cards, rings, unit tabs and sentence-list modal.
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
export function createScreens(actions){
  let books=[],units=[],book=null,unit=null,items=[],store=null;
  let goldenUnits=new Set();
  function setGoldenUnits(ids=[]){
    goldenUnits=new Set(ids.map(String));
    for(const button of $('unitStrip').querySelectorAll('[data-unit-id]')){
      const gold=goldenUnits.has(button.dataset.unitId);
      if(gold&&!button.querySelector('.vocab-unit-gold'))goldIcon(button);
      if(!gold){button.querySelector('.vocab-unit-gold')?.remove();button.classList.remove('is-golden')}
    }
  }
  function visible(screen){
    for(const [id,on] of [['front',screen==='home'],['bookScreen',screen==='book'],['session',screen==='activity']])$(id).hidden=!on;
    if(screen!=='home')notice('');
    if(!$('teacherSimulator').dataset.enabled)return;
    $('teacherSimulator').hidden=screen==='activity';
  }
  function notice(value){$('message').textContent=value||''}
  function homework(assignments=[]){
    const section=$('sgAssignedHomework'),root=$('sgAssignedHomeworkList');
    root.replaceChildren();
    section.hidden=!assignments.length||$('teacherSimulator').dataset.enabled==='true';
    if(section.hidden)return;
    for(const a of assignments){
      const button=el('button','sg-assigned-card');button.type='button';
      const copy=el('span','');
      copy.append(el('strong','',a.title||a.book_title||'Sentence Genius'));
      const modes=(a.required_modes||[]).map(x=>({coach:'코치',unscramble:'문장 배열',speaking:'말하기'}[x]||x));
      const done=Math.max(0,Number(a.done)||0),total=Math.max(0,Number(a.total)||0);
      const percent=total?Math.min(100,Math.round(100*done/total)):0;
      const complete=total>0&&done>=total;
      copy.append(el('small','',modes.join(' · ')+' · 제출 '+String(a.due_at||'').slice(0,10)));
      copy.append(el('small','sg-assigned-progress-label',
        (complete?'완료 ✓ · ':'진행 중 · ')+done+'/'+total+' · '+percent+'%'));
      const bar=el('span','sg-assigned-bar');
      const fill=el('i','');fill.style.width=percent+'%';bar.append(fill);copy.append(bar);
      button.classList.toggle('is-complete',complete);
      button.append(copy,el('span','sg-assigned-arrow','›'));
      button.addEventListener('click',()=>actions.homework(a.book_id,a.unit_id));
      root.append(button);
    }
  }
  function home(list){
    books=list||books;
    const root=$('bookList');root.replaceChildren();
    if(!books.length){root.append(el('div','vocab-front-empty',
      $('teacherSimulator').dataset.enabled?'Select a class or book above.':'No assigned books found.'));return}
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
      btn.type='button';btn.dataset.unitId=String(u.id);btn.textContent='Unit '+(u.unit_number||'');
      if(goldenUnits.has(String(u.id))||(u.id===unit?.id&&store?.gold(items)))goldIcon(btn);
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
      $(mode+'Stars').textContent='★ '+(store?.stars(mode,items)||0)+'/5';
    }
    const gold=!!store?.gold(items);
    if(gold&&unit?.id)goldenUnits.add(String(unit.id));
    $('goldStatus').classList.toggle('is-gold',gold);
    $('goldLabel').textContent=gold?'Golden Unit · 완성!':'코치 + 문장 배열 + 말하기: 모두 완료하면 Gold';
    const tab=$('unitStrip').querySelector('.is-current');
    if(tab){
      if(gold&&!tab.querySelector('img'))goldIcon(tab);
      if(!gold&&!goldenUnits.has(String(unit?.id))){tab.querySelector('.vocab-unit-gold')?.remove();tab.classList.remove('is-golden')}
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
      if($('teacherSimulator').dataset.enabled==='true'){
        const grading=item.gradingContext||{};
        const mode=grading.mode==='require_pattern'
          ?'Required: '+(grading.requiredPatternName||'specific pattern')
          :grading.mode==='exact_text'?'Exact textbook wording':'Flexible meaning (default)';
        const grammar=(grading.unitGrammar||[]).join(', ');
        const details=[
          mode,
          (grading.linkedPatterns||[]).length+' pattern links',
          grammar?'Unit grammar: '+grammar:'Unit grammar: not specified',
          'Curriculum alternatives: '+(grading.approvedAlternatives||[]).length
        ];
        card.append(el('small','sg-policy-context',details.join(' · ')));
      }
      list.append(card);
    }
    $('vocabWordModal').hidden=false;$('vocabWordModal').setAttribute('aria-hidden','false');
  }
  function closeList(){
    $('vocabWordModal').hidden=true;$('vocabWordModal').setAttribute('aria-hidden','true');
  }

  const simMode=$('teacherSimMode'),classSelect=$('teacherClassSelect'),bookSelect=$('teacherBookSelect');
  simMode.addEventListener('change',()=>actions.simMode(simMode.value));
  classSelect.addEventListener('change',()=>actions.simClass(classSelect.value));
  bookSelect.addEventListener('change',()=>actions.simBook(bookSelect.value));
  function teacherSetup(classes,catalog){
    const sim=$('teacherSimulator');
    sim.dataset.enabled='true';sim.hidden=false;
    const fill=(select,rows,label)=>{
      select.replaceChildren();
      select.append(new Option(label,''));
      for(const x of rows)select.append(new Option(x.display_name||x.title||x.name,x.id));
    };
    fill(classSelect,classes,'Choose a class…');
    fill(bookSelect,catalog,'Choose a book…');
    teacherMode('class');
  }
  function teacherMode(mode){
    simMode.value=mode;
    $('teacherClassWrap').hidden=mode!=='class';
    $('teacherBookWrap').hidden=mode!=='book';
    $('teacherClassOverview').hidden=true;
    $('teacherSimStatus').textContent=mode==='class'
      ?'Choose a class to preview its textbooks and current homework.'
      :'Choose any textbook. This preview does not save progress.';
  }
  function teacherStatus(message){
    $('teacherSimStatus').textContent=message||'';
  }
  function teacherOverview({name,books:assigned=[],homework=[],homeworkError='' }){
    $('teacherClassOverview').hidden=false;
    $('teacherClassHeading').textContent=(name||'Class')+' · Assigned textbooks';
    const booksRoot=$('teacherClassBooks'),hwRoot=$('teacherHomeworkList');
    booksRoot.replaceChildren();hwRoot.replaceChildren();
    if(!assigned.length)booksRoot.append(el('div','sg-sim-empty','No textbooks assigned to this class.'));
    for(const book of assigned){
      const btn=el('button','sg-sim-entry');btn.type='button';
      const main=el('span','');
      main.append(el('strong','',book.title||'Book'));
      const part=book.currentUnit?'Current unit: '+book.currentUnit:
        book.startingUnit?'Starting unit: '+book.startingUnit:'Assigned textbook';
      main.append(el('small','',part));
      btn.append(main,el('span','sg-sim-arrow','›'));
      btn.addEventListener('click',()=>actions.simOpenBook(book.id,book.unitId||null));
      booksRoot.append(btn);
    }
    if(homeworkError)hwRoot.append(el('div','sg-sim-empty',homeworkError));
    else if(!homework.length)hwRoot.append(el('div','sg-sim-empty','No active homework for this class.'));
    for(const task of homework){
      const available=!!task.bookId&&assigned.some(b=>b.id===task.bookId);
      const node=el(available?'button':'div','sg-sim-entry');
      if(available){node.type='button';node.addEventListener('click',()=>actions.simOpenBook(task.bookId,task.unitId||null))}
      const main=el('span','');
      main.append(el('strong','',task.title));
      const due=task.dueAt?'Due '+new Date(task.dueAt).toLocaleDateString('ko-KR'):'Current assignment';
      main.append(el('small','',due+(available?' · Open textbook':' · Preview details only')));
      node.append(main);
      if(available)node.append(el('span','sg-sim-arrow','›'));
      hwRoot.append(node);
    }
  }

  $('itemCountOpen').addEventListener('click',sentenceList);
  $('vocabWordModalClose').addEventListener('click',closeList);
  $('vocabWordModal').addEventListener('click',e=>{if(e.target===$('vocabWordModal'))closeList()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeList()});
  $('coachCard').addEventListener('click',()=>actions.start('coach'));
  $('unscrambleCard').addEventListener('click',()=>actions.start('unscramble'));
  $('speakingCard').addEventListener('click',()=>actions.start('speaking'));
  $('bookBack').addEventListener('click',actions.home);
  return {visible,notice,home,homework,showBook,progress,setGoldenUnits,sentenceList,
    teacherSetup,teacherMode,teacherStatus,teacherOverview};
}
