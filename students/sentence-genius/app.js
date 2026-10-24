// Sentence Genius composition root. No exam rules, presentation markup, or
// attempt calculations belong here: those are owned by dedicated modules.
import {studentIdentity,assignedBooks,loadUnits,loadSentences} from './content.js';
import {openUnit} from './scoring.js';
import {getSentenceMastery} from './tracking.js';
import {createNavigation} from './navigation.js';
import {createScreens} from './screens.js';
import {createSession} from './session.js';

const state={student:null,books:[],book:null,units:[],unit:null,items:[],store:null,
  loadToken:0,loading:null};
let navigation;
const screens=createScreens({
  book:id=>void openBook(id),
  unit:id=>void selectUnit(id),
  start:mode=>openSession(mode),
  home:()=>navigation.home()
});
const session=createSession({
  onBack:()=>navigation.back(),
  onHome:()=>navigation.home(),
  onProgress:()=>screens.progress(),
  onFinish:()=>screens.progress(),
  onMessage:message=>screens.notice(message)
});
function currentContext(){
  return{book:state.book,unit:state.unit,items:state.items,store:state.store};
}
async function selectUnit(id,{routeUpdate=true}={}){
  const unit=state.units.find(x=>String(x.id)===String(id));
  if(!unit)return;
  const token=++state.loadToken;
  session.dispose();state.unit=unit;state.items=[];state.store=null;
  screens.showBook({newBook:state.book,newUnits:state.units,newUnit:unit,newItems:[],newStore:null});
  screens.notice('단어와 문장을 불러오는 중…');
  try{
    const items=await loadSentences(state.book.id,unit.id);
    if(token!==state.loadToken)return;
    state.items=items;
    state.store=openUnit(state.student.id,unit.id);
    screens.showBook({newBook:state.book,newUnits:state.units,newUnit:unit,newItems:items,newStore:state.store});
    screens.notice(items.length?'':'이 단원에 사용할 수 있는 영어·한국어 문장이 없습니다.');
    try{
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
async function openBook(id,{unitId=null,routeUpdate=true}={}){
  const book=state.books.find(x=>String(x.id)===String(id));
  if(!book)return;
  const token=++state.loadToken;
  session.dispose();
  state.book=book;state.unit=null;state.units=[];state.items=[];state.store=null;
  screens.visible('book');screens.notice('교재 단원을 불러오는 중…');
  try{
    const units=await loadUnits(book.id);
    if(token!==state.loadToken)return;
    state.units=units;
    if(!units.length){
      screens.showBook({newBook:book,newUnits:units,newUnit:null,newItems:[],newStore:null});
      screens.notice('이 교재에 등록된 단원이 없습니다.');return;
    }
    const found=units.find(x=>String(x.id)===String(unitId))||units[0];
    // Unit selection owns the book UI and loads mastery from Supabase.
    await selectUnit(found.id,{routeUpdate:false});
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
    screens.home(state.books);screens.visible('home');return;
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
navigation=createNavigation(applyRoute);
async function boot(){
  screens.visible('home');
  screens.notice('교재를 불러오는 중…');
  try{
    state.student=await studentIdentity();
    if(!state.student.id||!state.student.className)throw Error('Student class is missing');
    state.books=await assignedBooks(state.student.className);
    screens.home(state.books);
    screens.notice(state.books.length?'':'현재 배정된 교재가 없습니다.');
    await navigation.start();
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
