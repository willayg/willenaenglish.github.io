(function(global){
'use strict';

var MIN_SET=6;
var TARGET_SET=10;
var MAX_PROMPTS=4;
var busy=false;
var unitCache={};
var levelCache={};
var KO={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
var EN={vocabulary:'vocabulary',spelling:'spelling',grammar:'grammar',sentence_building:'sentence building',conversation:'conversation',listening:'listening',reading:'reading'};

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function skillName(s){return (isKo()?KO:EN)[s]||s||(isKo()?'영어':'English');}
function userId(){try{return text(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function shuffle(items){var a=arr(items).slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function unique(items){var seen={},out=[];arr(items).forEach(function(x){var id=text(x&&x.id||x&&x.sourceId);if(!id||seen[id])return;seen[id]=1;out.push(x);});return out;}
function avg(nums){var good=arr(nums).map(Number).filter(Number.isFinite);return good.length?good.reduce(function(a,b){return a+b;},0)/good.length:0;}
function dayKey(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(_){return new Date().toISOString().slice(0,10);}}

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
  return{book:book,books:books,bookId:String(book.book_id),bookTitle:text(book.book_title||book.title),unit:unit,unitId:String(unit.id),unitNumber:Number(unit.unit_number)||1,publicLevel:publicLevel};
}

function masteryRows(){
  return Array.prototype.slice.call(document.querySelectorAll('#masteryGrid [data-skill]')).map(function(card){
    var raw=text(card.querySelector('.header-skill-master-pct')&&card.querySelector('.header-skill-master-pct').textContent);
    return{skill:text(card.dataset.skill),pct:Number(raw.replace(/[^0-9.]/g,''))||0};
  }).filter(function(x){return x.skill;});
}
function candidates(){var c=global.WillenaStudyV2Coach;return c&&typeof c.getCandidates==='function'?arr(c.getCandidates()):[];}
function currentCandidates(ctx){return candidates().filter(function(c){return c&&String(c.bookId)===ctx.bookId&&String(c.unitId)===ctx.unitId;});}
function averageMastery(rows){var used=rows.filter(function(r){return r.pct>0;});return used.length?Math.round(avg(used.map(function(r){return r.pct;}))):0;}
function skillPct(rows,skill){var r=rows.find(function(x){return x.skill===skill;});return r?r.pct:0;}
function strongestSkill(rows){return rows.filter(function(r){return r.pct>0;}).sort(function(a,b){return b.pct-a.pct;})[0]||null;}
function weakestSkill(rows){return rows.filter(function(r){return r.pct>0;}).sort(function(a,b){return a.pct-b.pct;})[0]||null;}

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

function recentKey(ctx){return'willena-ai-coach-recent:v2:'+userId()+':'+ctx.unitId;}
function recentIds(ctx){try{return arr(JSON.parse(localStorage.getItem(recentKey(ctx))||'[]'));}catch(_){return[];}}
function remember(ctx,items){
  try{
    var ids=arr(items).map(function(x){return text(x&&x.id||x&&x.sourceId);}).filter(Boolean).concat(recentIds(ctx));
    localStorage.setItem(recentKey(ctx),JSON.stringify(Array.from(new Set(ids)).slice(0,100)));
  }catch(_){}
}
function chooseFresh(ctx,items,n){
  var recent=recentIds(ctx),fresh=shuffle(arr(items).filter(function(x){return recent.indexOf(text(x&&x.id||x&&x.sourceId))<0;})),old=shuffle(arr(items).filter(function(x){return recent.indexOf(text(x&&x.id||x&&x.sourceId))>=0;}));
  return unique(fresh.concat(old)).slice(0,n||TARGET_SET);
}
function sameUnit(ctx,item){var m=item&&item.metadata||{};return String(m.book_id||'')===ctx.bookId&&String(m.unit_id||'')===ctx.unitId;}
function sameBook(ctx,item){var m=item&&item.metadata||{};return String(m.book_id||'')===ctx.bookId;}
function skillItems(items,skill){return arr(items).filter(function(x){return x&&x.skill===skill;});}
function patternId(item){var m=item&&item.metadata||{};return text(m.pattern_id||(m.mastery_content_type==='pattern'&&m.mastery_content_id)||'');}
function difficulty(item){return Number(item&&item.difficulty)||0;}

async function poolForSkill(ctx,skill){
  var unit=skillItems(await unitBank(ctx),skill),level=skillItems(await levelBank(ctx),skill).filter(function(x){return!sameUnit(ctx,x);});
  return unique(unit.concat(level));
}
async function canBuildSkill(ctx,skill){return (await poolForSkill(ctx,skill)).length>=MIN_SET;}

function weakTarget(rows,cs){
  var c=cs.filter(function(x){return x.type==='weak';}).sort(function(a,b){return (Number(b.lapses)||0)-(Number(a.lapses)||0)||(Number(a.mastery)||0)-(Number(b.mastery)||0);})[0];
  if(c)return{skill:c.skill,pct:Number(c.mastery)||0,lapses:Number(c.lapses)||0,due:Number(c.due)||0};
  var r=weakestSkill(rows);return r?{skill:r.skill,pct:r.pct,lapses:0,due:0}:null;
}

function dailySignal(ctx){
  var out={completed:false,accuracy:null,strong:false,steady:false,struggled:false,attempts:0};
  try{
    var daily=global.WillenaStudyV2Daily;
    if(!daily)return out;
    if(typeof daily.isTestMode==='function'&&daily.isTestMode())return out;
    var s=typeof daily.getSession==='function'?daily.getSession():null;
    out.completed=!!(s&&(s.status==='completed'||arr(s.resolved_keys).length>=20));
    var p=typeof daily.getProgression==='function'?daily.getProgression():null;
    var units=arr(p&&p.unitProgress).filter(function(x){return String(x.book_id)===ctx.bookId&&String(x.unit_id)===ctx.unitId;});
    if(!units.length)units=arr(p&&p.unitProgress).filter(function(x){return String(x.book_id)===ctx.bookId;});
    var recent=[];
    units.forEach(function(u){
      var rr=arr(u&&u.recent_results);
      if(rr.length)recent=recent.concat(rr.slice(-12));
      else if(Number(u&&u.attempts)>0){
        var a=Number(u.attempts)||0,c=Number(u.correct)||0;
        for(var i=0;i<a&&i<12;i++)recent.push(i<c);
      }
    });
    if(recent.length){
      out.attempts=recent.length;
      out.accuracy=recent.filter(function(v){return v===true;}).length/recent.length;
      out.strong=out.completed&&out.accuracy>=.88;
      out.steady=out.accuracy>=.78;
      out.struggled=out.accuracy<.68;
    }else if(out.completed){out.strong=true;out.steady=true;}
  }catch(_){}
  return out;
}

function classifyState(ctx,rows,cs){
  var d=dailySignal(ctx),used=rows.filter(function(r){return r.pct>0;}),mastery=averageMastery(rows),weak=weakTarget(rows,cs);
  var lapses=cs.reduce(function(n,c){return n+(Number(c&&c.lapses)||0);},0),due=cs.reduce(function(n,c){return n+(Number(c&&c.due)||0);},0);
  var low=used.filter(function(r){return r.pct<65;}).length,strong=used.filter(function(r){return r.pct>=82;}).length,state='building';
  if((d.struggled&&weak)||(low>0&&lapses>0))state='support';
  else if(d.strong&&mastery>=78&&!low)state='challenge';
  else if(mastery>=84&&!low&&strong>=Math.max(1,Math.ceil(used.length/2)))state='challenge';
  else if(due>0)state='review';
  else if(weak&&weak.pct>0&&weak.pct<75)state='consolidate';
  else if(mastery>=75)state='steady';
  return{state:state,daily:d,mastery:mastery,weak:weak,strongest:strongestSkill(rows),lapses:lapses,due:due,skills:used.length};
}

function copyKey(key){return'willena-ai-coach-copy:v1:'+userId()+':'+dayKey()+':'+key;}
function varied(key,ko,en){
  var list=isKo()?ko:en;if(!list||!list.length)return'';var idx=0;
  try{idx=Number(sessionStorage.getItem(copyKey(key))||'-1');idx=(idx+1)%list.length;sessionStorage.setItem(copyKey(key),String(idx));}catch(_){idx=Math.floor(Math.random()*list.length);}
  return list[idx];
}
function format(template,vars){return String(template||'').replace(/\{(\w+)\}/g,function(_,k){return vars&&vars[k]!=null?String(vars[k]):'';});}
function planCopy(kind,vars){
  var maps={
    unit:{ko:['오늘은 {weak}을 조금 더 넣고, 이 단원에서 필요한 영역을 섞어 {count}문제를 골랐어요.','이 단원을 전체적으로 확인하되 {weak} 쪽에 조금 더 무게를 뒀어요. {count}문제면 충분해요.','지금 기록을 보면 {weak}을 먼저 챙기는 게 좋아요. 다른 영역도 섞어서 {count}문제를 준비했어요.'],en:['I weighted this round toward {weak} and mixed in the other useful skills from this unit. {count} questions should be enough.','This round checks the whole unit, with a little extra attention on {weak}. I picked {count} varied questions.','Your recent work says {weak} is the best place to start, so I built a {count}-question mixed set around it.']},
    skill:{ko:['{skill}을 집중해서 볼 수 있도록 서로 다른 {count}문제를 골랐어요.','이번에는 {skill}만 짧고 선명하게 봐요. 같은 문제 반복 없이 {count}문제를 준비했어요.','{skill} 기록을 조금 더 확실하게 만들 수 있도록 {count}문제를 섞었어요.'],en:['I picked {count} different questions for a focused {skill} round.','Let’s keep this one simple: {count} varied {skill} questions, without repeating the same item.','I built a {count}-question {skill} set to give us a clearer picture of this skill.']},
    mistakes:{ko:['최근 {skill} 실수가 보여요. 틀린 문제 하나만 반복하지 않고 같은 능력을 쓰는 {count}문제를 골랐어요.','{skill}에서 비슷한 실수가 다시 나왔어요. 같은 개념을 다른 문장으로 확인해 봐요. {count}문제예요.','지금은 {skill} 실수를 다시 잡는 게 가장 도움이 돼요. 다른 형태의 {count}문제로 확인해 볼게요.'],en:['I saw recent mistakes in {skill}, so I chose {count} questions that use the same skill without just repeating the one you missed.','A similar {skill} mistake has shown up more than once. Let’s check the idea in {count} different questions.','The best next move is to clean up the recent {skill} mistakes. I built a varied {count}-question set.']},
    review:{ko:['{skill}은 다시 확인할 시점이에요. 기억을 되살릴 수 있도록 {count}문제를 준비했어요.','전에 배운 {skill}이 잊히기 전에 짧게 확인해 봐요. {count}문제면 충분해요.','{skill} 복습 타이밍이 왔어요. 길게 하지 않고 {count}문제로 기억만 다시 꺼내 볼게요.'],en:['It is a good time to revisit {skill}. I prepared {count} questions to refresh it.','A quick {skill} review now should help it stick. I picked {count} questions.','This is a good review window for {skill}. We’ll keep it short with {count} questions.']},
    harder:{ko:['{skill}은 안정적이에요. 이번에는 같은 수준에서 조금 더 생각해야 하는 {count}문제를 골랐어요.','좋아요. {skill} 기본 문제보다 한 단계 더 생각해야 하는 문제로 가볼게요. {count}문제예요.','{skill}은 잘 잡혀 있어요. 난이도를 조금 올린 {count}문제로 확인해 볼까요?'],en:['{skill} looks secure, so I picked {count} questions that should make you think a little harder.','You look ready to push {skill} a little further. This set has {count} tougher questions.','The basics of {skill} look solid. I raised the difficulty for this {count}-question round.']},
    pattern:{ko:['이 단원에서 잘한 문법을 다른 교재와 상황에서 찾아봤어요. 같은 문법 포인트를 쓰는 {count}문제예요.','같은 문법이 다른 책에서는 어떻게 나오는지 볼까요? 문장은 달라도 핵심 패턴은 같아요. {count}문제를 골랐어요.','이건 전이 도전이에요. 지금 잘하는 문법 포인트를 다른 교재 문장 {count}개에서 찾아보세요.'],en:['I found the same grammar point in other books and contexts. These {count} questions use the same pattern in different sentences.','Let’s see whether this grammar transfers to other books. The wording changes, but the core pattern is the same across these {count} questions.','This is a transfer challenge: the grammar point you know, used in {count} questions from different book contexts.']},
    mixed:{ko:['오늘 공부가 안정적이었어요. 강한 영역을 섞어서 {count}문제 도전을 만들었어요.','약한 부분만 볼 필요는 없어요. 오늘 잘한 영역을 섞어 {count}문제 챌린지로 확인해 봐요.','오늘 기록이면 혼합 도전을 해볼 만해요. 서로 다른 영역에서 {count}문제를 골랐어요.'],en:['Today’s work looks strong, so I built a {count}-question mixed challenge from your stronger areas.','There is no need to focus only on weaknesses. I mixed {count} questions from skills you are handling well.','Your recent work is strong enough for a mixed challenge. I picked {count} questions across different secure skills.']},
    new:{ko:['지금 수준에 맞으면서 이 단원과는 조금 다른 {count}문제를 골랐어요. 새로운 내용을 가볍게 맛보는 연습이에요.','현재 단원 밖에서 너무 어렵지 않은 {count}문제를 골랐어요. 다른 내용도 한번 써볼까요?','새로운 걸 원했으니 현재 수준 근처에서 다른 교재의 {count}문제를 섞었어요.'],en:['I picked {count} questions at about the right level that are a little different from this unit.','I found {count} questions outside the current unit that should still be a sensible level for you.','You asked for something new, so I mixed {count} questions from other books around your current level.']}
  };
  var m=maps[kind]||maps.skill;return format(varied(kind,m.ko,m.en),vars||{});
}

function balancedSet(ctx,items,rows,target){
  target=target||TARGET_SET;var groups={},skills=[];
  arr(items).forEach(function(x){if(!x||!x.skill)return;if(!groups[x.skill]){groups[x.skill]=[];skills.push(x.skill);}groups[x.skill].push(x);});
  skills.sort(function(a,b){return skillPct(rows,a)-skillPct(rows,b);});Object.keys(groups).forEach(function(k){groups[k]=shuffle(groups[k]);});
  var out=[],counts={},guard=0;
  while(out.length<target&&guard<target*5){var added=false;skills.forEach(function(s,idx){if(out.length>=target||!groups[s].length)return;var cap=idx===0?5:(idx===1?4:3);if((counts[s]||0)>=cap)return;out.push(groups[s].shift());counts[s]=(counts[s]||0)+1;added=true;});if(!added)break;guard++;}
  if(out.length<target){var rest=[];Object.keys(groups).forEach(function(k){rest=rest.concat(groups[k]);});out=unique(out.concat(shuffle(rest))).slice(0,target);}
  return chooseFresh(ctx,out,target);
}

function currentGrammarPatterns(items){var counts={};skillItems(items,'grammar').forEach(function(item){var id=patternId(item);if(id)counts[id]=(counts[id]||0)+1;});return Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];});}
async function patternChallengePool(ctx){
  var unit=await unitBank(ctx),level=await levelBank(ctx),patterns=currentGrammarPatterns(unit);if(!patterns.length)return{pattern:null,items:[]};
  for(var i=0;i<patterns.length;i++){
    var pid=patterns[i],cross=level.filter(function(x){return x.skill==='grammar'&&patternId(x)===pid&&!sameBook(ctx,x);});
    if(cross.length>=MIN_SET)return{pattern:pid,items:cross};
    var outside=level.filter(function(x){return x.skill==='grammar'&&patternId(x)===pid&&!sameUnit(ctx,x);});
    if(outside.length>=MIN_SET)return{pattern:pid,items:outside};
  }
  return{pattern:null,items:[]};
}
async function harderChallengePool(ctx,skill){
  var unit=skillItems(await unitBank(ctx),skill),level=skillItems(await levelBank(ctx),skill).filter(function(x){return!sameUnit(ctx,x);});
  var diffs=unit.map(difficulty).filter(function(n){return n>0;}),base=diffs.length?avg(diffs):0,harder=level.filter(function(x){return difficulty(x)>base;});
  if(harder.length<MIN_SET)harder=level.filter(function(x){return difficulty(x)>=base;});return harder.length>=MIN_SET?harder:[];
}
async function mixedChallengePool(ctx,rows){
  var level=(await levelBank(ctx)).filter(function(x){return!sameUnit(ctx,x);}),strong=rows.filter(function(r){return r.pct>=78;}).sort(function(a,b){return b.pct-a.pct;});
  if(!strong.length)return[];var skills=strong.slice(0,3).map(function(r){return r.skill;}),pool=level.filter(function(x){return skills.indexOf(x.skill)>=0;});return pool.length>=MIN_SET?pool:[];
}

async function promptOptions(){
  var ctx=currentContext();if(!ctx)return[];
  var rows=masteryRows(),cs=currentCandidates(ctx),unit=await unitBank(ctx),level=await levelBank(ctx),analysis=classifyState(ctx,rows,cs),opts=[];
  var history=rows.some(function(r){return r.pct>0;})||cs.some(function(c){return (Number(c.attempts)||0)+(Number(c.unique)||0)>0;});
  function add(id,labelKo,labelEn,skill,meta){if(opts.length>=MAX_PROMPTS||opts.some(function(x){return x.id===id;}))return;opts.push(Object.assign({id:id,label:isKo()?labelKo:labelEn,skill:skill||null},meta||{}));}
  function fill(){
    if(opts.length<3)add('unit','이 단원에서 뭘 공부하면 좋을까요?','What should I study in this unit?');
    if(opts.length<3)add('practice_unit','이 단원을 연습해 볼래요','Practice this unit');
    if(opts.length<3)add('new','새로운 걸 해볼래요','Give me something new');
    if(opts.length<3)add('challenge','조금 더 어렵게 해볼래요','Make it a little harder',(analysis.strongest||analysis.weak||{}).skill);
    return opts.slice(0,MAX_PROMPTS);
  }
  if(!history){
    add('unit','이 단원에서 뭘 공부하면 좋을까요?','What should I study in this unit?');
    add('practice_unit','이 단원을 연습해 볼래요','Practice this unit');
    add('new','새로운 걸 해볼래요','Give me something new');
    return fill();
  }
  if(analysis.state==='challenge'){
    var patternPool=await patternChallengePool(ctx);if(patternPool.items.length>=MIN_SET)add('challenge_pattern','다른 책에서도 같은 문법 해볼래요','Try the same grammar in other books','grammar',{pattern:patternPool.pattern});
    var strong=analysis.strongest;if(strong)add('challenge_harder','조금 더 어렵게 해볼래요','Make it harder',strong.skill);
    add('challenge_mixed','오늘 잘한 걸 섞어서 도전할래요','Mix my strong skills');
    add('new','새로운 걸 해볼래요','Give me something new');
    return fill();
  }
  add('unit','이 단원에서 뭘 공부하면 좋을까요?','What should I study in this unit?');
  var weak=analysis.weak,mistake=cs.filter(function(c){return Number(c.lapses)>0;}).sort(function(a,b){return Number(b.lapses)-Number(a.lapses);})[0];
  if(mistake)add('mistakes','틀린 부분을 다시 도와줘','Help me with my mistakes',mistake.skill);
  if(weak)add('skill:'+weak.skill,skillName(weak.skill)+'을 더 연습할래요','More '+skillName(weak.skill)+' practice',weak.skill);
  var due=cs.filter(function(c){return Number(c.due)>0;}).sort(function(a,b){return Number(b.due)-Number(a.due);})[0];
  if(due)add('review','잊기 전에 복습할래요','Review before I forget',due.skill);
  if(opts.length<3&&analysis.daily.strong)add('challenge_mixed','오늘 잘했으니 도전할래요','I did well — challenge me');
  return fill();
}

function noSet(){return{type:'unavailable',message:isKo()?'지금은 좋은 연습 세트를 만들 만큼 서로 다른 문제가 충분하지 않아요. 같은 한 문제를 반복해서 추천하지 않을게요.':'There are not enough different useful questions to build a good practice set right now. I will not keep sending you the same single question.',action:null};}
async function makeUnitPlan(ctx,rows){
  var unit=await unitBank(ctx),level=await levelBank(ctx),relevant=Array.from(new Set(unit.map(function(x){return x.skill;}).filter(Boolean))),supplement=level.filter(function(x){return!sameUnit(ctx,x)&&relevant.indexOf(x.skill)>=0;}),pool=unique(unit.concat(supplement));
  if(pool.length<MIN_SET)return noSet();var set=balancedSet(ctx,pool,rows,TARGET_SET);if(set.length<MIN_SET)return noSet();remember(ctx,set);
  var weak=weakTarget(rows,currentCandidates(ctx)),weakText=weak?skillName(weak.skill):(isKo()?'이 단원':'this unit');
  return{type:'unit',items:set,title:isKo()?'이 단원 추천 연습':'Recommended unit practice',message:planCopy('unit',{weak:weakText,count:set.length}),action:isKo()?set.length+'문제 시작하기 →':'Start '+set.length+' questions →'};
}
async function makeSkillPlan(ctx,skill,reason){
  if(!skill)return noSet();var pool=await poolForSkill(ctx,skill);if(pool.length<MIN_SET)return noSet();var set=chooseFresh(ctx,pool,TARGET_SET);if(set.length<MIN_SET)return noSet();remember(ctx,set);
  var name=skillName(skill),kind=reason==='mistakes'?'mistakes':reason==='review'?'review':'skill';return{type:kind,items:set,title:isKo()?name+' 집중 연습':'Focused '+name+' practice',message:planCopy(kind,{skill:name,count:set.length}),action:isKo()?set.length+'문제 연습하기 →':'Practice '+set.length+' questions →'};
}
async function makeHarderChallenge(ctx,skill){
  if(!skill)return noSet();var pool=await harderChallengePool(ctx,skill);if(pool.length<MIN_SET)return noSet();var set=chooseFresh(ctx,pool,TARGET_SET);remember(ctx,set);var name=skillName(skill);
  return{type:'challenge_harder',items:set,title:isKo()?name+' 난이도 도전':'Harder '+name+' challenge',message:planCopy('harder',{skill:name,count:set.length}),action:isKo()?'도전 시작하기 →':'Start challenge →'};
}
async function makePatternChallenge(ctx){
  var result=await patternChallengePool(ctx);if(result.items.length<MIN_SET)return noSet();var set=chooseFresh(ctx,result.items,TARGET_SET);remember(ctx,set);
  return{type:'challenge_pattern',patternId:result.pattern,items:set,title:isKo()?'같은 문법 · 다른 교재':'Same grammar · different books',message:planCopy('pattern',{count:set.length}),action:isKo()?set.length+'문제 도전하기 →':'Try '+set.length+' transfer questions →'};
}
async function makeMixedChallenge(ctx,rows){
  var pool=await mixedChallengePool(ctx,rows);if(pool.length<MIN_SET)return noSet();var set=balancedSet(ctx,pool,rows,TARGET_SET);if(set.length<MIN_SET)return noSet();remember(ctx,set);
  return{type:'challenge_mixed',items:set,title:isKo()?'오늘의 혼합 도전':'Today’s mixed challenge',message:planCopy('mixed',{count:set.length}),action:isKo()?set.length+'문제 도전하기 →':'Take the '+set.length+'-question challenge →'};
}
async function makeNew(ctx,rows){
  var level=(await levelBank(ctx)).filter(function(x){return!sameUnit(ctx,x);});if(level.length<MIN_SET)return noSet();var weak=weakTarget(rows,currentCandidates(ctx)),other=weak?level.filter(function(x){return x.skill!==weak.skill;}):level;if(other.length>=MIN_SET)level=other;
  var set=chooseFresh(ctx,level,TARGET_SET);remember(ctx,set);return{type:'new',items:set,title:isKo()?'새로운 도전':'Something new',message:planCopy('new',{count:set.length}),action:isKo()?'새로운 문제 시작하기 →':'Try something new →'};
}

async function buildPlan(option){
  var ctx=currentContext();if(!ctx)return noSet();var rows=masteryRows(),cs=currentCandidates(ctx),analysis=classifyState(ctx,rows,cs);
  if(option.id==='unit'||option.id==='practice_unit')return makeUnitPlan(ctx,rows);
  if(option.id.indexOf('skill:')===0)return makeSkillPlan(ctx,option.id.split(':')[1],'skill');
  if(option.id==='mistakes'){var m=cs.filter(function(c){return Number(c.lapses)>0;}).sort(function(a,b){return Number(b.lapses)-Number(a.lapses);})[0];return m?makeSkillPlan(ctx,m.skill,'mistakes'):makeUnitPlan(ctx,rows);}
  if(option.id==='review'){var d=cs.filter(function(c){return Number(c.due)>0;}).sort(function(a,b){return Number(b.due)-Number(a.due);})[0];return d?makeSkillPlan(ctx,d.skill,'review'):makeUnitPlan(ctx,rows);}
  if(option.id==='challenge_pattern')return makePatternChallenge(ctx);
  if(option.id==='challenge_harder')return makeHarderChallenge(ctx,option.skill||(analysis.strongest||{}).skill);
  if(option.id==='challenge_mixed')return makeMixedChallenge(ctx,rows);
  if(option.id==='challenge')return makeHarderChallenge(ctx,option.skill||(analysis.strongest||{}).skill);
  if(option.id==='more')return makeSkillPlan(ctx,option.skill||(analysis.weak||{}).skill,'skill');
  if(option.id==='new')return makeNew(ctx,rows);
  return makeUnitPlan(ctx,rows);
}

function transcript(){return document.getElementById('aiChatTranscript');}
function trim(){var t=transcript();if(!t)return;while(t.children.length>8)t.removeChild(t.firstChild);}
function addBubble(kind,content,thinking){var t=transcript();if(!t)return null;var row=document.createElement('div');row.className='study-v2-ai-chat-row is-'+kind;var bubble=document.createElement('div');bubble.className='study-v2-ai-chat-bubble';if(thinking)bubble.innerHTML='<span class="study-v2-ai-thinking">'+content+'<span class="study-v2-ai-thinking-dots"><i></i><i></i><i></i></span></span>';else bubble.textContent=content;row.appendChild(bubble);t.appendChild(row);trim();return{row:row,bubble:bubble};}
async function typeCoach(message){var x=addBubble('coach','');if(!x)return null;message=String(message||'');for(var i=0;i<message.length;i++){x.bubble.textContent+=message.charAt(i);if(i%2===0)await sleep(message.length>150?4:8);}return x;}
function setDisabled(v){document.querySelectorAll('#aiChatPrompts .study-v2-ai-prompt').forEach(function(b){b.disabled=v;});}
function appendAction(bubble,plan){if(!bubble||!plan||!plan.action||!arr(plan.items).length)return;var b=document.createElement('button');b.type='button';b.className='study-v2-ai-inline-link';b.textContent=plan.action;b.addEventListener('click',function(){var p=global.WillenaStudyV2AIPractice;if(p&&typeof p.open==='function')p.open(plan);});bubble.appendChild(b);}
async function handle(option){if(busy)return;busy=true;setDisabled(true);addBubble('user',option.label);var thinking=addBubble('coach',isKo()?'생각하고 있어요':'Thinking',true),started=Date.now(),plan;try{plan=await buildPlan(option);}catch(e){console.warn('[AI relevant coach]',e);plan=noSet();}var wait=Math.max(0,420-(Date.now()-started));if(wait)await sleep(wait);if(thinking&&thinking.row&&thinking.row.parentNode)thinking.row.remove();var response=await typeCoach(plan.message);appendAction(response&&response.bubble,plan);setDisabled(false);busy=false;}
async function renderMenu(){var p=document.getElementById('aiChatPrompts');if(!p)return;p.innerHTML='<button class="study-v2-ai-prompt" type="button" disabled>'+(isKo()?'추천을 고르는 중...':'Choosing useful options...')+'</button>';var opts=[];try{opts=await promptOptions();}catch(e){console.debug('[AI relevant prompts]',e);}if(!opts.length)opts=[{id:'unit',label:isKo()?'이 단원에서 뭘 공부하면 좋을까요?':'What should I study in this unit?'}];p.innerHTML='';opts.forEach(function(o){var b=document.createElement('button');b.type='button';b.className='study-v2-ai-prompt';b.textContent=o.label;b.addEventListener('click',function(){handle(o);});p.appendChild(b);});}
function mount(){var shell=document.getElementById('aiChat');if(!shell)return;setTimeout(renderMenu,100);document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#languageBtn'))setTimeout(renderMenu,220);},true);global.addEventListener('willena:study-recording',function(){setTimeout(renderMenu,650);});global.addEventListener('focus',function(){setTimeout(renderMenu,200);});}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
global.WillenaStudyV2RelevantCoach={refresh:renderMenu,buildPlan:buildPlan,getOptions:promptOptions,analyse:function(){var ctx=currentContext();return ctx?classifyState(ctx,masteryRows(),currentCandidates(ctx)):null;}};
})(window);