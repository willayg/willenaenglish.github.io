(function(){
'use strict';
var root=document.querySelector('#app');
var registry=window.WillenaAssessmentQuestionRegistry;
var contract=window.WillenaAssessmentRendererContract;
var assets=window.WillenaAssessmentAssets;
if(!root||!registry||!contract||!assets)return;
function ensureStyle(){
  if(document.getElementById('visualChoiceEnhancerStyle'))return;
  var style=document.createElement('style');
  style.id='visualChoiceEnhancerStyle';
  style.textContent='.choices.has-visual-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.choice.choice-visual{min-height:150px;display:flex;align-items:center;justify-content:center;padding:18px}.choice.choice-visual img{display:block;width:min(118px,70%);height:118px;object-fit:contain;pointer-events:none}.choice.choice-visual .choice-visual-label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:520px){.choice.choice-visual{min-height:132px}.choice.choice-visual img{width:min(102px,72%);height:102px}}';
  document.head.appendChild(style);
}
function optionSrc(option){return option.src||assets.resolve(option.assetKey);}
function enhance(){
  var card=root.querySelector('.question-card[data-question-id]');
  if(!card||card.dataset.visualChoicesReady==='1')return;
  var question=registry.get(card.getAttribute('data-question-id'));
  if(!question)return;
  var view=contract.questionView(question);
  if(!contract.hasVisualChoices(view))return;
  var choiceBox=card.querySelector('.choices');
  if(!choiceBox)return;
  var buttons=[].slice.call(choiceBox.querySelectorAll('.choice[data-value]'));
  var visualCount=0;
  buttons.forEach(function(button){
    var value=String(button.getAttribute('data-value')||'');
    var option=view.options.find(function(item){return String(item.value)===value;});
    if(!option)return;
    var src=optionSrc(option);
    if(!src)return;
    visualCount++;
    button.classList.add('choice-visual');
    button.setAttribute('aria-label',option.alt||option.label||option.value);
    button.innerHTML='<img src="'+src+'" alt=""><span class="choice-visual-label">'+escapeHtml(option.label||option.value)+'</span>';
  });
  if(visualCount){choiceBox.classList.add('has-visual-choices');card.dataset.visualChoicesReady='1';}
}
function escapeHtml(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
ensureStyle();
var pending=false;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;enhance();});}
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
window.addEventListener('willena:assessment-bank-ready',schedule);
schedule();
})();
