(function(){
'use strict';
if(location.hostname!=='staging.willenaenglish.com'){
 document.body.innerHTML='<main style="font-family:system-ui;padding:40px"><h1>Staging only</h1><p>This speaking lab is available only on staging.</p></main>';
 return;
}
var host=document.getElementById('speakingHost'),stateBox=document.getElementById('speakingState'),eventBox=document.getElementById('speakingEvent'),lang='en',instance=null;
function renderState(state){if(stateBox)stateBox.textContent=JSON.stringify(state,null,2)}
function showEvent(title,detail){if(!eventBox)return;eventBox.innerHTML='<strong>'+title+'</strong><pre></pre>';eventBox.querySelector('pre').textContent=JSON.stringify(detail,null,2)}
function mount(seed){
 if(instance)instance.destroy();
 instance=window.WillenaAssessmentSpeaking.create({
  host:host,
  lang:lang,
  state:seed||{current_level:3},
  onChange:function(state){renderState(state)},
  onVisual:function(detail){showEvent('Visual hook fired — Phase 10 will attach Noto assets here.',detail)},
  onRecord:function(detail){showEvent('Recording hook fired.',detail)},
  onBack:function(state){showEvent('Back hook fired.',state)},
  onComplete:function(state){showEvent('Speaking complete hook fired.',state);renderState(state)}
 });
 renderState(instance.getState());
}
document.getElementById('labLanguage').onclick=function(){lang=lang==='en'?'ko':'en';this.textContent=lang==='en'?'한국어':'English';if(instance)instance.setLanguage(lang)};
document.getElementById('labReset').onclick=function(){showEvent('Lab reset',{});mount({current_level:3})};
document.getElementById('labScenarioGood').onclick=function(){mount({current_level:6,evidence:[{level:5,prompt_id:'demo-a',prompt_index:0,score:4},{level:5,prompt_id:'demo-b',prompt_index:1,score:5},{level:6,prompt_id:'demo-c',prompt_index:0,score:4},{level:6,prompt_id:'demo-d',prompt_index:1,score:4}]})};
document.getElementById('labScenarioCeiling').onclick=function(){mount({current_level:8,evidence:[{level:6,prompt_id:'demo-a',prompt_index:0,score:4},{level:6,prompt_id:'demo-b',prompt_index:1,score:4},{level:8,prompt_id:'demo-c',prompt_index:0,score:1},{level:8,prompt_id:'demo-d',prompt_index:1,score:2}]})};
mount({current_level:3});
})();
