(function(global){
'use strict';

var MIN_SET=6;
var TARGET_SET=10;
var busy=false;
var unitCache={};
var levelCache={};
var KO={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
var EN={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function skillName(s){return (isKo()?KO:EN)[s]||s|| (isKo()?'영어':'English');}
function userId(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function shuffle(items){var a=items.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function unique(items){var seen={},out=[];items.forEach(function(x){var id=text(x&&x.id||x&&x.sourceId);if(!id||seen[id])return;seen[id]=1;out.push(x);});return out;}

function currentContext(){
  var id=userId(),cache=null;
  try{cache=JSON.parse(localStorage.getItem('willena-study-v2-home:v1:'+id)||'null');}catch(_){}
  var books=cache&&arr(cache.books)||[],wanted=cache&&cache.activeBookId;
  var book=books.find(function(b){return String(b.book_id)===String(wanted);})||books[0]||null;
  if(!book)return null;
  var unit=book.currentUnit||arr(book.units)[0]||null;
  if(!unit)return null;
  var publicLevel=Number(book.public_level||book.publicLevel)||null;
  if(!publicLevel&&Number(book.internal_level_id)>2)publicLevel=Number(book.internal_level_id)-2;
  return{book:book,bookId:String(book.book_id),bookTitle:text(book.book_title||book.title),unit:unit,unitId:String(unit.id),unitNumber:Number(unit.unit_number)||1,publicLevel:publicLevel};
}

function masteryRows(){
  return Array.prototype.slice.call(document.querySelectorAll('#masteryGrid [data-skill]')).map(function(card){
    var raw=text(card.querySelector('.header-skill-master-pct')&&card.querySelector('.header-skill-master-pct').textContent);
    return{skill:text(card.dataset.skill),pct:Number(raw.replace(/[^0-9.]/g,''))||0};
  }).filter(function(x){return x.skill;});
}
function candidates(){var c=global.WillenaStudyV2Coach;return c&&typeof c.getCandidates==='function'?arr(c.getCandidates()):[];}
function currentCandidates(ctx){return candidates().filter(function(c){return c&&String(c.bookId)===ctx.bookId&&String(c.unitId)===ctx.unitId;});}
function average(rows){if(!rows.length)return 0;return Math.round(rows.reduce(function(s,x){return s+x.pct;},0)/rows.length);}
function skillPct(rows,skill){var r=rows.find(function(x){return x.skill===skill;});return r?r.pct:50;}
function strongestSkill(rows){return rows.slice().sort(function(a,b){return b.pct-a.pct;})[0]||null;}

function bankApi(){return global.WillenaStudyQuestionBank;}
async function unitBank(ctx){
  var key=ctx.bookId+'|'+ctx.unitId;
  if(unitCache[key])return unitCache[key];
  var api=bankApi();if(!api||typeof api.loadUnit!=='function')return[];
  unitCache[key]=api.loadUnit(ctx.publicLevel,{bookId:ctx.bookId,unitId:ctx.unitId,bookTitle:ctx.bookTitle,unitNumber:ctx.unitNumber}).then(function(x){return unique(arr(x));}).catch(function(){return[];});
  return unitCache[key];
}
async function levelBank(ctx){
  var key=ctx.bookId+'|'+String(ctx.publicLevel||'');
  if(levelCache[key])return levelCache[key];
  var api=bankApi();if(!api||typeof api.loadLevel!=='function'||!ctx.publicLevel)return[];
  levelCache[key]=api.loadLevel(ctx.publicLevel,{bookId:ctx.bookId,unitId:ctx.unitId,bookTitle:ctx.bookTitle,unitNumber:ctx.unitNumber}).then(function(x){return unique(arr(x));}).catch(function(){return[];});
  return levelCache[key];
}

function recentKey(ctx){return'willena-ai-coach-recent:v1:'+userId()+':'+ctx.unitId;}
function recentIds(ctx){try{return arr(JSON.parse(localStorage.getItem(recentKey(ctx))||'[]'));}catch(_){return[];}}
function remember(ctx,items){
  try{
    var ids=items.map(function(x){return text(x.id||x.sourceId);}).filter(Boolean).concat(recentIds(ctx));
    localStorage.setItem(recentKey(ctx),JSON.stringify(Array.from(new Set(ids)).slice(0,60)));
  }catch(_){}
}
function chooseFresh(ctx,items,n){
  var recent=recentIds(ctx),fresh=shuffle(items.filter(function(x){return recent.indexOf(text(x.id||x.sourceId))<0;})),old=shuffle(items.filter(function(x){return recent.indexOf(text(x.id||x.sourceId))>=0;}));
  return unique(fresh.concat(old)).slice(0,n||TARGET_SET);
}
function sameUnit(ctx,item){var m=item&&item.metadata||{};return String(m.book_id||'')===ctx.bookId&&String(m.unit_id||'')===ctx.unitId;}
function skillItems(items,skill){return items.filter(function(x){return x&&x.skill===skill;});}

async function poolForSkill(ctx,skill){
  var unit=skillItems(await unitBank(ctx),skill),level=skillItems(await levelBank(ctx),skill).filter(function(x){return!sameUnit(ctx,x);});
  return unique(unit.concat(level));
}
async function canBuildSkill(ctx,skill){return (await poolForSkill(ctx,skill)).length>=MIN_SET;}

function balancedSet(ctx,items,rows,target){
  target=target||TARGET_SET;
  var groups={},skills=[];
  items.forEach(function(x){if(!x||!x.skill)return;if(!groups[x.skill]){groups[x.skill]=[];skills.push(x.skill);}groups[x.skill].push(x);});
  skills.sort(function(a,b){return skillPct(rows,a)-skillPct(rows,b);});
  Object.keys(groups).forEach(function(k){groups[k]=shuffle(groups[k]);});
  var out=[],counts={},round=0;
  while(out.length<target&&round<target*4){
    var added=false;
    skills.forEach(function(s,idx){
      if(out.length>=target||!groups[s].length)return;
      var cap=idx===0?5:(idx===1?4:3);
      if((counts[s]||0)>=cap)return;
      out.push(groups[s].shift());counts[s]=(counts[s]||0)+1;added=true;
    });
    if(!added)break;round++;
  }
  if(out.length<target){
    var rest=[];Object.keys(groups).forEach(function(k){rest=rest.concat(groups[k]);});
    out=unique(out.concat(shuffle(rest))).slice(0,target);
  }
  return chooseFresh(ctx,out,target);
}

function weakTarget(ctx,rows,cs){
  var c=cs.filter(function(x){return x.type==='weak';}).sort(function(a,b){return (b.lapses||0)-(a.lapses||0)||(a.mastery||0)-(b.mastery||0);})[0];
  if(c)return{skill:c.skill,pct:Number(c.mastery)||0,lapses:Number(c.lapses)||0,due:Number(c.due)||0};
  var r=rows.slice().sort(function(a,b){return a.pct-b.pct;})[0];
  return r?{skill:r.skill,pct:r.pct,lapses:0,due:0}:null;
}

async function promptOptions(){
  var ctx=currentContext();if(!ctx)return[];
  var rows=masteryRows(),cs=currentCandidates(ctx),unit=await unitBank(ctx),level=await levelBank(ctx);
  var history=rows.some(function(r){return r.pct>0;})||cs.some(function(c){return (c.attempts||0)+(c.unique||0)>0;});
  var weak=weakTarget(ctx,rows,cs),avg=average(rows),opts=[];
  function add(id,labelKo,labelEn,skill){if(opts.length<4&&!opts.some(function(x){return x.id===id;}))opts.push({id:id,label:isKo()?labelKo:labelEn,skill:skill||null});}

  add('unit','이 단원에서 뭘 공부하면 좋을까요?','What should I study in this unit?');

  if(!history){
    if(unit.length>=MIN_SET)add('practice_unit','이 단원을 연습해 볼래요','Practice this unit');
    return opts;
  }

  if(weak&&await canBuildSkill(ctx,weak.skill)){
    add('skill:'+weak.skill,skillName(weak.skill)+'을 더 연습하고 싶어요','I want more '+skillName(weak.skill)+' practice',weak.skill);
  }

  var mistake=cs.filter(function(c){return Number(c.lapses)>0;}).sort(function(a,b){return Number(b.lapses)-Number(a.lapses);})[0];
  if(mistake&&await canBuildSkill(ctx,mistake.skill))add('mistakes','틀린 문제를 다시 도와줘','Help me with my mistakes',mistake.skill);

  var due=cs.filter(function(c){return Number(c.due)>0;}).sort(function(a,b){return Number(b.due)-Number(a.due);})[0];
  if(due&&await canBuildSkill(ctx,due.skill))add('review','잊기 전에 복습할래요','Review before I forget',due.skill);

  var majorWeak=rows.some(function(r){return r.pct>0&&r.pct<65;});
  var strong=strongestSkill(rows);
  if(opts.length<4&&avg>=78&&!majorWeak&&strong){
    var challengePool=skillItems(level,strong.skill).filter(function(x){return!sameUnit(ctx,x);});
    if(challengePool.length>=MIN_SET)add('challenge','조금 더 어렵게 해볼래요','Challenge me',strong.skill);
  }
  if(opts.length<4&&avg>=82&&!majorWeak){
    var outside=level.filter(function(x){return!sameUnit(ctx,x);});
    if(outside.length>=MIN_SET)add('new','새로운 걸 해볼래요','Give me something new');
  }

  if(opts.length<3&&weak&&['grammar','vocabulary'].indexOf(weak.skill)>=0){
    var similar=skillItems(level,weak.skill).filter(function(x){return!sameUnit(ctx,x);});
    if(similar.length>=MIN_SET)add('more','비슷한 문제 더 줘','Give me more like this',weak.skill);
  }
  return opts.slice(0,4);
}

async function makeUnitPlan(ctx,rows){
  var unit=await unitBank(ctx),level=await levelBank(ctx);
  var relevantSkills=Array.from(new Set(unit.map(function(x){return x.skill;}).filter(Boolean)));
  var supplement=level.filter(function(x){return!sameUnit(ctx,x)&&relevantSkills.indexOf(x.skill)>=0;});
  var pool=unique(unit.concat(supplement));
  if(pool.length<MIN_SET)return noSet();
  var set=balancedSet(ctx,pool,rows,TARGET_SET);if(set.length<MIN_SET)return noSet();remember(ctx,set);
  var weak=weakTarget(ctx,rows,currentCandidates(ctx)),weakText=weak?skillName(weak.skill):null;
  return{items:set,title:isKo()?'이 단원 추천 연습':'Recommended unit practice',message:isKo()?(weakText?weakText+'을 조금 더 많이 넣고, 이 단원에서 필요한 영역을 섞어서 '+set.length+'문제를 골랐어요. 같은 문제만 반복하지 않도록 구성했어요.':'이 단원에서 필요한 영역을 골고루 섞어서 '+set.length+'문제를 준비했어요.'):(weakText?'I weighted this toward '+weakText+' and mixed in the other useful skills from this unit. I prepared '+set.length+' varied questions without repeating the same item over and over.':'I prepared '+set.length+' balanced questions from the useful skills in this unit.'),action:isKo()?set.length+'문제 시작하기 →':'Start '+set.length+' questions →'};
}

async function makeSkillPlan(ctx,skill,reason){
  var pool=await poolForSkill(ctx,skill);if(pool.length<MIN_SET)return noSet();
  var set=chooseFresh(ctx,pool,TARGET_SET);if(set.length<MIN_SET)return noSet();remember(ctx,set);
  var name=skillName(skill),msg;
  if(reason==='mistakes')msg=isKo()?name+'에서 최근 실수가 보여서 같은 능력을 연습하는 문제 '+set.length+'개를 골랐어요. 틀린 한 문제만 반복하지 않고 비슷한 문제를 섞었어요.':'I saw recent mistakes in '+name+', so I chose '+set.length+' questions that practise the same skill without just repeating the one you missed.';
  else if(reason==='review')msg=isKo()?name+'은 다시 확인할 시점이에요. 기억을 되살릴 수 있도록 '+set.length+'문제를 준비했어요.':'It is a good time to revisit '+name+'. I prepared '+set.length+' questions to refresh it.';
  else msg=isKo()?name+'을 더 연습할 수 있도록 '+set.length+'개의 서로 다른 문제를 준비했어요.':'I prepared '+set.length+' different '+name+' questions for a focused practice round.';
  return{items:set,title:(isKo()?name+' 집중 연습':'Focused '+name+' practice'),message:msg,action:isKo()?set.length+'문제 연습하기 →':'Practice '+set.length+' questions →'};
}

async function makeChallenge(ctx,skill){
  var unit=skillItems(await unitBank(ctx),skill),level=skillItems(await levelBank(ctx),skill).filter(function(x){return!sameUnit(ctx,x);});
  var baseDiff=unit.length?unit.reduce(function(s,x){return s+(Number(x.difficulty)||0);},0)/unit.length:0;
  var harder=level.filter(function(x){return (Number(x.difficulty)||0)>=baseDiff;});if(harder.length<MIN_SET)harder=level;
  if(harder.length<MIN_SET)return noSet();var set=chooseFresh(ctx,harder,TARGET_SET);remember(ctx,set);
  return{items:set,title:isKo()?'조금 더 어려운 '+skillName(skill):'A harder '+skillName(skill)+' challenge',message:isKo()?skillName(skill)+'은 꽤 안정적이에요. 같은 수준에서 조금 더 생각해야 하는 문제 '+set.length+'개를 골랐어요.':skillName(skill)+' looks fairly secure, so I picked '+set.length+' questions that should make you think a little harder.',action:isKo()?'도전 시작하기 →':'Start challenge →'};
}

async function makeNew(ctx,rows){
  var level=(await levelBank(ctx)).filter(function(x){return!sameUnit(ctx,x);});if(level.length<MIN_SET)return noSet();
  var weak=weakTarget(ctx,rows,currentCandidates(ctx)),other=weak?level.filter(function(x){return x.skill!==weak.skill;}):level;if(other.length>=MIN_SET)level=other;
  var set=chooseFresh(ctx,level,TARGET_SET);remember(ctx,set);
  return{items:set,title:isKo()?'새로운 도전':'Something new',message:isKo()?'지금 수준에 맞으면서 이 단원과는 조금 다른 문제 '+set.length+'개를 골랐어요. 새로운 내용을 가볍게 맛보는 연습이에요.':'I picked '+set.length+' questions at about the right level that are a little different from this unit, so you can try something new.',action:isKo()?'새로운 문제 시작하기 →':'Try something new →'};
}

function noSet(){return{message:isKo()?'지금은 좋은 연습 세트를 만들 만큼 서로 다른 문제가 충분하지 않아요. 같은 한 문제를 반복해서 추천하지 않을게요.':'There are not enough different useful questions to build a good practice set right now. I will not keep sending you the same single question.',action:null};}

async function buildPlan(option){
  var ctx=currentContext();if(!ctx)return noSet();var rows=masteryRows(),cs=currentCandidates(ctx);
  if(option.id==='unit'||option.id==='practice_unit')return makeUnitPlan(ctx,rows);
  if(option.id.indexOf('skill:')===0)return makeSkillPlan(ctx,option.id.split(':')[1],'skill');
  if(option.id==='mistakes'){
    var m=cs.filter(function(c){return Number(c.lapses)>0;}).sort(function(a,b){return Number(b.lapses)-Number(a.lapses);})[0];
    return m?makeSkillPlan(ctx,m.skill,'mistakes'):makeUnitPlan(ctx,rows);
  }
  if(option.id==='review'){
    var d=cs.filter(function(c){return Number(c.due)>0;}).sort(function(a,b){return Number(b.due)-Number(a.due);})[0];
    return d?makeSkillPlan(ctx,d.skill,'review'):makeUnitPlan(ctx,rows);
  }
  if(option.id==='challenge')return makeChallenge(ctx,option.skill||(strongestSkill(rows)||{}).skill);
  if(option.id==='more')return makeSkillPlan(ctx,option.skill||(weakTarget(ctx,rows,cs)||{}).skill,'skill');
  if(option.id==='new')return makeNew(ctx,rows);
  return makeUnitPlan(ctx,rows);
}

function transcript(){return document.getElementById('aiChatTranscript');}
function trim(){var t=transcript();if(!t)return;while(t.children.length>8)t.removeChild(t.firstChild);}
function addBubble(kind,content,thinking){
  var t=transcript();if(!t)return null;var row=document.createElement('div');row.className='study-v2-ai-chat-row is-'+kind;var bubble=document.createElement('div');bubble.className='study-v2-ai-chat-bubble';
  if(thinking)bubble.innerHTML='<span class="study-v2-ai-thinking">'+content+'<span class="study-v2-ai-thinking-dots"><i></i><i></i><i></i></span></span>';else bubble.textContent=content;
  row.appendChild(bubble);t.appendChild(row);trim();return{row:row,bubble:bubble};
}
async function typeCoach(message){var x=addBubble('coach','');if(!x)return null;for(var i=0;i<message.length;i++){x.bubble.textContent+=message.charAt(i);if(i%2===0)await sleep(message.length>150?5:9);}return x;}
function setDisabled(v){document.querySelectorAll('#aiChatPrompts .study-v2-ai-prompt').forEach(function(b){b.disabled=v;});}
function appendAction(bubble,plan){if(!bubble||!plan||!plan.action||!arr(plan.items).length)return;var b=document.createElement('button');b.type='button';b.className='study-v2-ai-inline-link';b.textContent=plan.action;b.addEventListener('click',function(){var p=global.WillenaStudyV2AIPractice;if(p&&typeof p.open==='function')p.open(plan);});bubble.appendChild(b);}

async function handle(option){
  if(busy)return;busy=true;setDisabled(true);addBubble('user',option.label);var thinking=addBubble('coach',isKo()?'생각하고 있어요':'Thinking',true),started=Date.now(),plan;
  try{plan=await buildPlan(option);}catch(e){console.warn('[AI relevant coach]',e);plan=noSet();}
  var wait=Math.max(0,550-(Date.now()-started));if(wait)await sleep(wait);if(thinking&&thinking.row&&thinking.row.parentNode)thinking.row.remove();
  var response=await typeCoach(plan.message);appendAction(response&&response.bubble,plan);setDisabled(false);busy=false;
}

async function renderMenu(){
  var p=document.getElementById('aiChatPrompts');if(!p)return;
  p.innerHTML='<button class="study-v2-ai-prompt" type="button" disabled>'+(isKo()?'추천을 고르는 중...':'Choosing useful options...')+'</button>';
  var opts=[];try{opts=await promptOptions();}catch(e){console.debug('[AI relevant prompts]',e);}
  if(!opts.length){opts=[{id:'unit',label:isKo()?'이 단원에서 뭘 공부하면 좋을까요?':'What should I study in this unit?'}];}
  p.innerHTML='';opts.forEach(function(o){var b=document.createElement('button');b.type='button';b.className='study-v2-ai-prompt';b.textContent=o.label;b.addEventListener('click',function(){handle(o);});p.appendChild(b);});
}

function mount(){
  var shell=document.getElementById('aiChat');if(!shell)return;
  setTimeout(renderMenu,80);
  document.addEventListener('click',function(e){
    if(e.target&&e.target.closest&&e.target.closest('#languageBtn'))setTimeout(renderMenu,220);
  },true);
  global.addEventListener('willena:study-recording',function(){setTimeout(renderMenu,700);});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
global.WillenaStudyV2RelevantCoach={refresh:renderMenu,buildPlan:buildPlan};
})(window);
