(function(global){
'use strict';
var PREF='willena-study-v2-spelling-input:v1';
var DB='https://gxwfsqxyuufqtitspfqg.supabase.co';
var KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var activeKeyHandler=null;
function node(tag,className,text){var n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
function pref(){try{return localStorage.getItem(PREF)==='keyboard'?'keyboard':'tiles';}catch(_){return'tiles';}}
function savePref(v){try{localStorage.setItem(PREF,v);}catch(_){}}
function cleanWordLength(w){return String(w||'').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g,'').length;}
function lettersOnly(v){return String(v==null?'':v).toLowerCase().replace(/[^a-zà-öø-öø-ÿ]/g,'');}
function answerWords(engine,tokens,wordLengths){
  if(Array.isArray(wordLengths)&&wordLengths.length>1)return wordLengths.map(Number).filter(function(n){return n>0;});
  var ans=engine&&engine.current&&engine.current.answer;
  if(Array.isArray(ans))ans=ans.join(' ');
  var words=String(ans==null?'':ans).trim().split(/\s+/).filter(Boolean);
  var total=Array.isArray(tokens)?tokens.length:0,fromAnswer=words.map(cleanWordLength).filter(function(n){return n>0;});
  var sum=fromAnswer.reduce(function(a,b){return a+b;},0);
  return fromAnswer.length>1&&sum===total?fromAnswer:[total];
}
async function lexicalPhrase(engine,tokens){
  var a=engine&&engine.current||{},id=a.sourceType==='lexical_entry'&&a.sourceId?a.sourceId:null;if(!id)return null;
  try{
    var url=DB+'/rest/v1/lexical_entries?select=canonical_text&id=eq.'+encodeURIComponent(id)+'&limit=1';
    var r=await fetch(url,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'});if(!r.ok)return null;
    var rows=await r.json(),phrase=rows&&rows[0]&&rows[0].canonical_text;if(!phrase)return null;
    phrase=String(phrase).trim();
    var parts=phrase.split(/\s+/).filter(Boolean),lengths=parts.map(cleanWordLength).filter(function(n){return n>0;}),total=(tokens||[]).length,sum=lengths.reduce(function(a,b){return a+b;},0);
    return lengths.length>1&&sum===total?{lengths:lengths,phrase:phrase}:null;
  }catch(_){return null;}
}
function cleanup(){if(activeKeyHandler){document.removeEventListener('keydown',activeKeyHandler,true);activeKeyHandler=null;}}
function install(){
  if(!global.WillenaActivityEngine||!global.WillenaActivityEngine.prototype)return false;
  var proto=global.WillenaActivityEngine.prototype;if(proto.__v2SpellingInput)return true;proto.__v2SpellingInput=true;
  var originalSetActivity=proto.setActivity;
  proto.setActivity=function(raw){cleanup();return originalSetActivity.call(this,raw);};
  proto.renderLetterOrder=function(card,tokens,wordLengths){
    cleanup();
    var self=this,chosen=[],bank=(tokens||[]).map(function(t,i){return{text:String(t),id:i+'-'+Math.random()};});bank=bank.slice().sort(function(){return Math.random()-.5;});
    var lengths=answerWords(self,tokens,wordLengths),wrap=node('div','activity-letter-order'),controls=node('div','activity-spelling-controls'),tilesBtn=node('button','activity-spelling-mode','글자 버튼'),keyBtn=node('button','activity-spelling-mode','키보드'),slots=node('div','activity-letter-slots'),pool=node('div','activity-letter-bank'),hint=node('div','activity-spelling-keyboard-hint','실제 키보드로 입력하세요 · Backspace 삭제 · Enter 확인');
    if(self.current&&self.current.response&&lengths.length>1)self.current.response.wordLengths=lengths.slice();
    tilesBtn.type=keyBtn.type='button';controls.appendChild(tilesBtn);controls.appendChild(keyBtn);wrap.appendChild(controls);wrap.appendChild(slots);wrap.appendChild(pool);wrap.appendChild(hint);card.appendChild(wrap);
    var mode=pref();
    function setMode(next){mode=next;savePref(next);wrap.dataset.inputMode=next;tilesBtn.classList.toggle('is-active',next==='tiles');keyBtn.classList.toggle('is-active',next==='keyboard');draw();}
    function drawSlots(){slots.innerHTML='';var cursor=0;lengths.forEach(function(length,wordIndex){var row=node('div','activity-letter-word');for(var i=0;i<Number(length||0);i++){var slot=node('button','activity-letter-slot',chosen[cursor]?chosen[cursor].text.toUpperCase():'');slot.type='button';slot.disabled=!chosen[cursor];(function(index){slot.addEventListener('click',function(){if(mode==='tiles'&&chosen[index]){chosen.splice(index,1);draw();}});})(cursor);row.appendChild(slot);cursor++;}slots.appendChild(row);if(wordIndex<lengths.length-1){var space=node('span','activity-letter-space');space.setAttribute('aria-hidden','true');slots.appendChild(space);}});}
    function draw(){drawSlots();pool.innerHTML='';if(mode==='tiles'){bank.filter(function(item){return chosen.indexOf(item)<0;}).forEach(function(item){var b=node('button','activity-letter-tile',item.text.toUpperCase());b.type='button';b.addEventListener('click',function(){chosen.push(item);draw();});pool.appendChild(b);});}self.selected=chosen.map(function(item){return item.text;});self.setCheckEnabled(card,chosen.length===bank.length);}
    function choosePhysicalLetter(letter){if(chosen.length>=bank.length)return;var upper=String(letter).toUpperCase(),item=bank.find(function(x){return chosen.indexOf(x)<0&&String(x.text).toUpperCase()===upper;});if(item){chosen.push(item);draw();}}
    activeKeyHandler=function(e){
      if(mode!=='keyboard'||!document.body.contains(card))return;
      var tag=e.target&&e.target.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||(e.target&&e.target.isContentEditable))return;
      if(/^[a-zA-Z]$/.test(e.key)){e.preventDefault();choosePhysicalLetter(e.key);return;}
      if(e.key==='Backspace'){e.preventDefault();chosen.pop();draw();return;}
      if(e.key===' '){e.preventDefault();return;}
      if(e.key==='Enter'){var check=card.querySelector('.activity-check');if(check&&!check.disabled){e.preventDefault();check.click();}}
    };
    document.addEventListener('keydown',activeKeyHandler,true);
    tilesBtn.addEventListener('click',function(){setMode('tiles');});keyBtn.addEventListener('click',function(){setMode('keyboard');});
    setMode(mode);
    if(lengths.length===1){lexicalPhrase(self,tokens).then(function(found){if(found&&document.body.contains(card)){lengths=found.lengths;if(self.current&&self.current.response)self.current.response.wordLengths=lengths.slice();if(self.current&&lettersOnly(self.current.answer)===lettersOnly(found.phrase))self.current.answer=found.phrase;draw();}});}
  };
  return true;
}
var tries=0,t=setInterval(function(){tries++;if(install()||tries>200)clearInterval(t);},20);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
