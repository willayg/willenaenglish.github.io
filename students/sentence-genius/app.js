// Sentence Genius composition root. No exam rules, presentation markup, or
// attempt calculations belong here: those are owned by dedicated modules.
import {studentIdentity,signedInProfile,assignedBooks,loadUnits,loadSentences,
  loadTeacherClasses,loadTeacherBookCatalog,loadTeacherClassHomework} from './content.js?v=sg-no-approval-v4.1';
import {openUnit} from './scoring.js?v=sg-coach-gold-v3';
import {getSentenceMastery} from './tracking.js';
import {createNavigation} from './navigation.js';
import {createScreens} from './screens.js?v=sg-homework-progress-v5b';
import {createSession} from './session.js?v=sg-homework-progress-v5c';
import {loadSentenceHomework} from './homework.js?v=sg-homework-unified-v6';

const state={student:null,books:[],book:null,units:[],unit:null,items:[],store:null,
  loadToken:0,loading:null,teacher:false,homework:[],simMode:'class',simClasses:[],simCatalog:[],
  simClass:null,simToken:0};
let navigation;
let homeworkRefresh=0;
let goldBookRefresh=0;
let achievementsRefresh=0;
async function refreshHomeAchievements(){
 if(state.teacher||!state.student?.id)return;
 const token=++achievementsRefresh;
 const root=document.getElementById('frontAchievements');
 try{
  const response=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch('/.netlify/functions/progress_summary?section=vocab_motivation&_='+Date.now()):fetch('/.netlify/functions/progress_summary?section=vocab_motivation&_='+Date.now(),{credentials:'include'}));
  if(response.ok){
   const d=await response.json();
   if(token!==achievementsRefresh)return;
   document.getElementById('vocabFrontStreakCurrent').textContent=String(Math.max(0,Number(d.current_streak)||0));
   document.getElementById('vocabFrontStreakBest').textContent=String(Math.max(0,Number(d.best_streak)||0));
  }
 }catch(e){console.warn('[Sentence Genius] streak status unavailable',e)}
 if(root)root.hidden=false;
 let gold=0,queue=[];
 try{
  for(const book of state.books){
   if(token!==achievementsRefresh)return;
   const units=await loadUnits(book.id);
   for(const unit of units)queue.push({book,unit});
  }
  let cursor=0;
  async function worker(){
   while(cursor<queue.length&&token===achievementsRefresh){
    const {book,unit}=queue[cursor++];
    try{
     const [items,rows]=await Promise.all([loadSentences(book.id,unit.id,unit),getSentenceMastery(book.id,unit.id)]);
     if(token!==achievementsRefresh)return;
     const mastery=openUnit(state.student.id,unit.id);mastery.hydrateServer(rows);
     if(items.length&&mastery.gold(items)){gold++;document.getElementById('frontGoldenCount').textContent=String(gold)}
    }catch(e){console.warn('[Sentence Genius] gold count unit unavailable',unit.id,e)}
   }
  }
  await Promise.all(Array.from({length:Math.min(3,queue.length)},()=>worker()));
 }catch(e){console.warn('[Sentence Genius] gold count unavailable',e)}
}

async function refreshStudentHomework(){
  if(state.teacher||!state.student?.id)return;
  const current=++homeworkRefresh;
  try{
    const assignments=await loadSentenceHomework();
    if(current!==homeworkRefresh)return;
    state.homework=assignments;
    screens.homework(assignments);
  }catch(error){console.warn('[Sentence Genius] homework refresh unavailable',error)}
}
const screens=createScreens({
  book:id=>void openBook(id),
  homework:(bookId,unitId)=>void openBook(bookId,{unitId}),
  unit:id=>void selectUnit(id),
  start:mode=>openSession(mode),
  home:()=>navigation.home(),
  simMode:mode=>void changeSimulationMode(mode),
  simClass:id=>void simulateClass(id),
  simBook:id=>void simulateBook(id),
  simOpenBook:(id,unit)=>void openBook(id,{unitId:unit})
});
const session=createSession({
  onBack:()=>navigation.back(),
  onHome:()=>navigation.home(),
  onProgress:()=>screens.progress(),
  onFinish:()=>{screens.progress();void refreshStudentHomework()},
  onMessage:message=>screens.notice(message)
});
function currentContext(){
  return{book:state.book,unit:state.unit,items:state.items,store:state.store,
    preview:state.teacher};
}
async function selectUnit(id,{routeUpdate=true}={}){
  const unit=state.units.find(x=>String(x.id)===String(id));
  if(!unit)return;
  const token=++state.loadToken;
  session.dispose();state.unit=unit;state.items=[];state.store=null;
  screens.showBook({newBook:state.book,newUnits:state.units,newUnit:unit,newItems:[],newStore:null});
  screens.notice('교재 문장을 불러오는 중…');
  try{
    const items=await loadSentences(state.book.id,unit.id,unit);
    if(token!==state.loadToken)return;
    state.items=items;
    state.store=openUnit(state.student.id,unit.id,{preview:state.teacher});
    screens.showBook({newBook:state.book,newUnits:state.units,newUnit:unit,newItems:items,newStore:state.store});
    screens.notice(items.length?'':'이 단원에 사용할 수 있는 영어·한국어 문장이 없습니다.');
    if(!state.teacher)try{
      const rows=await getSentenceMastery(state.book.id,unit.id);
      if(token!==state.loadToken)return;
      state.store.hydrateServer(rows);
      screens.progress();
    }catch(error){console.warn('[Sentence Genius] mastery reload unavailable',error)}
    if(routeUpdate)navigation.replace({screen:'book',bookId:state.book.id,unitId:unit.id});
  }catch(error){
    if(token!==state.loadToken)return;
    console.warn('[Sentence Genius] unit load failed',error);
    screens.notice('문장을 불러올 수 없습니다. 다시 선택해 주세요.');
  }
}

// Check every unit's saved mastery, not only the selected unit.
// Keep all other unit buttons visible while the checks complete.
async function refreshGoldenUnitButtons(book,units,token){
  if(state.teacher||!state.student?.id||!units.length)return;
  const earned=new Set();
  let next=0;
  async function worker(){
    while(next<units.length){
      const u=units[next++];
      try{
        const [sentences,rows]=await Promise.all([
          loadSentences(book.id,u.id,u),
          getSentenceMastery(book.id,u.id)
        ]);
        if(token!==goldBookRefresh||state.book?.id!==book.id)return;
        const mastery=openUnit(state.student.id,u.id);
        mastery.hydrateServer(rows);
        if(mastery.gold(sentences))earned.add(String(u.id));
        // Refresh progressively to avoid waiting for the slowest unit.
        screens.setGoldenUnits([...earned]);
      }catch(error){
        console.warn('[Sentence Genius] unit gold status unavailable',u.unit_number,error);
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(3,units.length)},()=>worker()));
}

async function openBook(id,{unitId=null,routeUpdate=true}={}){
  const book=state.books.find(x=>String(x.id)===String(id));
  if(!book)return;
  const token=++state.loadToken;
  session.dispose();
  ++goldBookRefresh;
  state.book=book;state.unit=null;state.units=[];state.items=[];state.store=null;
  screens.setGoldenUnits([]);
  screens.visible('book');screens.notice('교재 단원을 불러오는 중…');
  try{
    const units=await loadUnits(book.id);
    if(token!==state.loadToken)return;
    state.units=units;
    if(!units.length){
      screens.showBook({newBook:book,newUnits:units,newUnit:null,newItems:[],newStore:null});
      screens.notice('이 교재에 등록된 단원이 없습니다.');return;
    }
    const found=units.find(x=>String(x.id)===String(unitId)||
      String(x.unit_number)===String(unitId))||units[0];
    // Unit selection owns the book UI and loads mastery from Supabase.
    await selectUnit(found.id,{routeUpdate:false});
    if(token!==state.loadToken&&state.book?.id!==book.id)return;
    const goldToken=++goldBookRefresh;
    void refreshGoldenUnitButtons(book,units,goldToken);
    if(routeUpdate)navigation.push({screen:'book',bookId:book.id,unitId:found.id});
  }catch(error){
    if(token!==state.loadToken)return;
    console.error('[Sentence Genius] book load failed',error);
    screens.notice('교재를 불러올 수 없습니다. 다른 교재를 선택해 주세요.');
  }
}
function openSession(mode,{routeUpdate=true}={}){
  if(!state.book||!state.unit||!state.store||!state.items.length)return;
  const started=session.start(mode,currentContext());
  if(!started)return;
  screens.visible('activity');
  if(routeUpdate)navigation.push({
    screen:'activity',bookId:state.book.id,unitId:state.unit.id,mode
  });
}
async function applyRoute(route){
  if(route.screen==='home'){
    session.dispose();
    screens.home(state.books);screens.homework(state.homework);screens.visible('home');return;
  }
  if(!state.books.length){screens.visible('home');return}
  if(state.book?.id!==route.bookId){
    await openBook(route.bookId,{unitId:route.unitId,routeUpdate:false});
  }else if(route.unitId&&state.unit?.id!==route.unitId){
    await selectUnit(route.unitId,{routeUpdate:false});
  }
  if(route.screen==='book'){
    session.dispose();
    if(state.book&&state.unit)screens.showBook({
      newBook:state.book,newUnits:state.units,newUnit:state.unit,newItems:state.items,newStore:state.store
    });
    screens.visible('book');return;
  }
  if(route.screen==='activity'&&state.items.length){
    openSession(route.mode,{routeUpdate:false});
  }
}

// A teacher can preview textbook content, not impersonate a real student.
// No chosen class or student ID is sent to the attempt/progress recorders.
function resetSimulation(){
  ++state.simToken;++state.loadToken;
  session.dispose();state.book=null;state.unit=null;state.units=[];state.items=[];state.store=null;
  state.books=[];state.simClass=null;
}
function changeSimulationMode(mode){
  if(!state.teacher)return;
  if(mode!=='class'&&mode!=='book')return;
  state.simMode=mode;resetSimulation();
  screens.teacherMode(mode);
  screens.home([]);navigation.home();
}
function simulateClass(id){
  if(!state.teacher||state.simMode!=='class')return;
  const chosen=state.simClasses.find(row=>String(row.id)===String(id));
  const token=++state.simToken;
  ++state.loadToken;session.dispose();
  state.book=null;state.unit=null;state.units=[];state.items=[];state.store=null;
  state.simClass=chosen||null;
  state.books=(chosen?.books||[]).filter(row=>row.book_id).map(row=>({
    id:String(row.book_id),title:row.book_title||'Book',
    unitId:row.current_unit||row.starting_unit||null,
    currentUnit:row.current_unit||null,startingUnit:row.starting_unit||null
  }));
  screens.home(state.books);navigation.home();
  if(!chosen){
    screens.teacherMode('class');screens.teacherStatus('Choose a class to see its books and homework.');
    return;
  }
  const name=chosen.display_name||chosen.name;
  screens.teacherStatus('Simulating '+name+' · no student data will be saved.');
  screens.teacherOverview({name,books:state.books});
  // Real class homework, not the teacher's own assignments or guessed unit data.
  void loadTeacherClassHomework(chosen.name).then(homework=>{
    if(token!==state.simToken||state.simClass?.id!==chosen.id)return;
    screens.teacherOverview({name,books:state.books,homework});
  }).catch(error=>{
    if(token!==state.simToken)return;
    screens.teacherOverview({name,books:state.books,
      homeworkError:'Could not load homework: '+error.message});
  });
}
function simulateBook(id){
  if(!state.teacher||state.simMode!=='book')return;
  ++state.simToken;
  const selected=state.simCatalog.find(row=>String(row.id)===String(id));
  state.books=selected?[selected]:[];
  state.simClass=null;
  session.dispose();screens.home(state.books);
  if(!selected){
    ++state.loadToken;state.book=null;state.unit=null;state.items=[];state.store=null;
    navigation.home();screens.teacherStatus('Select any textbook to preview.');
    return;
  }
  screens.teacherStatus('Previewing '+selected.title+' · progress and rewards are disabled.');
  void openBook(selected.id);
}

navigation=createNavigation(applyRoute);
async function boot(){
  screens.visible('home');
  screens.notice('교재를 불러오는 중…');
  try{
    state.student=await studentIdentity();
    if(!state.student.id)throw Error('Student login is required');
    const profile=await signedInProfile(state.student.id);
    state.teacher=profile.approved&&['teacher','admin'].includes(profile.role);
    if(!state.teacher&&profile.className.toLowerCase()==='teacher'){
      // Staff users must never fall through into a fake "Teacher" student class.
      throw Error('Staff login detected, but teacher/admin role verification failed. Please sign in again.');
    }
    if(state.teacher){
      // Load teacher-only class catalog. The class RPC checks the signed-in
      // JWT's role server-side; students cannot call it.
      let classError='';
      try{state.simClasses=await loadTeacherClasses()}
      catch(error){classError=error.message;console.warn('[Sentence Genius] teacher classes',error)}
      try{state.simCatalog=await loadTeacherBookCatalog()}
      catch(error){console.warn('[Sentence Genius] textbook catalog',error);
        if(!classError)classError='Textbook catalog: '+error.message}
      screens.teacherSetup(state.simClasses,state.simCatalog);
      screens.teacherStatus(classError?'Could not load all preview options: '+classError:
        'Select a class to inspect its books and homework, or switch to any textbook.');
      screens.home([]);
      screens.notice('');
      await navigation.start();
      return;
    }
    if(!state.student.className)state.student.className=profile.className;
    if(!state.student.className)throw Error('Student class is missing');
    const [bookResult,homeworkResult]=await Promise.allSettled([
      assignedBooks(state.student.className),loadSentenceHomework()
    ]);
    const base=bookResult.status==='fulfilled'?bookResult.value:[];
    state.homework=homeworkResult.status==='fulfilled'?homeworkResult.value:[];
    if(bookResult.status==='rejected')console.warn('[Sentence Genius] regular books unavailable',bookResult.reason);
    if(homeworkResult.status==='rejected')console.warn('[Sentence Genius] homework list unavailable',homeworkResult.reason);
    const books=new Map(base.map(b=>[String(b.id),b]));
    for(const a of state.homework)if(!books.has(String(a.book_id))){
      books.set(String(a.book_id),{id:String(a.book_id),title:a.book_title||'Sentence Genius'});
    }
    state.books=[...books.values()];
    screens.home(state.books);
    screens.homework(state.homework);
    void refreshHomeAchievements();
    screens.notice(state.books.length?'':'현재 배정된 교재가 없습니다.');
    await navigation.start();
    // A homework mission may deep-link to an assigned book and unit. Verify
    // the book belongs to this student's real assignment before opening.
    const params=new URLSearchParams(location.search);
    const homeworkBook=params.get('book'),homeworkUnit=params.get('unit');
    if(homeworkBook&&homeworkUnit&&state.books.some(b=>String(b.id)===homeworkBook)){
      await openBook(homeworkBook,{unitId:homeworkUnit});
    }
  }catch(error){
    console.warn('[Sentence Genius] startup failed',error);
    if(/session|expired|401|auth|unauthor/i.test(String(error.message))){
      location.replace('/students/signin.html?next='+encodeURIComponent('/students/sentence-genius/'));
      return;
    }
    screens.notice('교재를 불러올 수 없습니다: '+error.message);
  }
}
void boot();
