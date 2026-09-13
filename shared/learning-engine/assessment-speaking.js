(function(){
'use strict';

var VERSION=1;
var LEVEL_LABELS={1:'Starter 1',2:'Starter 2',3:'Level 1',4:'Level 2',5:'Level 3',6:'Level 4',7:'Level 5',8:'Level 6',9:'Level 7',10:'Level 8',11:'Level 9',12:'Level 10'};
var RUBRIC=[
 {score:1,label:'1',detail:'Cannot understand / answer'},
 {score:2,label:'2',detail:'Needs substantial help'},
 {score:3,label:'3',detail:'Basic understandable answer'},
 {score:4,label:'4',detail:'Clear complete answer'},
 {score:5,label:'5',detail:'Natural extended answer'}
];
var PROMPTS={
 1:[
  {id:'sp1-hello',text:'Hello. How are you?'},
  {id:'sp1-object',text:'What is it?',visualKey:'starterObject'},
  {id:'sp1-color',text:'What color is it?',visualKey:'color'}
 ],
 2:[
  {id:'sp2-age',text:'How old are you?'},
  {id:'sp2-like',text:'Do you like {food}?',variants:{food:['bananas','pizza','ice cream','apples','chicken','cookies']}},
  {id:'sp2-can',text:'Can you {action}?',variants:{action:['swim','ride a bike','dance','sing','run fast','play soccer']}}
 ],
 3:[
  {id:'sp3-favorite',text:"What's your favorite {thing}?",variants:{thing:['food','animal','color','game','school subject']}},
  {id:'sp3-plural',text:'What are they?',visualKey:'pluralAnimals'},
  {id:'sp3-have',text:'Do you have {thing}?',variants:{thing:['a cat','a dog','a bike','a computer','a brother or sister']}},
  {id:'sp3-weather',text:"What's the weather like today?"}
 ],
 4:[
  {id:'sp4-like',text:'What {food} do you like?',variants:{food:['fruit','food','drink','snack']}},
  {id:'sp4-action',text:'What is she/he doing?',visualKey:'actions'},
  {id:'sp4-count',text:'How many are there?',visualKey:'counting'},
  {id:'sp4-position',text:'Where is the pencil? Put a pencil on / under / next to something.'},
  {id:'sp4-now',text:'What are you doing now?'}
 ],
 5:[
  {id:'sp5-likes',text:'What does your {person} like?',variants:{person:['mom','dad','friend','teacher']}},
  {id:'sp5-routine',text:'What does your {person} do after school/work?',variants:{person:['friend','brother','sister','dad']}},
  {id:'sp5-bag',text:'Are there any {things} in your bag?',variants:{things:['pencils','books','snacks','toys']}},
  {id:'sp5-position',text:'Tell me where the pencil is. Put it under / behind / between / next to something.'},
  {id:'sp5-friend',text:'What does your best friend look like?'}
 ],
 6:[
  {id:'sp6-weekend',text:'What do you want to do this weekend?'},
  {id:'sp6-yesterday',text:'What did you do yesterday?'},
  {id:'sp6-plan',text:'What are you going to do after school?'},
  {id:'sp6-compare',text:'Which is bigger, a {a} or a {b}?',variants:{a:['dog','bus','elephant'],b:['cat','car','horse']}},
  {id:'sp6-advice',text:'What should you do if you have a headache?'}
 ],
 7:[
  {id:'sp7-progressive',text:'What were you doing at {time} yesterday?',variants:{time:['7 p.m.','8 p.m.','lunchtime','after school']}},
  {id:'sp7-past',text:'What is the past tense of {verb}?',variants:{verb:['buy','bring','catch','teach','think','take','wear','leave']}},
  {id:'sp7-experience',text:'Have you ever been to {place}?',variants:{place:['Jeju','Seoul','another country','an amusement park','a zoo']}},
  {id:'sp7-story',text:'Tell me something fun that happened last weekend.'}
 ],
 8:[
  {id:'sp8-duration',text:'How long have you studied English?'},
  {id:'sp8-present-perfect',text:'Tell me about something you have done this week.'},
  {id:'sp8-condition',text:'If it rains this weekend, what will you do?'},
  {id:'sp8-obligation',text:'What do you have to do before school?'},
  {id:'sp8-goal',text:'Tell me about a goal you want to achieve and how you can do it.'}
 ],
 9:[
  {id:'sp9-mind',text:'Tell me about a time you changed your mind about something.'},
  {id:'sp9-rule',text:'If you could change one rule at school, what would you change and why?'},
  {id:'sp9-learning',text:'Which is better for learning: books or videos? Why?'},
  {id:'sp9-mistake',text:'Tell me about a mistake that taught you something.'},
  {id:'sp9-friend',text:'What makes someone a good friend?'}
 ],
 10:[
  {id:'sp10-phones',text:'Do phones help students learn, or distract them? Explain.'},
  {id:'sp10-free-day',text:'What would you do if you had one completely free day?'},
  {id:'sp10-wish',text:'Tell me about something you wish you had done differently.'},
  {id:'sp10-school',text:'What is one problem at school that could be improved?'},
  {id:'sp10-skill',text:'Is it better to be very good at one thing or pretty good at many things? Why?'}
 ],
 11:[
  {id:'sp11-ai',text:'Should students be allowed to use AI for schoolwork? Explain your rules.'},
  {id:'sp11-worry',text:'What is something people your age worry about too much?'},
  {id:'sp11-redesign',text:'If you could redesign the school day, what would you change?'},
  {id:'sp11-trust',text:'What makes information online trustworthy or untrustworthy?'},
  {id:'sp11-practice',text:'Which matters more: talent or practice? Defend your answer.'}
 ],
 12:[
  {id:'sp12-tech',text:'What is one change technology may bring to schools in the next ten years?'},
  {id:'sp12-exams',text:'Should schools focus more on exams or practical skills? Why?'},
  {id:'sp12-decision',text:'Describe a difficult decision and the factors you would consider.'},
  {id:'sp12-disagree',text:'How can people disagree without becoming hostile?'},
  {id:'sp12-policy',text:'Choose a rule or policy you disagree with and make the strongest case for changing it.'}
 ]
};

function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function clone(value){try{return JSON.parse(JSON.stringify(value))}catch(_){return null}}
function cleanEvidence(evidence){
 return(Array.isArray(evidence)?evidence:[]).map(function(x){return{level:Number(x&&x.level),score:Number(x&&x.score),prompt_id:x&&x.prompt_id||null,prompt_index:Number(x&&x.prompt_index),scored_at:x&&x.scored_at||null}}).filter(function(x){return Number.isInteger(x.level)&&x.level>=1&&x.level<=12&&x.score>=1&&x.score<=5});
}
function recommend(evidence){
 var clean=cleanEvidence(evidence);
 if(!clean.length)return{recommended_level:null,confidence:'none',evidence_count:0,levels_tested:[],estimate:null,level_stats:[],summary:'No scored speaking evidence yet.'};
 var byLevel={};
 clean.forEach(function(item){if(!byLevel[item.level])byLevel[item.level]=[];byLevel[item.level].push(item.score)});
 var levels=Object.keys(byLevel).map(Number).sort(function(a,b){return a-b});
 var stats=levels.map(function(level){var scores=byLevel[level],sum=scores.reduce(function(a,b){return a+b},0);return{level:level,count:scores.length,average:sum/scores.length,min:Math.min.apply(null,scores),max:Math.max.apply(null,scores)}});
 var weightedSum=0,totalWeight=0;
 clean.forEach(function(item){var offsets={1:-1.35,2:-.65,3:0,4:.45,5:.8},offset=offsets[item.score]||0,weight=1+(item.level-1)*.035;weightedSum+=(item.level+offset)*weight;totalWeight+=weight});
 var estimate=weightedSum/totalWeight,highest=stats[stats.length-1];
 if(highest&&highest.count>=2&&highest.average<2.5)estimate=Math.min(estimate,highest.level-.5);
 if(highest&&highest.count>=2&&highest.average>=4.25)estimate=Math.max(estimate,highest.level+.35);
 var recommended=clamp(Math.round(estimate),1,12),count=clean.length,spread=levels.length,confidence=count>=6&&spread>=2?'high':count>=3?'medium':'low';
 return{recommended_level:recommended,confidence:confidence,evidence_count:count,levels_tested:levels,estimate:Number(estimate.toFixed(2)),level_stats:stats,summary:count+' scored response'+(count===1?'':'s')+' across '+spread+' level'+(spread===1?'':'s')+'; estimated speaking level '+estimate.toFixed(1)+'.'};
}
function emptyState(seed){
 seed=seed||{};
 var state={version:VERSION,current_level:clamp(Number(seed.current_level)||3,1,12),evidence:cleanEvidence(seed.evidence),teacher_level:Number(seed.teacher_level)||null,teacher_selected_start_level:Number(seed.teacher_selected_start_level)||null,teacher_start_overridden:seed.teacher_start_overridden===true,teacher_notes:String(seed.teacher_notes||''),updated_at:new Date().toISOString()};
 state.recommendation=recommend(state.evidence);
 if(!state.teacher_start_overridden&&!state.teacher_selected_start_level&&state.recommendation.recommended_level)state.teacher_selected_start_level=state.recommendation.recommended_level;
 return state;
}
function resolvePrompt(prompt,variantState){
 prompt=prompt||{};var text=String(prompt.text||''),variants=prompt.variants||{};
 Object.keys(variants).forEach(function(key){var values=variants[key]||[],index=Number(variantState[prompt.id+':'+key])||0;if(values.length)text=text.replace('{'+key+'}',values[index%values.length])});
 return text;
}
function renderOptions(selected,blank){var html='<option value="">'+blank+'</option>';for(var i=1;i<=12;i++)html+='<option value="'+i+'" '+(Number(selected)===i?'selected':'')+'>'+LEVEL_LABELS[i]+'</option>';return html}
function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

function create(options){
 options=options||{};var host=options.host;if(!host)throw new Error('Speaking assessment host is required');
 var lang=options.lang==='en'?'en':'ko',state=emptyState(options.state),variantState={},destroyed=false;
 function tx(ko,en){return lang==='ko'?ko:en}
 function emit(){state.updated_at=new Date().toISOString();state.recommendation=recommend(state.evidence);if(!state.teacher_start_overridden&&state.recommendation.recommended_level)state.teacher_selected_start_level=state.recommendation.recommended_level;if(typeof options.onChange==='function')options.onChange(clone(state))}
 function selected(prompt){for(var i=0;i<state.evidence.length;i++)if(state.evidence[i].level===state.current_level&&state.evidence[i].prompt_id===prompt.id)return state.evidence[i].score;return null}
 function score(prompt,index,value){state.evidence=state.evidence.filter(function(x){return!(x.level===state.current_level&&x.prompt_id===prompt.id)});state.evidence.push({level:state.current_level,prompt_id:prompt.id,prompt_index:index,score:Number(value),scored_at:new Date().toISOString()});emit();render()}
 function changeVariant(prompt){Object.keys(prompt.variants||{}).forEach(function(key){var values=prompt.variants[key]||[],k=prompt.id+':'+key;variantState[k]=values.length?((Number(variantState[k])||0)+1)%values.length:0});render()}
 function setLevel(value){state.current_level=clamp(Number(value)||state.current_level,1,12);emit();render()}
 function visual(prompt,index){var detail={level:state.current_level,prompt_id:prompt.id,prompt_index:index,visual_key:prompt.visualKey,prompt:resolvePrompt(prompt,variantState)};if(typeof options.onVisual==='function')options.onVisual(detail);try{window.dispatchEvent(new CustomEvent('willena:speaking-visual-request',{detail:detail}))}catch(_){}}
 function record(prompt,index,button){var detail={level:state.current_level,prompt_id:prompt.id,prompt_index:index,prompt:resolvePrompt(prompt,variantState)};if(typeof options.onRecord==='function')options.onRecord(detail);try{window.dispatchEvent(new CustomEvent('willena:speaking-record-request',{detail:detail}))}catch(_){}if(button){button.textContent=tx('녹음 요청됨','Record requested');setTimeout(function(){if(!destroyed&&button.isConnected)button.textContent=tx('● 녹음','● Record')},900)}}
 function promptCard(prompt,index){var scoreValue=selected(prompt),rubric=RUBRIC.map(function(r){return'<button type="button" data-score="'+r.score+'" data-index="'+index+'" class="'+(scoreValue===r.score?'is-selected':'')+'" title="'+escapeHtml(r.detail)+'">'+r.label+'</button>'}).join('');return'<article class="willena-speaking-prompt"><div class="willena-speaking-prompt-row"><div class="willena-speaking-prompt-text">'+escapeHtml(resolvePrompt(prompt,variantState))+'</div><div class="willena-speaking-tools">'+(prompt.variants?'<button type="button" data-variant="'+index+'">↻ '+tx('바꾸기','Change')+'</button>':'')+(prompt.visualKey?'<button type="button" data-visual="'+index+'">▣ '+tx('그림','Visual')+'</button>':'')+'</div></div><div class="willena-speaking-rubric">'+rubric+'</div><div class="willena-speaking-record"><button type="button" data-record="'+index+'">● '+tx('녹음','Record')+'</button><span>'+tx('선택 사항 · 녹음 모듈 연결용','Optional · recording hook')+'</span></div></article>'}
 function render(){
  if(destroyed)return;var prompts=PROMPTS[state.current_level]||[],rec=state.recommendation,recLabel=rec.recommended_level?LEVEL_LABELS[rec.recommended_level]:tx('아직 없음','Not enough evidence');
  host.innerHTML='<section class="willena-speaking"><header class="willena-speaking-header"><div><span>'+tx('공유 말하기 모듈','Shared speaking module')+'</span><h2>'+tx('말하기 레벨 확인','Speaking level check')+'</h2></div><select data-jump aria-label="Speaking level">'+Array.from({length:12},function(_,i){var n=i+1;return'<option value="'+n+'" '+(n===state.current_level?'selected':'')+'>'+LEVEL_LABELS[n]+'</option>'}).join('')+'</select></header><div class="willena-speaking-nav"><button type="button" data-prev '+(state.current_level===1?'disabled':'')+'>← '+tx('이전','Previous')+'</button><strong>'+LEVEL_LABELS[state.current_level]+'</strong><button type="button" data-next '+(state.current_level===12?'disabled':'')+'>'+tx('다음','Next')+' →</button></div><p class="willena-speaking-help">'+tx('필요한 질문만 사용하세요. 채점하지 않은 질문은 결과에 영향을 주지 않습니다.','Use only the prompts you need. Unscored prompts do not affect the result.')+'</p><div class="willena-speaking-prompts">'+prompts.map(promptCard).join('')+'</div><section class="willena-speaking-decision"><div class="willena-speaking-rec"><span>'+tx('추천 시작 레벨','Recommended start')+'</span><strong>'+recLabel+'</strong><small>'+escapeHtml(rec.summary)+'</small></div><label>'+tx('선생님 말하기 판단','Teacher speaking level')+'<select data-teacher-level>'+renderOptions(state.teacher_level,'—')+'</select></label><label>'+tx('컴퓨터 테스트 시작 레벨','Computer test start level')+'<select data-start-level>'+renderOptions(state.teacher_selected_start_level,tx('추천 사용','Use recommendation'))+'</select><small>'+(state.teacher_start_overridden?tx('선생님 재정의','Teacher override'):tx('추천 자동 적용','Following recommendation'))+'</small></label><label>'+tx('메모','Notes')+'<textarea data-notes rows="3">'+escapeHtml(state.teacher_notes)+'</textarea></label></section><footer class="willena-speaking-actions"><button type="button" data-back>'+tx('뒤로','Back')+'</button><button type="button" data-complete '+(!state.teacher_selected_start_level?'disabled':'')+'>'+tx('말하기 평가 완료','Complete speaking')+'</button></footer></section>';
  bind();
 }
 function bind(){
  var prompts=PROMPTS[state.current_level]||[];
  var prev=host.querySelector('[data-prev]'),next=host.querySelector('[data-next]'),jump=host.querySelector('[data-jump]');if(prev)prev.onclick=function(){setLevel(state.current_level-1)};if(next)next.onclick=function(){setLevel(state.current_level+1)};if(jump)jump.onchange=function(){setLevel(this.value)};
  Array.prototype.forEach.call(host.querySelectorAll('[data-score]'),function(btn){btn.onclick=function(){var index=Number(btn.getAttribute('data-index')),prompt=prompts[index];if(prompt)score(prompt,index,btn.getAttribute('data-score'))}});
  Array.prototype.forEach.call(host.querySelectorAll('[data-variant]'),function(btn){btn.onclick=function(){var prompt=prompts[Number(btn.getAttribute('data-variant'))];if(prompt)changeVariant(prompt)}});
  Array.prototype.forEach.call(host.querySelectorAll('[data-visual]'),function(btn){btn.onclick=function(){var index=Number(btn.getAttribute('data-visual')),prompt=prompts[index];if(prompt)visual(prompt,index)}});
  Array.prototype.forEach.call(host.querySelectorAll('[data-record]'),function(btn){btn.onclick=function(){var index=Number(btn.getAttribute('data-record')),prompt=prompts[index];if(prompt)record(prompt,index,btn)}});
  var teacher=host.querySelector('[data-teacher-level]');if(teacher)teacher.onchange=function(){state.teacher_level=this.value?Number(this.value):null;emit()};
  var start=host.querySelector('[data-start-level]');if(start)start.onchange=function(){if(this.value){state.teacher_selected_start_level=Number(this.value);state.teacher_start_overridden=true}else{state.teacher_start_overridden=false;state.teacher_selected_start_level=state.recommendation.recommended_level||null}emit();render()};
  var notes=host.querySelector('[data-notes]');if(notes)notes.oninput=function(){state.teacher_notes=this.value;emit()};
  var back=host.querySelector('[data-back]');if(back)back.onclick=function(){if(typeof options.onBack==='function')options.onBack(clone(state))};
  var complete=host.querySelector('[data-complete]');if(complete)complete.onclick=function(){if(typeof options.onComplete==='function')options.onComplete(clone(state));try{window.dispatchEvent(new CustomEvent('willena:speaking-complete',{detail:{speaking:clone(state)}}))}catch(_){}};
 }
 render();
 return{getState:function(){return clone(state)},setLevel:setLevel,setLanguage:function(value){lang=value==='en'?'en':'ko';render()},destroy:function(){destroyed=true;host.innerHTML=''}};
}

window.WillenaAssessmentSpeaking={version:VERSION,levelLabels:clone(LEVEL_LABELS),rubric:clone(RUBRIC),prompts:clone(PROMPTS),recommend:recommend,createState:emptyState,create:create};
})();
