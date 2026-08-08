(function(global){
'use strict';
function el(tag,className,text){var node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;}
function shuffle(items){return items.slice().sort(function(){return Math.random()-.5;});}
function ActivityEngine(root,options){this.root=root;this.options=options||{};this.current=null;this.selected=null;}
ActivityEngine.prototype.setActivity=function(raw){
 var schema=global.WillenaActivitySchema;if(!schema)throw new Error('WillenaActivitySchema is not loaded');
 this.current=schema.normalize(raw);this.selected=null;this.render();return this.current;
};
ActivityEngine.prototype.render=function(){
 var a=this.current;if(!a||!this.root)return;
 this.root.innerHTML='';
 var card=el('section','activity-card');card.dataset.activityId=a.id;
 var context=a.stimulus&&a.stimulus.context;if(context)card.appendChild(el('div','activity-context',context));
 var prompt=el('h2','activity-prompt',a.stimulus&&a.stimulus.prompt||a.q||'');card.appendChild(prompt);
 if(a.stimulus&&a.stimulus.type==='audio'){
  var listen=el('button','activity-audio','🔊 Play audio');listen.type='button';
  listen.addEventListener('click',function(){var text=a.stimulus.text||a.stimulus.prompt;if(!text||!global.speechSynthesis)return;global.speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.9;global.speechSynthesis.speak(u);});
  card.appendChild(listen);
 }
 var response=a.response||{},type=response.type;
 if(type==='letter_order')this.renderLetterOrder(card,response.tokens||[],response.wordLengths||[]);
 else if(type==='sentence_unscramble'||type==='token_order')this.renderTokenOrder(card,response.tokens||[]);
 else if(type==='typed_answer'||type==='gap_fill_text')this.renderTextInput(card,type);
 else this.renderChoices(card,response.choices||[]);
 var feedback=el('div','activity-feedback');feedback.hidden=true;card.appendChild(feedback);
 var actions=el('div','activity-actions');var check=el('button','activity-check','Check');check.type='button';check.disabled=true;actions.appendChild(check);card.appendChild(actions);
 var self=this;check.addEventListener('click',function(){self.check(feedback,check);});
 this.root.appendChild(card);
};
ActivityEngine.prototype.renderChoices=function(card,choices){
 var wrap=el('div','activity-choices'),self=this;
 shuffle(choices).forEach(function(choice){var b=el('button','activity-choice',String(choice));b.type='button';b.addEventListener('click',function(){wrap.querySelectorAll('button').forEach(function(x){x.classList.remove('is-selected');});b.classList.add('is-selected');self.selected=choice;card.querySelector('.activity-check').disabled=false;});wrap.appendChild(b);});
 card.appendChild(wrap);
};
ActivityEngine.prototype.renderTextInput=function(card,type){
 var input=el('input','activity-input');input.type='text';input.autocomplete='off';input.setAttribute('autocorrect','off');input.setAttribute('autocapitalize','none');input.spellcheck=false;input.placeholder=type==='gap_fill_text'?'Type the missing word or phrase':'Type your answer';var self=this;input.addEventListener('input',function(){self.selected=input.value;card.querySelector('.activity-check').disabled=!input.value.trim();});input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!card.querySelector('.activity-check').disabled)card.querySelector('.activity-check').click();});card.appendChild(input);
};
ActivityEngine.prototype.renderTokenOrder=function(card,tokens){
 var self=this,chosen=[],bank=shuffle(tokens.map(function(t,i){return{text:String(t),id:i+'-'+Math.random()};}));
 var answer=el('div','activity-token-answer'),pool=el('div','activity-token-bank');card.appendChild(answer);card.appendChild(pool);
 function draw(){answer.innerHTML='';pool.innerHTML='';chosen.forEach(function(item,index){var b=el('button','activity-token is-chosen',item.text);b.type='button';b.addEventListener('click',function(){chosen.splice(index,1);draw();});answer.appendChild(b);});bank.filter(function(item){return chosen.indexOf(item)<0;}).forEach(function(item){var b=el('button','activity-token',item.text);b.type='button';b.addEventListener('click',function(){chosen.push(item);draw();});pool.appendChild(b);});self.selected=chosen.map(function(item){return item.text;});card.querySelector('.activity-check').disabled=chosen.length!==bank.length;}
 draw();
};
ActivityEngine.prototype.renderLetterOrder=function(card,tokens,wordLengths){
 var self=this,chosen=[],bank=shuffle(tokens.map(function(t,i){return{text:String(t),id:i+'-'+Math.random()};}));
 var wrap=el('div','activity-letter-order'),slots=el('div','activity-letter-slots'),pool=el('div','activity-letter-bank');wrap.appendChild(slots);wrap.appendChild(pool);card.appendChild(wrap);
 var lengths=Array.isArray(wordLengths)&&wordLengths.length?wordLengths.slice():[tokens.length];
 function drawSlots(){slots.innerHTML='';var cursor=0;lengths.forEach(function(length,wordIndex){var row=el('div','activity-letter-word');for(var i=0;i<Number(length||0);i++){var slot=el('button','activity-letter-slot',chosen[cursor]?chosen[cursor].text:'');slot.type='button';slot.disabled=!chosen[cursor];(function(index){slot.addEventListener('click',function(){if(chosen[index]){chosen.splice(index,1);draw();}});})(cursor);row.appendChild(slot);cursor++;}slots.appendChild(row);if(wordIndex<lengths.length-1)slots.appendChild(el('span','activity-letter-space',' '));});}
 function draw(){drawSlots();pool.innerHTML='';bank.filter(function(item){return chosen.indexOf(item)<0;}).forEach(function(item){var b=el('button','activity-letter-tile',item.text.toUpperCase());b.type='button';b.addEventListener('click',function(){chosen.push(item);draw();});pool.appendChild(b);});self.selected=chosen.map(function(item){return item.text;});card.querySelector('.activity-check').disabled=chosen.length!==bank.length;}
 draw();
};
ActivityEngine.prototype.check=function(feedback,button){
 var scoring=global.WillenaActivityScoring;if(!scoring)throw new Error('WillenaActivityScoring is not loaded');
 var result=scoring.score(this.current,this.selected);feedback.hidden=false;feedback.className='activity-feedback '+(result.correct?'is-correct':'is-wrong');feedback.textContent=result.correct?'Correct!':'Not quite. Correct answer: '+(Array.isArray(result.answer)?result.answer.join(' '):result.answer);button.disabled=true;
 if(typeof this.options.onAnswer==='function')this.options.onAnswer({activity:this.current,result:result});
};
global.WillenaActivityEngine=ActivityEngine;
})(window);
