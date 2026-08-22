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
function levelInfoFromSource(source){
  source=source||{};
  var meta=source.metadata||source;
  var internal=numberFromMeta(source,['internal_level_id','internal_level','internalLevel','willena_internal_level','level_internal']);
  var pub=numberFromMeta(source,['public_level','publicLevel','willena_public_level','level_public']);
  if(internal==null)internal=numberFromMeta(meta,['internal_level_id','internal_level','internalLevel','willena_internal_level','level_internal']);
  if(pub==null)pub=numberFromMeta(meta,['public_level','publicLevel','willena_public_level','level_public']);
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
  var local=levelInfoFromSource(meta);
  if(local.internal!=null||local.publicLevel!=null)return local;
  var bookId=meta.book_id||current.book_id||current.bookId||'';
  if(!bookId)return local;
  if(bookLevelCache[bookId])return bookLevelCache[bookId];
  bookLevelCache[bookId]=(async function(){
    try{
      var url=DB+'/rest/v1/content_books?id=eq.'+encodeURIComponent(bookId)+'&select=id,internal_level_id,public_level,metadata&limit=1';
      var r=await fetch(url,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'});
      if(!r.ok)return local;
      var rows=await r.json(),row=rows&&rows[0]||{};
      return levelInfoFromSource(row);
    }catch(_){return local;}
  })();
  return bookLevelCache[bookId];
}

/* Preferred teaching chunks always win. Keep this small and intentional; the heuristic below handles the rest. */
var CURATED_CHUNKS={
  andy:['an','dy'],igloo:['ig','loo'],ostrich:['os','trich'],insect:['in','sect'],octopus:['oc','to','pus'],
  rabbit:['rab','bit'],window:['win','dow'],teacher:['tea','ch','er'],banana:['ba','na','na'],
  apple:['ap','ple'],tiger:['ti','ger'],lion:['li','on'],monkey:['mon','key'],zebra:['ze','bra'],
  pencil:['pen','cil'],eraser:['e','ra','ser'],table:['ta','ble'],school:['sch','ool'],
  happy:['hap','py'],funny:['fun','ny'],sunny:['sun','ny'],rainy:['rain','y'],
  mother:['moth','er'],father:['fa','ther'],sister:['sis','ter'],brother:['bro','ther'],
  water:['wa','ter'],pizza:['piz','za'],cookie:['cook','ie'],orange:['or','ange'],
  purple:['pur','ple'],yellow:['yel','low'],seven:['sev','en'],eleven:['e','lev','en']
};
var PHONICS_PATTERNS=['tch','dge','igh','air','ear','ure','sh','ch','th','ph','wh','ck','ng','qu','ee','ea','oo','ai','ay','oa','ow','ou','oi','oy','ar','er','ir','or','ur','nk','nd','nt','mp','st','sk','ft','ld','lk','lp','rk','rt','sp','bl','cl','fl','gl','pl','sl','br','cr','dr','fr','gr','pr','tr','sm','sn','sw'];
var VOWELS='aeiouy';

function isVowel(ch,index,word){
  if('aeiou'.indexOf(ch)>=0)return true;
  return ch==='y'&&index>0&&index===word.length-1;
}
function vowelNuclei(word){
  var nuclei=[],i=0;
  while(i<word.length){
    if(!isVowel(word[i],i,word)){i++;continue;}
    var start=i;i++;
    while(i<word.length&&isVowel(word[i],i,word))i++;
    nuclei.push({start:start,end:i});
  }
  return nuclei;
}
function syllableLikeChunks(word){
  word=lettersOnly(word);
  var nuclei=vowelNuclei(word);
  if(nuclei.length<2)return[];
  var cuts=[];
  for(var i=0;i<nuclei.length-1;i++){
    var consonantStart=nuclei[i].end,nextVowel=nuclei[i+1].start,cluster=nextVowel-consonantStart,cut;
    if(cluster<=0)continue;
    if(cluster===1)cut=consonantStart;
    else cut=consonantStart+Math.floor(cluster/2);
    if(cut>0&&cut<word.length&&cuts.indexOf(cut)<0)cuts.push(cut);
  }
  if(!cuts.length)return[];
  var out=[],from=0;
  cuts.forEach(function(cut){if(cut>from){out.push(word.slice(from,cut));from=cut;}});
  if(from<word.length)out.push(word.slice(from));
  if(out.length<2||out.some(function(x){return !x;}))return[];
  return out;
}
function phonicsAtoms(word){
  word=lettersOnly(word);
  var out=[],i=0;
  while(i<word.length){
    var found='';
    for(var p=0;p<PHONICS_PATTERNS.length;p++){
      var pattern=PHONICS_PATTERNS[p];
      if(word.slice(i,i+pattern.length)===pattern){found=pattern;break;}
    }
    if(found){out.push(found);i+=found.length;}else{out.push(word[i]);i++;}
  }
  return out;
}
function mergeRange(parts,start,end){return parts.slice(start,end).join('');}
function balancedMerge(parts,target){
  parts=(parts||[]).slice();
  if(target<=1)return[parts.join('')];
  if(parts.length<=target)return parts;
  var out=[],remainingChars=parts.reduce(function(sum,p){return sum+p.length;},0),cursor=0;
  for(var slot=0;slot<target;slot++){
    var slotsLeft=target-slot;
    if(slotsLeft===1){out.push(mergeRange(parts,cursor,parts.length));break;}
    var targetChars=Math.max(1,Math.round(remainingChars/slotsLeft)),chunk='',start=cursor;
    while(cursor<parts.length-(slotsLeft-1)){
      var next=parts[cursor];
      if(chunk&&chunk.length+next.length>targetChars)break;
      chunk+=next;cursor++;
      if(chunk.length>=targetChars)break;
    }
    if(cursor===start){chunk=parts[cursor++]||'';}
    out.push(chunk);remainingChars-=chunk.length;
  }
  return out.filter(Boolean);
}
function cvcStyle(word,atoms){
  if(word.length!==3||atoms.length!==3)return null;
  if(atoms.some(function(a){return a.length!==1;}))return null;
  if(VOWELS.indexOf(word[0])<0&&VOWELS.indexOf(word[1])>=0&&VOWELS.indexOf(word[2])<0)return[word[0],word.slice(1)];
  return null;
}
function vowelConsonantFallback(word,atoms){
  word=lettersOnly(word);atoms=(atoms&&atoms.length?atoms:phonicsAtoms(word)).slice();
  var nuclei=vowelNuclei(word);
  if(nuclei.length===1&&word.length>=4){
    var nucleus=nuclei[0],cut=nucleus.start;
    if(cut<=0)cut=Math.min(word.length-1,nucleus.end+1);
    if(cut>0&&cut<word.length)return[word.slice(0,cut),word.slice(cut)];
  }
  return balancedMerge(atoms,2);
}
function forceTwoChunks(word,atoms){
  word=lettersOnly(word);atoms=(atoms&&atoms.length?atoms:phonicsAtoms(word)).slice();
  var fallback=vowelConsonantFallback(word,atoms);
  if(fallback.length>=2)return fallback;
  var cut=Math.max(1,Math.floor(word.length/2));return[word.slice(0,cut),word.slice(cut)].filter(Boolean);
}
function chunkWord(word,internalLevel){
  word=lettersOnly(word);
  if(!word)return[];
  if(CURATED_CHUNKS[word])return CURATED_CHUNKS[word].slice();
  var chunks=syllableLikeChunks(word),atoms=phonicsAtoms(word),cvc;
  if(!chunks.length){
    cvc=cvcStyle(word,atoms);
    if(cvc)chunks=cvc;
    else if((Number(internalLevel)||99)<=2)chunks=vowelConsonantFallback(word,atoms);
    else if(atoms.length>=2&&atoms.length<=4)chunks=atoms.slice();
    else chunks=balancedMerge(atoms,word.length<=4?2:word.length<=6?3:4);
  }
  if(chunks.length<2)chunks=forceTwoChunks(word,atoms);
  if(chunks.length>4)chunks=balancedMerge(chunks,4);
  return chunks.filter(Boolean);
}
function buildLowLevelChunks(engine,tokens,levelInfo,phraseOverride){
  var ans=phraseOverride;
  if(!ans){
    ans=engine&&engine.current&&engine.current.answer;
    if(Array.isArray(ans))ans=ans.join(' ');
  }
  var words=String(ans==null?'':ans).trim().split(/\s+/).map(lettersOnly).filter(Boolean);
  if(!words.length){var single=wordAnswer(engine,tokens);words=single?[single]:[];}
  var out=[],counts=[],internal=levelInfo&&levelInfo.internal;
  words.forEach(function(w){
    var chunks=chunkWord(w,internal).filter(Boolean);
    if(!chunks.length)return;
    counts.push(chunks.length);
    chunks.forEach(function(c){out.push(c);});
  });
  out.wordChunkCounts=counts;
  out.sourceWords=words;
  return out;
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
    var self=this,chosen=[],originalTokens=(tokens||[]).map(function(t){return String(t);}),lowLevel=false,chunkWordCounts=[];
    var tokenSet=originalTokens.slice();
    var lengths=answerWords(self,originalTokens,wordLengths),wrap=node('div','activity-letter-order'),controls=node('div','activity-spelling-controls'),tilesBtn=node('button','activity-spelling-mode','글자 버튼'),keyBtn=node('button','activity-spelling-mode','키보드'),slots=node('div','activity-letter-slots'),pool=node('div','activity-letter-bank'),hint=node('div','activity-spelling-keyboard-hint','실제 키보드로 입력하세요 · Backspace 삭제 · Enter 확인');
    var bank=[];
    function rebuildBank(){bank=tokenSet.map(function(t,i){return{text:String(t),id:i+'-'+Math.random()};}).sort(function(){return Math.random()-.5;});chosen=[];}
    rebuildBank();
    if(self.current&&self.current.response&&lengths.length>1)self.current.response.wordLengths=lengths.slice();
    tilesBtn.type=keyBtn.type='button';controls.appendChild(tilesBtn);controls.appendChild(keyBtn);wrap.appendChild(controls);wrap.appendChild(slots);wrap.appendChild(pool);wrap.appendChild(hint);card.appendChild(wrap);
    var mode=pref();
    function setMode(next){mode=next;savePref(next);wrap.dataset.inputMode=next;tilesBtn.classList.toggle('is-active',next==='tiles');keyBtn.classList.toggle('is-active',next==='keyboard');draw();}
    function chunkSize(el,value){if(!el)return;el.style.setProperty('--chunk-chars',String(Math.max(2,String(value||'').length)));}
    function appendChunkSlot(row,targetChunk,index){
      var slot=node('button','activity-letter-slot activity-chunk-slot',chosen[index]?chosen[index].text.toUpperCase():'');
      slot.type='button';slot.disabled=!chosen[index];chunkSize(slot,targetChunk);
      slot.addEventListener('click',function(){if(mode==='tiles'&&chosen[index]){chosen.splice(index,1);draw();}});
      row.appendChild(slot);
    }
    function drawSlots(){
      slots.innerHTML='';
      if(lowLevel){
        var cursor=0,groups=chunkWordCounts.length?chunkWordCounts:[tokenSet.length];
        groups.forEach(function(count,wordIndex){
          var row=node('div','activity-letter-word activity-chunk-word-group');
          for(var i=0;i<count&&cursor<tokenSet.length;i++,cursor++)appendChunkSlot(row,tokenSet[cursor],cursor);
          slots.appendChild(row);
          if(wordIndex<groups.length-1){var space=node('span','activity-letter-space activity-chunk-word-space');space.setAttribute('aria-hidden','true');slots.appendChild(space);}
        });
        return;
      }
      var cursor=0;lengths.forEach(function(length,wordIndex){var row=node('div','activity-letter-word');for(var i=0;i<Number(length||0);i++){var slot=node('button','activity-letter-slot',chosen[cursor]?chosen[cursor].text.toUpperCase():'');slot.type='button';slot.disabled=!chosen[cursor];(function(index){slot.addEventListener('click',function(){if(mode==='tiles'&&chosen[index]){chosen.splice(index,1);draw();}});})(cursor);row.appendChild(slot);cursor++;}slots.appendChild(row);if(wordIndex<lengths.length-1){var space=node('span','activity-letter-space');space.setAttribute('aria-hidden','true');slots.appendChild(space);}});
    }
    function draw(){drawSlots();pool.innerHTML='';if(mode==='tiles'){bank.filter(function(item){return chosen.indexOf(item)<0;}).forEach(function(item){var b=node('button','activity-letter-tile',item.text.toUpperCase());b.type='button';if(lowLevel)chunkSize(b,item.text);b.addEventListener('click',function(){chosen.push(item);draw();});pool.appendChild(b);});}self.selected=lowLevel?chosen.reduce(function(all,item){return all.concat(String(item.text).split(''));},[]):chosen.map(function(item){return item.text;});self.setCheckEnabled(card,chosen.length===bank.length);}
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
    fetchBookLevel(self).then(async function(info){
      if(!document.body.contains(card)||!isLowLevelInfo(info))return;
      var phraseInfo=await lexicalPhrase(self,originalTokens);
      if(!document.body.contains(card))return;
      var chunks=buildLowLevelChunks(self,originalTokens,info,phraseInfo&&phraseInfo.phrase);
      if(!chunks.length||chunks.join('').toLowerCase()!==wordAnswer(self,originalTokens))return;
      lowLevel=true;tokenSet=chunks.slice();chunkWordCounts=(chunks.wordChunkCounts||[]).slice();rebuildBank();tilesBtn.textContent='단어 조각';keyBtn.style.display='none';hint.style.display='none';mode='tiles';wrap.dataset.inputMode='tiles';wrap.dataset.chunkCount=String(chunks.length);wrap.dataset.wordCount=String(chunkWordCounts.length||1);wrap.classList.add('is-chunk-mode');draw();
    });
    if(lengths.length===1){lexicalPhrase(self,originalTokens).then(function(found){if(found&&document.body.contains(card)&&!lowLevel){lengths=found.lengths;if(self.current&&self.current.response)self.current.response.wordLengths=lengths.slice();if(self.current&&lettersOnly(self.current.answer)===lettersOnly(found.phrase))self.current.answer=found.phrase;draw();}});}
  };
  return true;
}
var tries=0,t=setInterval(function(){tries++;if(install()||tries>200)clearInterval(t);},20);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);