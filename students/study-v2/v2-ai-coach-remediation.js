(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerCapability!=='function')return;

var active=null;
var pending=null;
var successPending=false;

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function ko(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}}
function answerText(v){if(Array.isArray(v))return v.join(' ');if(v&&typeof v==='object'){if(v.text!=null)return text(v.text);if(v.answer!=null)return text(v.answer);try{return JSON.stringify(v);}catch(_){}}return text(v);}
function overlayOpen(){return !!document.getElementById('aiCoachPracticeOverlay');}
function practiceTitle(){var n=document.getElementById('aiCoachPracticeTitle');return text(n&&n.textContent);}
function retryFlag(activity){return !!(activity&&activity.metadata&&activity.metadata.coach_remediation_retry);}

function installCelebrationStyle(){
  if(document.getElementById('aiCoachCelebrationStyle'))return;
  var style=document.createElement('style');
  style.id='aiCoachCelebrationStyle';
  style.textContent='@keyframes coachBurst{0%{transform:translate(-50%,-50%) scale(.35) rotate(0deg);opacity:0}12%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.05) rotate(var(--rot));opacity:0}}@keyframes coachPop{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}35%{transform:translate(-50%,-50%) scale(1.18);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}.ai-coach-celebration{position:fixed;inset:0;pointer-events:none;z-index:10050;overflow:hidden}.ai-coach-celebration-piece{position:absolute;left:50%;top:48%;width:10px;height:18px;border-radius:3px;background:hsl(var(--h),88%,60%);animation:coachBurst 900ms cubic-bezier(.12,.7,.24,1) forwards;animation-delay:var(--delay)}.ai-coach-celebration-pop{position:absolute;left:50%;top:48%;font-size:58px;line-height:1;animation:coachPop 760ms ease-out forwards}@media(prefers-reduced-motion:reduce){.ai-coach-celebration-piece{display:none}.ai-coach-celebration-pop{animation:none;opacity:1}}';
  document.head.appendChild(style);
}
function celebrate(){
  installCelebrationStyle();
  var old=document.querySelector('.ai-coach-celebration');if(old)old.remove();
  var layer=document.createElement('div');layer.className='ai-coach-celebration';
  var pop=document.createElement('div');pop.className='ai-coach-celebration-pop';pop.textContent='🎉';layer.appendChild(pop);
  var count=34;
  for(var i=0;i<count;i++){
    var piece=document.createElement('i');piece.className='ai-coach-celebration-piece';
    var angle=(Math.PI*2*i/count)+(Math.random()*.22-.11),dist=85+Math.random()*165;
    piece.style.setProperty('--dx',Math.round(Math.cos(angle)*dist)+'px');
    piece.style.setProperty('--dy',Math.round(Math.sin(angle)*dist)+'px');
    piece.style.setProperty('--rot',Math.round((Math.random()*720)-360)+'deg');
    piece.style.setProperty('--h',Math.round(Math.random()*360));
    piece.style.setProperty('--delay',Math.round(Math.random()*90)+'ms');
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(function(){if(layer.parentNode)layer.remove();},1150);
}
function classify(title,mistakes){
  var low=text(title).toLowerCase();
  if(low.indexOf('3인칭')>=0||low.indexOf('third-person')>=0)return'third_person';
  if(low.indexOf('과거분사')>=0||low.indexOf('participle')>=0)return'past_participle';
  if(low.indexOf('과거')>=0||low.indexOf('past')>=0)return'past';
  var skills={};arr(mistakes).forEach(function(m){var s=text(m.activity&&m.activity.skill);if(s)skills[s]=(skills[s]||0)+1;});
  var best=Object.keys(skills).sort(function(a,b){return skills[b]-skills[a];})[0];
  return best||'general';
}
function explanation(kind,count,secondPass){
  var n=Number(count)||1;
  if(kind==='third_person')return ko()
    ?(secondPass?'아직 헷갈리는 문제가 있어요. 다시 기억해 봐요: he / she / it 뒤에서는 일반동사의 형태가 바뀌어요. 보통 -s를 붙이고, watch → watches, study → studies처럼 철자가 바뀌는 경우도 있어요.':'이번에 '+n+'개를 놓쳤어요. 핵심은 he / she / it 뒤의 동사예요. 보통 동사에 -s를 붙이고, watch → watches, study → studies처럼 철자가 바뀌는 경우도 있어요.')
    :(secondPass?'A few are still tricky. Remember: after he, she, or it, the verb changes. Usually add -s, with forms such as watch → watches and study → studies.':'You missed '+n+'. The key rule is the verb after he, she, or it. Usually add -s, with spelling changes such as watch → watches and study → studies.');
  if(kind==='past')return ko()
    ?(secondPass?'아직 헷갈리는 문제가 있어요. 과거의 일을 말할 때는 동사를 과거형으로 바꿔야 해요. 규칙동사는 보통 -ed를 붙이고, go → went처럼 불규칙 동사는 형태를 따로 기억해야 해요.':'이번에 '+n+'개를 놓쳤어요. 과거의 일을 말할 때는 동사를 과거형으로 바꿔요. 규칙동사는 보통 -ed를 붙이고, go → went처럼 불규칙 동사는 형태를 따로 기억해야 해요.')
    :(secondPass?'A few are still tricky. For past events, use the past form of the verb. Regular verbs usually take -ed, while irregular verbs such as go → went must be learned separately.':'You missed '+n+'. For past events, use the past form of the verb. Regular verbs usually take -ed, while irregular verbs such as go → went must be learned separately.');
  if(kind==='past_participle')return ko()
    ?'과거분사는 과거형과 같은 것도 있지만 다른 것도 있어요. 예를 들어 go → went → gone처럼 세 번째 형태를 따로 확인해야 해요.'
    :'Past participles sometimes match the past form, but sometimes they do not. Think of the third form, such as go → went → gone.';
  if(kind==='listening')return ko()
    ?'듣기에서 놓친 부분이 있었어요. 먼저 문장의 핵심 단어와 끝소리를 잡고, 다시 들을 때는 모든 단어를 한꺼번에 이해하려고 하지 않아도 돼요.'
    :'A few listening items were tricky. Listen for the key words and endings first; you do not need to catch every word at once.';
  if(kind==='grammar')return ko()
    ?'문법 문제에서 같은 종류의 실수가 몇 개 있었어요. 문장의 주어와 시간 표현을 먼저 보고 어떤 형태가 필요한지 결정해 봐요.'
    :'There were a few similar grammar mistakes. First check the subject and the time clue, then decide which form the sentence needs.';
  return ko()
    ?'몇 문제가 어려웠어요. 정답을 외우기보다 문장에서 어떤 규칙을 써야 하는지 먼저 찾고 다시 풀어 봐요.'
    :'A few questions were tricky. Instead of memorizing the answer, identify the rule the sentence needs and then try again.';
}
function answerSummary(mistakes){
  var bits=arr(mistakes).slice(0,5).map(function(m){
    var a=m.activity||{},prompt=text(a.stimulus&&a.stimulus.prompt),ans=answerText(m.result&&m.result.answer);
    if(!ans)return'';
    return prompt?(prompt+' → '+ans):ans;
  }).filter(Boolean);
  if(!bits.length)return'';
  return (ko()?'다시 틀린 문제의 정답은 ':'The answers you still missed are ')+bits.join(' · ')+(ko()?'예요.':'.');
}
function makeRetryItems(mistakes,round){
  return arr(mistakes).map(function(m,i){
    var item=clone(m.activity)||{};
    item.metadata=Object.assign({},item.metadata||{}, {coach_remediation_retry:true,coach_remediation_round:round||1});
    item.id=text(item.id||item.sourceId||'coach-retry')+'-retry-'+(round||1)+'-'+i;
    return item;
  });
}
function registerSuccess(data){
  successPending=true;
  var wasRetry=!!data.retry;
  coach.registerCapability({
    id:'remediation_success',
    score:20000,
    available:function(){return successPending;},
    label:{ko:'🎉 모두 맞았어요!',en:'🎉 All correct!'},
    response:wasRetry
      ?{ko:'대단해요! 아까 틀렸던 문제를 전부 고쳤어요. 규칙을 다시 보고 바로 적용한 게 정말 좋아요!',en:'Great job! You fixed every question you missed. You reviewed the rule and applied it straight away!'}
      :{ko:'완벽해요! 이번 문제를 전부 맞혔어요. 아주 잘했어요!',en:'Perfect! You got every question right. Excellent work!'},
    actions:[]
  });
  coach.refresh();
  setTimeout(function(){
    var first=document.querySelector('#aiCoachChoices .study-v2-ai-prompt');
    if(first&&successPending){
      first.click();
      successPending=false;
      celebrate();
    }
  },150);
}
function registerReview(data){
  pending=data;
  var count=data.mistakes.length,kind=classify(data.title,data.mistakes),second=data.round>0;
  var intro=explanation(kind,count,second);
  if(second){var answers=answerSummary(data.mistakes);if(answers)intro+=' '+answers;}
  coach.registerCapability({
    id:'remediation_pending',
    score:10000,
    available:function(){return !!(pending&&pending.mistakes&&pending.mistakes.length);},
    label:{ko:count+'개 틀린 문제 다시 보기',en:'Review '+count+' missed '+(count===1?'question':'questions')},
    response:intro,
    actions:[{
      label:{ko:'틀린 '+count+'문제만 다시 풀기',en:'Retry only the '+count+' missed '+(count===1?'question':'questions')},
      run:function(){
        var items=makeRetryItems(data.mistakes,(data.round||0)+1);
        return{
          type:'coach_remediation_retry',
          title:ko()?'틀린 문제 다시 풀기':'Retry missed questions',
          message:ko()?'좋아요. 아까 틀린 문제만 다시 해볼게요.':'Good. Let’s retry only the ones you missed.',
          items:items
        };
      }
    }]
  });
  coach.refresh();
  setTimeout(function(){
    var first=document.querySelector('#aiCoachChoices .study-v2-ai-prompt');
    if(first&&pending===data)first.click();
  },120);
}
function beginIfNeeded(){
  if(!overlayOpen())return;
  if(active)return;
  active={title:practiceTitle(),answered:0,mistakes:[],round:0,retry:false};
}

global.addEventListener('willena:activity-answer',function(event){
  if(!overlayOpen())return;
  beginIfNeeded();
  if(!active)return;
  var detail=event&&event.detail||{},activity=detail.activity||{},result=detail.result||{};
  active.answered++;
  if(retryFlag(activity)){
    active.retry=true;
    active.round=Math.max(active.round,Number(activity.metadata&&activity.metadata.coach_remediation_round)||1);
    if(!active.title)active.title=practiceTitle();
  }
  if(!result.correct)active.mistakes.push({activity:clone(activity),result:clone(result)});
});

document.addEventListener('click',function(e){
  var btn=e.target&&e.target.closest&&e.target.closest('#aiCoachPracticeNext');
  if(!btn||!active)return;
  var label=text(btn.textContent).toLowerCase();
  if(label!=='finish'&&label!=='완료')return;
  var finished=active;active=null;
  setTimeout(function(){
    if(!finished.mistakes.length){
      pending=null;
      registerSuccess({title:finished.title,retry:finished.retry,round:finished.round,answered:finished.answered});
      return;
    }
    registerReview({title:finished.title||practiceTitle(),mistakes:finished.mistakes,round:finished.retry?finished.round:0});
  },180);
},true);

document.addEventListener('click',function(e){
  var back=e.target&&e.target.closest&&e.target.closest('#aiCoachPracticeBack');
  if(back){active=null;}
},true);
})(window);
