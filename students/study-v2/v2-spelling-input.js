(function(global){
'use strict';
var PREF='willena-study-v2-spelling-input:v1';
var DB='https://gxwfsqxyuufqtitspfqg.supabase.co';
var KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var LOW_LEVEL_INTERNAL_MAX=4;
var LOW_LEVEL_PUBLIC_MAX=2;
var activeKeyHandler=null;
var bookLevelCache={};

function node(tag,className,text){var n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
function pref(){try{return localStorage.getItem(PREF)==='keyboard'?'keyboard':'tiles';}catch(_){return'tiles';}}
function savePref(v){try{localStorage.setItem(PREF,v);}catch(_){}}
function cleanWordLength(w){return String(w||'').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g,'').length;}
function lettersOnly(v){return String(v==null?'':v).toLowerCase().replace(/[^a-z]/g,'');}
function answerWords(engine,tokens,wordLengths){
  if(Array.isArray(wordLengths)&&wordLengths.length>1)return wordLengths.map(Number).filter(function(n){return n>0;});
  var ans=engine&&engine.current&&engine.current.answer;
  if(Array.isArray(ans))ans=ans.join(' ');
  var words=String(ans==null?'':ans).trim().split(/\s+/).filter(Boolean);
  var total=Array.isArray(tokens)?tokens.length:0,fromAnswer=words.map(cleanWordLength).filter(function(n){return n>0;});
  var sum=fromAnswer.reduce(function(a,b){return a+b;},0);
  return fromAnswer.length>1&&sum===total?fromAnswer:[total];
}

function wordAnswer(engine,tokens){
  var ans=engine&&engine.current&&engine.current.answer;
  if(Array.isArray(ans))ans=ans.join(' ');
  var cleaned=lettersOnly(ans);
  if(cleaned)return cleaned;
  return lettersOnly((tokens||[]).join(''));
}

function numberFromMeta(meta,keys){
  for(var i=0;i<keys.length;i++){
    var raw=meta&&meta[keys[i]];
    if(raw==null||raw==='')continue;
    var n=Number(raw);
    if(Number.isFinite(n))return n;
  }
  return null;
}

function levelInfoFromMeta(meta){
  meta=meta||{};
  var internal=numberFromMeta(meta,['internal_level','internalLevel','willena_internal_level','level_internal']);
  var pub=numberFromMeta(meta,['public_level','publicLevel','willena_public_level','level_public']);
  return{internal:internal,publicLevel:pub};
}

function isLowLevelInfo(info){
  if(!info)return false;
  if(info.internal!=null)return info.internal<=LOW_LEVEL_INTERNAL_MAX;
  if(info.publicLevel!=null)return info.publicLevel<=LOW_LEVEL_PUBLIC_MAX;
  return false;
}

async function fetchBookLevel(engine){
  var current=engine&&engine.current||{},meta=current.metadata||{};
  var local=levelInfoFromMeta(meta);
  if(local.internal!=null||local.publicLevel!=null)return local;
  var bookId=meta.book_id||current.book_id||current.bookId||'';
  if(!bookId)return local;
  if(bookLevelCache[bookId])return bookLevelCache[bookId];
  bookLevelCache[bookId]=(async function(){
    try{
      var url=DB+'/rest/v1/content_books?id=eq.'+encodeURIComponent(bookId)+'&select=id,metadata&limit=1';
      var r=await fetch(url,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'});
      if(!r.ok)return local;
      var rows=await r.json(),row=rows&&rows[0]||{},m=row.metadata||{};
      return levelInfoFromMeta(m);
    }catch(_){return local;}
  })();
  return bookLevelCache[bookId];
}

var CURATED_CHUNKS={
  igloo:['ig','loo'],rabbit:['rab','bit'],window:['win','dow'],teacher:['tea','cher'],banana:['ba','na','na'],
  apple:['ap','ple'],tiger:['ti','ger'],lion:['li','on'],monkey:['mon','key'],zebra:['ze','bra'],
  pencil:['pen','cil'],eraser:['e','ra','ser'],table:['ta','ble'],chair:['chair'],school:['school'],
  happy:['hap','py'],funny:['fun','ny'],sunny:['sun','ny'],rainy:['rain','y'],
  mother:['moth','er'],father:['fa','ther'],sister:['sis','ter'],brother:['bro','ther'],
  water:['wa','ter'],pizza:['piz','za'],cookie:['cook','ie'],orange:['or','ange'],
  purple:['pur','ple'],yellow:['yel','low'],seven:['sev','en'],eight:['eight'],
  eleven:['e','lev','en'],twelve:['twelve']
};

function fallbackChunks(word){
  word=lettersOnly(word);
  if(word.length<=3)return[word];
  var vowels='aeiouy',parts=[],start=0,i=1;
  while(i<word.length-1){
    var prev=word[i-1],cur=word[i],next=word[i+1];
    if(vowels.indexOf(prev)>=0&&vowels.indexOf(cur)<0&&vowels.indexOf(next)>=0){
      parts.push(word.slice(start,i));start=i;i+=2;continue;
    }
    if(vowels.indexOf(prev)<0&&vowels.indexOf(cur)>=0&&vowels.indexOf(next)<0&&i-start>=2){
      var next2=word[i+2]||'';
      if(next2&&vowels.indexOf(next2)>=0){parts.push(word.slice(start,i));start=i;}
    }
    i++;
  }
  parts.push(word.slice(start));
  parts=parts.filter(Boolean);
  if(parts.length===1&&word.length>=5){var cut=Math.ceil(word.length/2);parts=[word.slice(0,cut),word.slice(cut)];}
  return parts;
}

function chunkWord(word){
  word=lettersOnly(word);
  if(!word)return[];
  return CURATED_CHUNKS[word]?CURATED_CHUNKS[word].slice():fallbackChunks(word);
}

function buildLowLevelChunks(engine,tokens){
  var ans=engine&&engine.current&&engine.current.answer;
  if(Array.isArray(ans))ans=ans.join(' ');
  var words=String(ans==null?'':ans).trim().split(/\s+/).map(lettersOnly).filter(Boolean);
  if(!words.length){var single=wordAnswer(engine,tokens);words=single?[single]:[];}
  var out=[];
  words.forEach(function(w,idx){chunkWord(w).forEach(function(c){if(c)out.push(c);});if(idx<words.length-1)out.push(' ');});
  return out.filter(function(x){return x!==' ';});
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
    var self=this,chosen=[],originalTokens=(tokens||[]).map(function(t){return String(t);}),lowLevel=false;
    var tokenSet=originalTokens.slice();
    var lengths=answerWords(self,originalTokens,wordLengths),wrap=node('div','activity-letter-order'),controls=node('div','activity-spelling-controls'),tilesBtn=node('button','activity-spelling-mode','글자 버튼'),keyBtn=node('button','activity-spelling-mode','키보드'),slots=node('div','activity-letter-slots'),pool=node('div','activity-letter-bank'),hint=node('div','activity-spelling-keyboard-hint','실제 키보드로 입력하세요 · Backspace 삭제 · Enter 확인');
    var bank=[];
    function rebuildBank(){bank=tokenSet.map(function(t,i){return{text:String(t),id:i+'-'+Math.random()};}).sort(function(){return Math.random()-.5;});chosen=[];}
    rebuildBank();
    if(self.current&&self.current.response&&lengths.length>1)self.current.response.wordLengths=lengths.slice();
    tilesBtn.type=keyBtn.type='button';controls.appendChild(tilesBtn);controls.appendChild(keyBtn);wrap.appendChild(controls);wrap.appendChild(slots);wrap.appendChild(pool);wrap.appendChild(hint);card.appendChild(wrap);
    var mode=pref();
    function setMode(next){mode=next;savePref(next);wrap.dataset.inputMode=next;tilesBtn.classList.toggle('is-active',next==='tiles');keyBtn.classList.toggle('is-active',next==='keyboard');draw();}
    function drawSlots(){
      slots.innerHTML='';
      if(lowLevel){
        var row=node('div','activity-letter-word');
        tokenSet.forEach(function(_,index){var slot=node('button','activity-letter-slot activity-chunk-slot',chosen[index]?chosen[index].text.toUpperCase():'');slot.type='button';slot.disabled=!chosen[index];(function(idx){slot.addEventListener('click',function(){if(mode==='tiles'&&chosen[idx]){chosen.splice(idx,1);draw();}});})(index);row.appendChild(slot);});
        slots.appendChild(row);return;
      }
      var cursor=0;lengths.forEach(function(length,wordIndex){var row=node('div','activity-letter-word');for(var i=0;i<Number(length||0);i++){var slot=node('button','activity-letter-slot',chosen[cursor]?chosen[cursor].text.toUpperCase():'');slot.type='button';slot.disabled=!chosen[cursor];(function(index){slot.addEventListener('click',function(){if(mode==='tiles'&&chosen[index]){chosen.splice(index,1);draw();}});})(cursor);row.appendChild(slot);cursor++;}slots.appendChild(row);if(wordIndex<lengths.length-1){var space=node('span','activity-letter-space');space.setAttribute('aria-hidden','true');slots.appendChild(space);}});
    }
    function draw(){drawSlots();pool.innerHTML='';if(mode==='tiles'){bank.filter(function(item){return chosen.indexOf(item)<0;}).forEach(function(item){var b=node('button','activity-letter-tile',item.text.toUpperCase());b.type='button';b.addEventListener('click',function(){chosen.push(item);draw();});pool.appendChild(b);});}self.selected=lowLevel?chosen.reduce(function(all,item){return all.concat(String(item.text).split(''));},[]):chosen.map(function(item){return item.text;});self.setCheckEnabled(card,chosen.length===bank.length);}
    function choosePhysicalLetter(letter){if(lowLevel||chosen.length>=bank.length)return;var upper=String(letter).toUpperCase(),item=bank.find(function(x){return chosen.indexOf(x)<0&&String(x.text).toUpperCase()===upper;});if(item){chosen.push(item);draw();}}
    activeKeyHandler=function(e){
      if(mode!=='keyboard'||!document.body.contains(card))return;
      var tag=e.target&&e.target.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||(e.target&&e.target.isContentEditable))return;
      if(lowLevel)return;
      if(/^[a-zA-Z]$/.test(e.key)){e.preventDefault();choosePhysicalLetter(e.key);return;}
      if(e.key==='Backspace'){e.preventDefault();chosen.pop();draw();return;}
      if(e.key===' '){e.preventDefault();return;}
      if(e.key==='Enter'){var check=card.querySelector('.activity-check');if(check&&!check.disabled){e.preventDefault();check.click();}}
    };
    document.addEventListener('keydown',activeKeyHandler,true);
    tilesBtn.addEventListener('click',function(){setMode('tiles');});keyBtn.addEventListener('click',function(){setMode('keyboard');});
    setMode(mode);
    fetchBookLevel(self).then(function(info){
      if(!document.body.contains(card)||!isLowLevelInfo(info))return;
      var chunks=buildLowLevelChunks(self,originalTokens);
      if(!chunks.length||chunks.join('').toLowerCase()!==wordAnswer(self,originalTokens))return;
      lowLevel=true;tokenSet=chunks;rebuildBank();tilesBtn.textContent='단어 조각';keyBtn.style.display='none';mode='tiles';wrap.dataset.inputMode='tiles';draw();
    });
    if(lengths.length===1){lexicalPhrase(self,originalTokens).then(function(found){if(found&&document.body.contains(card)&&!lowLevel){lengths=found.lengths;if(self.current&&self.current.response)self.current.response.wordLengths=lengths.slice();if(self.current&&lettersOnly(self.current.answer)===lettersOnly(found.phrase))self.current.answer=found.phrase;draw();}});}
  };
  return true;
}
var tries=0,t=setInterval(function(){tries++;if(install()||tries>200)clearInterval(t);},20);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
