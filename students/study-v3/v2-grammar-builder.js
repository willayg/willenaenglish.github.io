(function(){
'use strict';
var root=document.getElementById('bookStudyContent');
if(!root)return;

var WH_HEAD='(?:how(?:\\s+(?:often|many|much|long|old|far))?|which(?:\\s+[A-Za-z]+){0,2}|what(?:\\s+[A-Za-z]+){0,2}|where|when|why|who|whose(?:\\s+[A-Za-z]+){0,2})';
var SUBJECT='(?:I|you|he|she|it|we|they|this|that|these|those|[A-Za-z][A-Za-z-]*)';

function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function uniq(list){var out=[],seen={};(list||[]).forEach(function(v){v=text(v).replace(/[.!?]+$/,'').trim();var k=v.toLowerCase();if(v&&!seen[k]){seen[k]=1;out.push(v);}});return out;}
function limit(list,n){return uniq(list).slice(0,n||4);}
function normaliseSentence(value){
  var s=text(value).replace(/[.!?]+$/,'').trim();
  return s
    .replace(/^I'm\b/i,'I am').replace(/^You're\b/i,'You are')
    .replace(/^He's\b/i,'He is').replace(/^She's\b/i,'She is').replace(/^It's\b/i,'It is')
    .replace(/^We're\b/i,'We are').replace(/^They're\b/i,'They are')
    .replace(/^What's\b/i,'What is').replace(/^Where's\b/i,'Where is')
    .replace(/^When's\b/i,'When is').replace(/^Who's\b/i,'Who is');
}
function optionText(values,fallback){var a=limit(values,4);return a.length?a.join(' / '):fallback;}
function collectAfter(examples,re){var out=[];(examples||[]).forEach(function(raw){var m=normaliseSentence(raw).match(re);if(m&&m[1])out.push(m[1]);});return uniq(out);}
function thirdForm(base){base=text(base).toLowerCase();if(!base)return'';if(/[^aeiou]y$/.test(base))return base.slice(0,-1)+'ies';if(/(s|x|z|ch|sh|o)$/.test(base))return base+'es';return base+'s';}
function baseFromThird(verb){verb=text(verb).toLowerCase();if(!verb)return'';if(/[^aeiou]ies$/.test(verb))return verb.slice(0,-3)+'y';if(/(ches|shes|sses|xes|zes|oes)$/.test(verb))return verb.slice(0,-2);if(/s$/.test(verb)&&!/ss$/.test(verb))return verb.slice(0,-1);return verb;}
function shiftSharedTo(a,b,parts){var list=uniq(parts);if(list.length&&list.every(function(v){return /^to\s+/i.test(v);}))return{a:a+' to',b:b+' to',rest:list.map(function(v){return v.replace(/^to\s+/i,'');})};return{a:a,b:b,rest:list};}
function isWhQuestion(s){return new RegExp('^'+WH_HEAD+'\\s+','i').test(normaliseSentence(s));}
function isYesNoQuestion(s){return /^(?:am|is|are|was|were|do|does|did|can|could|will|would|should|have|has)\b/i.test(normaliseSentence(s));}

function rowsForPresentAgreement(name,explanation,examples){
  var signal=(name+' '+explanation).toLowerCase();
  if(signal.indexOf('present simple')<0&&signal.indexOf('present_simple')<0&&signal.indexOf('현재형')<0)return null;
  var parsed=[];
  examples.forEach(function(raw){var m=normaliseSentence(raw).match(/^(I|You|He|She|It|We|They)\s+([A-Za-z']+)\s+(.+)$/i);if(!m)return;var verb=m[2].toLowerCase();if(/^(am|is|are|was|were|can|could|should|would|will|have|has|had|do|does|did)$/.test(verb))return;parsed.push({subject:m[1],verb:verb,rest:m[3]});});
  if(!parsed.length)return null;
  var third=parsed.find(function(x){return /^(he|she|it)$/i.test(x.subject);}),other=parsed.find(function(x){return /^(i|you|we|they)$/i.test(x.subject);});
  var base=other&&other.verb||third&&baseFromThird(third.verb)||'',thirdVerb=third&&third.verb||thirdForm(base);if(!base||!thirdVerb)return null;
  var rests=parsed.filter(function(x){return x.verb===base||x.verb===thirdVerb;}).map(function(x){return x.rest;}),shifted=shiftSharedTo(thirdVerb,base,rests);
  return[['He / She / It',shifted.a,optionText(shifted.rest,'...')],['I / You / We / They',shifted.b,optionText(shifted.rest,'...')]];
}

function builderRows(name,explanation,examples){
  var signal=(name+' '+explanation).toLowerCase();
  if(/past simple: the verb be|past_be|과거형.*was|was.*were|was\/were/.test(signal)){
    var places=collectAfter(examples,/^(?:I|You|He|She|It|We|They)\s+(?:was|were)\s+(.+)$/i);
    return[['I / He / She / It','was',optionText(places,'at the park / happy / tired')],['You / We / They','were',optionText(places,'at the park / happy / tired')]];
  }
  if(/going to|be_going_to/.test(signal)){
    var future=collectAfter(examples,/\b(?:am|is|are)\s+going to\s+(.+)$/i),f=optionText(future,'study / travel / visit ...');
    return[['I','am going to',f],['He / She / It','is going to',f],['You / We / They','are going to',f]];
  }
  if(/like to/.test(signal)){var likes=collectAfter(examples,/\b(?:like|likes)\s+to\s+(.+)$/i),l=optionText(likes,'play / read / swim ...');return[['He / She / It','likes to',l],['I / You / We / They','like to',l]];}
  if(/want to/.test(signal)){var wants=collectAfter(examples,/\b(?:want|wants)\s+to\s+(.+)$/i),w=optionText(wants,'be a doctor / travel / study ...');return[['He / She / It','wants to',w],['I / You / We / They','want to',w]];}
  if(/\bshould\b/.test(signal)){var sh=collectAfter(examples,/^(?:I|You|He|She|It|We|They)\s+should\s+(.+)$/i);return[['I / You / He / She / It / We / They','should',optionText(sh,'rest / study / take some medicine ...')]];}
  if(/modal_can|\bcan\b/.test(signal)){var ca=collectAfter(examples,/^(?:I|You|He|She|It|We|They)\s+can\s+(.+)$/i);if(ca.length)return[['I / You / He / She / It / We / They','can',optionText(ca,'swim / play / read ...')]];}
  if(/frequency|빈도/.test(signal)){
    var phrases=[],adverbs=[];examples.forEach(function(raw){var m=normaliseSentence(raw).match(/^(?:I|You|He|She|It|We|They)\s+(always|usually|often|sometimes|never)\s+(.+)$/i);if(m){adverbs.push(m[1].toLowerCase());phrases.push(m[2]);}});
    if(phrases.length){var parts=phrases[0].split(/\s+/),verb=parts.shift(),rest=parts.join(' '),third=thirdForm(verb),adv=optionText(adverbs,'always / usually / sometimes / never');return[['He / She / It',adv,third+(rest?' '+rest:'')],['I / You / We / They',adv,verb+(rest?' '+rest:'')]];}
  }
  return rowsForPresentAgreement(name,explanation,examples);
}

function yesNoRowsFor(kind,examples){
  var q=(examples||[]).map(normaliseSentence),tails=[];
  if(kind==='going-to'){
    q.forEach(function(s){var m=s.match(new RegExp('^(?:am|is|are)\\s+'+SUBJECT+'\\s+going to\\s+(.+)$','i'));if(m)tails.push(m[1]);});if(!tails.length)return null;var t=optionText(tails,'do / take / visit ...');return[['Am','I','going to',t],['Is','He / She / It','going to',t],['Are','You / We / They','going to',t]];
  }
  if(kind==='past-be'){
    q.forEach(function(s){var m=s.match(new RegExp('^(?:was|were)\\s+'+SUBJECT+'\\s+(.+)$','i'));if(m)tails.push(m[1]);});if(!tails.length)return null;var p=optionText(tails,'at the park / happy / tired');return[['Was','I / He / She / It',p],['Were','You / We / They',p]];
  }
  if(kind==='past-did'){
    q.forEach(function(s){var m=s.match(new RegExp('^did\\s+'+SUBJECT+'\\s+(.+)$','i'));if(m)tails.push(m[1]);});if(!tails.length)return null;return[['Did','I / You / He / She / It / We / They',optionText(tails,'eat / buy / see ...')]];
  }
  if(kind==='present-do'){
    var third=[],other=[];q.forEach(function(s){var m=s.match(new RegExp('^(do|does)\\s+'+SUBJECT+'\\s+(.+)$','i'));if(m)(m[1].toLowerCase()==='does'?third:other).push(m[2]);});if(!third.length&&!other.length)return null;var tail=optionText(third.concat(other),'like / play / go ...');return[['Does','He / She / It',tail],['Do','I / You / We / They',tail]];
  }
  return null;
}

function whRowsFor(kind,examples){
  var qs=(examples||[]).map(normaliseSentence).filter(isWhQuestion),wh=[],tails=[];if(!qs.length)return null;
  if(kind==='going-to'){
    qs.forEach(function(s){var m=s.match(new RegExp('^('+WH_HEAD+')\\s+(am|is|are)\\s+('+SUBJECT+')\\s+going to\\s+(.+)$','i'));if(m){wh.push(m[1]);tails.push(m[4]);}});if(!wh.length)return null;var a=optionText(wh,'What / Where / When'),b=optionText(tails,'do / go / visit ...');return[[a,'Am','I','going to',b],[a,'Is','He / She / It','going to',b],[a,'Are','You / We / They','going to',b]];
  }
  if(kind==='past-be'){
    qs.forEach(function(s){var m=s.match(new RegExp('^('+WH_HEAD+')\\s+(was|were)\\s+('+SUBJECT+')(?:\\s+(.+))?$','i'));if(m){wh.push(m[1]);if(m[4])tails.push(m[4]);}});if(!wh.length)return null;var c=optionText(wh,'Where / When / Why'),d=optionText(tails,'yesterday / at the park / ...');return[[c,'Was','I / He / She / It',d],[c,'Were','You / We / They',d]];
  }
  if(kind==='past-did'||kind==='present-do'){
    var parsed=[];qs.forEach(function(s){var m=s.match(new RegExp('^('+WH_HEAD+')\\s+(do|does|did)\\s+('+SUBJECT+')\\s+(.+)$','i'));if(m)parsed.push({wh:m[1],aux:m[2].toLowerCase(),tail:m[4]});});if(!parsed.length)return null;var e=optionText(parsed.map(function(x){return x.wh;}),'What / Where / When'),f=optionText(parsed.map(function(x){return x.tail;}),'do / go / like ...');if(kind==='past-did'||parsed.some(function(x){return x.aux==='did';}))return[[e,'Did','I / You / He / She / It / We / They',f]];return[[e,'Does','He / She / It',f],[e,'Do','I / You / We / They',f]];
  }
  return null;
}

function primaryKind(name,explanation){var s=(name+' '+explanation).toLowerCase();if(/going to|be_going_to/.test(s))return'going-to';if(/past simple: the verb be|past_be|과거형.*was|was.*were|was\/were/.test(s))return'past-be';if(/past simple|past_simple|\bdid\b/.test(s))return'past-did';if(/present simple|present_simple/.test(s))return'present-do';return'';}
function detectedKinds(examples){
  var kinds=[],whAux=new RegExp('^'+WH_HEAD+'\\s+(do|does|did|was|were|am|is|are)\\b','i');
  (examples||[]).map(normaliseSentence).forEach(function(s){
    var wm=s.match(whAux),aux=wm&&wm[1]&&wm[1].toLowerCase();
    if(/^did\b/i.test(s)||aux==='did')kinds.push('past-did');
    if(/^(?:do|does)\b/i.test(s)||aux==='do'||aux==='does')kinds.push('present-do');
    if(/^(?:was|were)\b/i.test(s)||aux==='was'||aux==='were')kinds.push('past-be');
    if(/\b(?:am|is|are)\s+.+\s+going to\b/i.test(s))kinds.push('going-to');
  });
  return uniq(kinds);
}
function pointTitle(kind){if(kind==='past-did')return isKo()?'과거형: 일반 동사':'Past Simple: ordinary verbs';if(kind==='present-do')return isKo()?'현재형: 일반 동사':'Present Simple: ordinary verbs';if(kind==='past-be')return isKo()?'과거형: be 동사':'Past Simple: the verb be';if(kind==='going-to')return isKo()?'미래: be going to':'Future: be going to';return isKo()?'문법':'Grammar';}

function labelKind(label,value){var l=text(label).toLowerCase(),v=text(value);if(/question|prompt|질문/.test(l)||/\?$/.test(v))return isWhQuestion(v)?'generic-wh':'generic-question';if(/answer|response|답변|답$/.test(l))return'generic-answer';if(/form|pattern|형태|구조/.test(l))return'generic-statement';return'generic-structure';}
function splitGeneric(value,kind){
  var v=text(value);if(!v)return[];
  if(v.indexOf('+')>=0)return v.split(/\s*\+\s*/).map(function(x){return text(x);}).filter(Boolean);
  if(kind==='generic-wh'||kind==='generic-question'){
    var m=v.match(new RegExp('^('+WH_HEAD+')\\s+(am|is|are|was|were|do|does|did|can|could|will|would|should|have|has)\\s+('+SUBJECT+')(?:\\s+(.+))?$','i'));
    if(m)return[m[1],m[2],m[3],m[4]||''].filter(Boolean);
    var q=v.match(new RegExp('^(am|is|are|was|were|do|does|did|can|could|will|would|should|have|has)\\s+('+SUBJECT+')(?:\\s+(.+))?$','i'));
    if(q)return[q[1],q[2],q[3]||''].filter(Boolean);
  }
  var contraction=v.match(/^([^\s]+(?:\s+[^\s]+){0,1})\s+(.+)$/);if(contraction&&v.split(/\s+/).length>3)return[contraction[1],contraction[2]];
  return[v];
}
function genericTitle(kind){if(kind==='generic-wh')return isKo()?'의문사 질문 만들기':'Build a WH question';if(kind==='generic-question')return isKo()?'질문 만들기':'Build a question';if(kind==='generic-answer')return isKo()?'답 만들기':'Build an answer';if(kind==='generic-statement')return isKo()?'문장 만들기':'Build a sentence';return isKo()?'구조 보기':'Structure';}
function questionCase(v,index,kind){
  var value=text(v);if(index===0)return value;
  if(kind.indexOf('question')<0&&kind!=='derived-yesno'&&kind!=='derived-wh')return value;
  return value.split(/\s*\/\s*/).map(function(part){part=text(part);if(part==='I')return'I';if(/^(He|She|It|You|We|They|This|That|These|Those|Am|Is|Are|Was|Were|Do|Does|Did|Can|Could|Will|Would|Should|Have|Has)$/i.test(part))return part.toLowerCase();return part;}).join(' / ');
}
function displayCellText(v){return text(v).replace(/\s*\/\s*/g,'\n');}
function makeCell(value,index,kind){var c=document.createElement('div');c.className='book-study-grammar-builder-cell is-col-'+(index+1);c.textContent=displayCellText(questionCase(value,index,kind));return c;}
function makeExamples(items){
  if(!items||!items.length)return null;
  var wrap=document.createElement('div');wrap.className='book-study-grammar-builder-examples';
  var label=document.createElement('div');label.className='book-study-grammar-builder-examples-label';label.textContent=isKo()?'예문':'Examples';wrap.appendChild(label);
  items.slice(0,4).forEach(function(item){var row=document.createElement('div');row.className='book-study-grammar-builder-example';var strong=document.createElement('strong');strong.textContent=item.text;row.appendChild(strong);if(item.translation){var small=document.createElement('small');small.textContent=item.translation;row.appendChild(small);}wrap.appendChild(row);});
  return wrap;
}
function makeBuilder(rows,titleText,kind,items){
  var wrap=document.createElement('div');wrap.className='book-study-grammar-builder'+(kind?' is-'+kind:'');wrap.setAttribute('role','button');wrap.setAttribute('tabindex','0');wrap.setAttribute('aria-label',titleText+' — '+(isKo()?'크게 보기':'enlarge chart'));
  var title=document.createElement('div');title.className='book-study-grammar-builder-title';title.textContent=titleText;wrap.appendChild(title);
  rows.forEach(function(values){var row=document.createElement('div');row.className='book-study-grammar-builder-row';row.style.setProperty('--grammar-chunks',String(values.length));values.forEach(function(v,i){row.appendChild(makeCell(v,i,kind));});wrap.appendChild(row);});
  var examples=makeExamples(items);if(examples)wrap.appendChild(examples);return wrap;
}
function makePointHeading(kind){var h=document.createElement('h5');h.className='book-study-grammar-derived-heading';h.textContent=pointTitle(kind);return h;}
function readCard(card){
  var name=text(card.querySelector('h5')&&card.querySelector('h5').textContent),explanation='';
  Array.prototype.forEach.call(card.children,function(ch){if(ch.tagName==='P'&&!explanation)explanation=text(ch.textContent);});
  var items=[];card.querySelectorAll('.book-study-grammar-pair > div').forEach(function(box){var strong=box.querySelector('strong'),small=box.querySelector('small'),t=text(strong&&strong.textContent);if(t)items.push({text:t,translation:text(small&&small.textContent)});});
  if(!items.length)card.querySelectorAll('.book-study-grammar-examples strong').forEach(function(n){var t=text(n.textContent);if(t)items.push({text:t,translation:text(n.parentElement&&n.parentElement.querySelector('small')&&n.parentElement.querySelector('small').textContent)});});
  var examples=items.map(function(x){return x.text;});
  var forms=Array.prototype.map.call(card.querySelectorAll('.book-study-grammar-chart-row'),function(row){var label=text(row.querySelector('span')&&row.querySelector('span').textContent),value=text(row.querySelector('strong')&&row.querySelector('strong').textContent);return{label:label,value:value};}).filter(function(x){return x.value;});
  return{name:name,explanation:explanation,examples:examples,items:items,forms:forms};
}
function examplesFor(info,mode,kind){
  var items=info.items||[],out=[];
  items.forEach(function(item){var s=normaliseSentence(item.text),ok=false;
    if(mode==='wh')ok=isWhQuestion(s);
    else if(mode==='yesno')ok=isYesNoQuestion(s);
    else if(mode==='statement')ok=!isWhQuestion(s)&&!isYesNoQuestion(s)&&!/^(?:yes|no)\b/i.test(s);
    else ok=true;
    if(ok&&kind==='going-to')ok=/\bgoing to\b/i.test(s);
    if(ok&&kind==='past-be')ok=/\b(?:was|were)\b/i.test(s);
    if(ok&&kind==='past-did')ok=/\bdid\b/i.test(s)||(!/[?]$/.test(item.text)&&/\b(?:went|saw|ate|bought|had|made|did|came|took|got)\b/i.test(s));
    if(ok&&kind==='present-do'&&(mode==='wh'||mode==='yesno'))ok=/\b(?:do|does)\b/i.test(s);
    if(ok)out.push(item);
  });
  if(!out.length&&mode==='statement')out=items.filter(function(x){return !/[?]$/.test(x.text);});
  return out.slice(0,4);
}
function addBuilder(card,anchor,rows,title,kind,items){if(!rows||!rows.length||card.querySelector('.book-study-grammar-builder.is-'+kind))return false;var b=makeBuilder(rows,title,kind,items);if(anchor)card.insertBefore(b,anchor);else card.appendChild(b);return true;}
function addGenericFallback(card,anchor,info){
  var made=false,seen={};
  (info.forms||[]).forEach(function(form){var kind=labelKind(form.label,form.value),key=kind+'|'+form.value.toLowerCase();if(seen[key])return;seen[key]=1;var rows=[splitGeneric(form.value,kind)],mode=kind==='generic-wh'?'wh':kind==='generic-question'?'yesno':'all';if(rows[0].length)made=addBuilder(card,anchor,rows,genericTitle(kind),kind+'-'+Object.keys(seen).length,examplesFor(info,mode,''))||made;});
  if(!made&&info.name){var k=/\?$/.test(info.name)?labelKind('question',info.name):'generic-statement',mode=k==='generic-wh'?'wh':k==='generic-question'?'yesno':'all';made=addBuilder(card,anchor,[splitGeneric(info.name,k)],genericTitle(k),k+'-title',examplesFor(info,mode,''))||made;}
  return made;
}

function gerundParts(item){
  var s=normaliseSentence(item.text),m=s.match(/^([A-Za-z]+ing\b.+?)\s+(isn't|aren't|wasn't|weren't|is|are|was|were)\s+(.+)$/i);
  return m?[m[1],m[2].toLowerCase(),m[3]]:null;
}
function frequencyStatementParts(item){
  var s=normaliseSentence(item.text),m=s.match(/^([A-Za-z][A-Za-z-]*|I|you|he|she|it|we|they)\s+(always|usually|often|sometimes|never)\s+(.+)$/i);
  return m?[m[1],m[2].toLowerCase(),m[3]]:null;
}
function frequencyQuestionParts(item){
  var s=normaliseSentence(item.text),m=s.match(/^(How often)\s+(do|does|did)\s+([A-Za-z][A-Za-z-]*|I|you|he|she|it|we|they)\s+(.+)$/i);
  return m?[m[1],m[2].toLowerCase(),m[3],m[4]]:null;
}
function semanticSplitCard(card,info,old,anchor){
  var original=card.getAttribute('data-semantic-original-title')||info.name||'';
  var signal=(original+' '+info.explanation).toLowerCase();
  var gerundItems=[],freqItems=[],freqQuestionItems=[];
  (info.items||[]).forEach(function(item){if(gerundParts(item))gerundItems.push(item);if(frequencyStatementParts(item))freqItems.push(item);if(frequencyQuestionParts(item))freqQuestionItems.push(item);});
  var mixed=(/gerund|동명사/.test(signal)&&/frequency|빈도/.test(signal))||(gerundItems.length&&(freqItems.length||freqQuestionItems.length));
  if(!mixed)return false;

  if(!card.hasAttribute('data-semantic-original-title'))card.setAttribute('data-semantic-original-title',original);
  card.setAttribute('data-semantic-split','gerund-frequency');
  card.querySelectorAll('.book-study-grammar-builder,.book-study-grammar-derived').forEach(function(n){n.remove();});
  var heading=card.querySelector('h5');if(heading)heading.textContent=isKo()?'동명사':'Gerunds';

  var originalExamples=card.querySelector('.book-study-grammar-examples');if(originalExamples)originalExamples.hidden=true;
  if(old)old.hidden=true;

  if(gerundItems.length){
    var gerundRows=gerundItems.map(gerundParts).filter(Boolean);
    var gerundBuilder=makeBuilder(gerundRows,isKo()?'문장 만들기':'Build a sentence','semantic-gerund',gerundItems);
    if(anchor)card.insertBefore(gerundBuilder,anchor);else card.appendChild(gerundBuilder);
  }

  var freqWrap=document.createElement('div');freqWrap.className='book-study-grammar-derived';freqWrap.setAttribute('data-derived-grammar','frequency');
  var freqHeading=document.createElement('h5');freqHeading.className='book-study-grammar-derived-heading';freqHeading.textContent=isKo()?'빈도부사':'Frequency Adverbs';freqWrap.appendChild(freqHeading);
  if(freqItems.length){
    var freqRows=freqItems.map(frequencyStatementParts).filter(Boolean);
    freqWrap.appendChild(makeBuilder(freqRows,isKo()?'문장 만들기':'Build a sentence','semantic-frequency-statement',freqItems));
  }
  if(freqQuestionItems.length){
    var qRows=freqQuestionItems.map(frequencyQuestionParts).filter(Boolean);
    var qExamples=freqQuestionItems.concat(freqItems).slice(0,4);
    freqWrap.appendChild(makeBuilder(qRows,isKo()?'의문사 질문 만들기':'Build a WH question','semantic-frequency-wh-question',qExamples));
  }
  if(freqItems.length||freqQuestionItems.length){if(anchor)card.insertBefore(freqWrap,anchor);else card.appendChild(freqWrap);}
  return true;
}

function decorate(){
  root.querySelectorAll('.book-study-grammar').forEach(function(card){
    var info=readCard(card),old=card.querySelector('.book-study-grammar-chart'),anchor=old||card.querySelector('.book-study-grammar-examples')||null;
    if(semanticSplitCard(card,info,old,anchor))return;

    var pk=primaryKind(info.name,info.explanation),rows=builderRows(info.name,info.explanation,info.examples),made=false;
    if(rows&&rows.length)made=addBuilder(card,anchor,rows,isKo()?'문장 만들기':'Build a sentence','statement',examplesFor(info,'statement',pk))||made;
    if(pk){
      made=addBuilder(card,anchor,yesNoRowsFor(pk,info.examples),isKo()?'예/아니오 질문 만들기':'Build a yes/no question','question',examplesFor(info,'yesno',pk))||made;
      made=addBuilder(card,anchor,whRowsFor(pk,info.examples),isKo()?'의문사 질문 만들기':'Build a WH question','wh-question',examplesFor(info,'wh',pk))||made;
    }

    var extras=detectedKinds(info.examples).filter(function(k){return k&&k!==pk;});
    extras.forEach(function(kind){
      if(card.querySelector('[data-derived-grammar="'+kind+'"]'))return;
      var yes=yesNoRowsFor(kind,info.examples),wh=whRowsFor(kind,info.examples);if((!yes||!yes.length)&&(!wh||!wh.length))return;
      var wrap=document.createElement('div');wrap.className='book-study-grammar-derived';wrap.setAttribute('data-derived-grammar',kind);wrap.appendChild(makePointHeading(kind));
      if(yes&&yes.length)wrap.appendChild(makeBuilder(yes,isKo()?'예/아니오 질문 만들기':'Build a yes/no question','derived-yesno',examplesFor(info,'yesno',kind)));
      if(wh&&wh.length)wrap.appendChild(makeBuilder(wh,isKo()?'의문사 질문 만들기':'Build a WH question','derived-wh',examplesFor(info,'wh',kind)));
      if(anchor)card.insertBefore(wrap,anchor);else card.appendChild(wrap);made=true;
    });

    if(!made&&!card.querySelector('.book-study-grammar-builder'))made=addGenericFallback(card,anchor,info)||made;
    if(old&&made)old.hidden=true;
  });
  root.querySelectorAll('.book-study-section[data-kind="grammar"] .book-study-section-head span').forEach(function(count){var section=count.closest('.book-study-section'),base=section?section.querySelectorAll('.book-study-grammar').length:0,extra=section?section.querySelectorAll('.book-study-grammar-derived').length:0;count.textContent=String(base+extra);});
}

var modal=null,modalBody=null,lastFocus=null;
function ensureModal(){
  if(modal)return;
  modal=document.createElement('div');modal.className='book-study-grammar-modal';modal.hidden=true;modal.innerHTML='<div class="book-study-grammar-modal-panel" role="dialog" aria-modal="true"><button class="book-study-grammar-modal-close" type="button" aria-label="Close">×</button><div class="book-study-grammar-modal-body"></div></div>';
  document.body.appendChild(modal);modalBody=modal.querySelector('.book-study-grammar-modal-body');
  modal.querySelector('.book-study-grammar-modal-close').addEventListener('click',closeModal);
  modal.addEventListener('click',function(e){if(e.target===modal)closeModal();});
}
function openModal(chart){ensureModal();lastFocus=document.activeElement;modalBody.innerHTML='';var clone=chart.cloneNode(true);clone.removeAttribute('role');clone.removeAttribute('tabindex');clone.removeAttribute('aria-label');clone.classList.add('is-modal-copy');modalBody.appendChild(clone);modal.hidden=false;document.body.classList.add('grammar-modal-open');modal.querySelector('.book-study-grammar-modal-close').focus();}
function closeModal(){if(!modal||modal.hidden)return;modal.hidden=true;modalBody.innerHTML='';document.body.classList.remove('grammar-modal-open');if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus();}
root.addEventListener('click',function(e){var chart=e.target.closest('.book-study-grammar-builder');if(chart&&root.contains(chart))openModal(chart);});
root.addEventListener('keydown',function(e){var chart=e.target.closest('.book-study-grammar-builder');if(chart&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openModal(chart);}});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});

var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;decorate();});}
if(window.MutationObserver)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(function(){root.querySelectorAll('.book-study-grammar-builder,.book-study-grammar-derived').forEach(function(n){n.remove();});schedule();},40);});
schedule();
})();
