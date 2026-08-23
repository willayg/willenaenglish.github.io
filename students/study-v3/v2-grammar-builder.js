(function(){
'use strict';
var root=document.getElementById('bookStudyContent');
if(!root)return;

function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function uniq(list){var out=[],seen={};(list||[]).forEach(function(v){v=text(v).replace(/[.!?]+$/,'').trim();var k=v.toLowerCase();if(v&&!seen[k]){seen[k]=1;out.push(v);}});return out;}
function limit(list,n){return uniq(list).slice(0,n||4);}
function normaliseSentence(value){
  var s=text(value).replace(/[.!?]+$/,'').trim();
  return s
    .replace(/^I'm\b/i,'I am')
    .replace(/^You're\b/i,'You are')
    .replace(/^He's\b/i,'He is')
    .replace(/^She's\b/i,'She is')
    .replace(/^It's\b/i,'It is')
    .replace(/^We're\b/i,'We are')
    .replace(/^They're\b/i,'They are')
    .replace(/^What's\b/i,'What is')
    .replace(/^Where's\b/i,'Where is')
    .replace(/^When's\b/i,'When is')
    .replace(/^Who's\b/i,'Who is');
}
function optionText(values,fallback){var a=limit(values,4);return a.length?a.join(' / '):fallback;}
function collectAfter(examples,re){var out=[];(examples||[]).forEach(function(raw){var m=normaliseSentence(raw).match(re);if(m&&m[1])out.push(m[1]);});return uniq(out);}
function thirdForm(base){
  base=text(base).toLowerCase();if(!base)return'';
  if(/[^aeiou]y$/.test(base))return base.slice(0,-1)+'ies';
  if(/(s|x|z|ch|sh|o)$/.test(base))return base+'es';
  return base+'s';
}
function baseFromThird(verb){
  verb=text(verb).toLowerCase();if(!verb)return'';
  if(/[^aeiou]ies$/.test(verb))return verb.slice(0,-3)+'y';
  if(/(ches|shes|sses|xes|zes|oes)$/.test(verb))return verb.slice(0,-2);
  if(/s$/.test(verb)&&!/ss$/.test(verb))return verb.slice(0,-1);
  return verb;
}
function shiftSharedTo(verbA,verbB,complements){
  var list=uniq(complements);
  if(list.length&&list.every(function(v){return /^to\s+/i.test(v);})){
    return{a:verbA+' to',b:verbB+' to',rest:list.map(function(v){return v.replace(/^to\s+/i,'');})};
  }
  return{a:verbA,b:verbB,rest:list};
}
function rowsForPresentAgreement(name,explanation,examples){
  var signal=(name+' '+explanation).toLowerCase();
  if(signal.indexOf('present simple')<0&&signal.indexOf('present_simple')<0&&signal.indexOf('현재형')<0)return null;
  var parsed=[];
  examples.forEach(function(raw){
    var m=normaliseSentence(raw).match(/^(I|You|He|She|It|We|They)\s+([A-Za-z']+)\s+(.+)$/i);
    if(!m)return;
    var verb=m[2].toLowerCase();
    if(/^(am|is|are|was|were|can|could|should|would|will|have|has|had|do|does|did)$/.test(verb))return;
    parsed.push({subject:m[1],verb:verb,rest:m[3]});
  });
  if(!parsed.length)return null;
  var third=parsed.find(function(x){return /^(he|she|it)$/i.test(x.subject);});
  var other=parsed.find(function(x){return /^(i|you|we|they)$/i.test(x.subject);});
  var base=other&&other.verb||third&&baseFromThird(third.verb)||'';
  var thirdVerb=third&&third.verb||thirdForm(base);
  if(!base||!thirdVerb)return null;
  var rests=parsed.filter(function(x){return x.verb===base||x.verb===thirdVerb;}).map(function(x){return x.rest;});
  var shifted=shiftSharedTo(thirdVerb,base,rests);
  return[
    ['He / She / It',shifted.a,optionText(shifted.rest,'...')],
    ['I / You / We / They',shifted.b,optionText(shifted.rest,'...')]
  ];
}
function builderRows(name,explanation,examples){
  var signal=(name+' '+explanation).toLowerCase();

  if(/past simple: the verb be|past_be|과거형.*was|was.*were|was\/were/.test(signal)){
    var pastPlaces=collectAfter(examples,/^(?:I|You|He|She|It|We|They)\s+(?:was|were)\s+(.+)$/i);
    return[
      ['I / He / She / It','was',optionText(pastPlaces,'at the park / happy / tired')],
      ['You / We / They','were',optionText(pastPlaces,'at the park / happy / tired')]
    ];
  }

  if(/going to|be_going_to/.test(signal)){
    var future=collectAfter(examples,/\b(?:am|is|are)\s+going to\s+(.+)$/i);
    var futureText=optionText(future,'study / travel / visit ...');
    return[
      ['I','am going to',futureText],
      ['He / She / It','is going to',futureText],
      ['You / We / They','are going to',futureText]
    ];
  }

  if(/like to/.test(signal)){
    var likes=collectAfter(examples,/\b(?:like|likes)\s+to\s+(.+)$/i);
    var likeText=optionText(likes,'play / read / swim ...');
    return[
      ['He / She / It','likes to',likeText],
      ['I / You / We / They','like to',likeText]
    ];
  }

  if(/want to/.test(signal)){
    var wants=collectAfter(examples,/\b(?:want|wants)\s+to\s+(.+)$/i);
    var wantText=optionText(wants,'be a doctor / travel / study ...');
    return[
      ['He / She / It','wants to',wantText],
      ['I / You / We / They','want to',wantText]
    ];
  }

  if(/\bshould\b/.test(signal)){
    var shoulds=collectAfter(examples,/^(?:I|You|He|She|It|We|They)\s+should\s+(.+)$/i);
    return[['I / You / He / She / It / We / They','should',optionText(shoulds,'rest / study / take some medicine ...')]];
  }

  if(/modal_can|\bcan\b/.test(signal)){
    var cans=collectAfter(examples,/^(?:I|You|He|She|It|We|They)\s+can\s+(.+)$/i);
    if(cans.length)return[['I / You / He / She / It / We / They','can',optionText(cans,'swim / play / read ...')]];
  }

  if(/frequency|빈도/.test(signal)){
    var phrases=[],adverbs=[];
    examples.forEach(function(raw){
      var m=normaliseSentence(raw).match(/^(?:I|You|He|She|It|We|They)\s+(always|usually|often|sometimes|never)\s+(.+)$/i);
      if(m){adverbs.push(m[1].toLowerCase());phrases.push(m[2]);}
    });
    if(phrases.length){
      var basePhrase=phrases[0],parts=basePhrase.split(/\s+/),verb=parts.shift(),rest=parts.join(' '),third=thirdForm(verb);
      var adverbText=optionText(adverbs,['always','usually','sometimes','never'].join(' / '));
      return[
        ['He / She / It',adverbText,third+(rest?' '+rest:'')],
        ['I / You / We / They',adverbText,verb+(rest?' '+rest:'')]
      ];
    }
  }

  return rowsForPresentAgreement(name,explanation,examples);
}
function questionRows(name,explanation,examples){
  var signal=(name+' '+explanation).toLowerCase();
  var questions=(examples||[]).map(normaliseSentence).filter(function(s){return /^(?:am|is|are|was|were|do|does|did|can|could|will|would|should|have|has)\b/i.test(s);});
  if(!questions.length)return null;

  if(/going to|be_going_to/.test(signal)){
    var tails=[];
    questions.forEach(function(s){
      var m=s.match(/^(?:am|is|are)\s+(?:I|you|he|she|it|we|they)\s+going to\s+(.+)$/i);
      if(m&&m[1])tails.push(m[1]);
    });
    var tailText=optionText(tails,'do / take / visit ...');
    return[
      ['Am','I','going to',tailText],
      ['Is','He / She / It','going to',tailText],
      ['Are','You / We / They','going to',tailText]
    ];
  }

  if(/past simple: the verb be|past_be|과거형.*was|was.*were|was\/were/.test(signal)){
    var endings=[];
    questions.forEach(function(s){var m=s.match(/^(?:was|were)\s+(?:I|you|he|she|it|we|they)\s+(.+)$/i);if(m&&m[1])endings.push(m[1]);});
    var endingText=optionText(endings,'at the park / happy / tired');
    return[
      ['Was','I / He / She / It',endingText],
      ['Were','You / We / They',endingText]
    ];
  }

  return null;
}
function whQuestionRows(name,explanation,examples){
  var signal=(name+' '+explanation).toLowerCase();
  var questions=(examples||[]).map(normaliseSentence).filter(function(s){return /^(?:what|where|when|why|how|who)\b/i.test(s);});
  if(!questions.length)return null;
  var wh=[],tails=[];

  if(/going to|be_going_to/.test(signal)){
    questions.forEach(function(s){
      var m=s.match(/^(What|Where|When|Why|How|Who)\s+(am|is|are)\s+(I|you|he|she|it|we|they)\s+going to\s+(.+)$/i);
      if(m){wh.push(m[1]);tails.push(m[4]);}
    });
    if(!wh.length)return null;
    var whText=optionText(wh,'What / Where / When');
    var tailText=optionText(tails,'do / go / visit ...');
    return[
      [whText,'Am','I','going to',tailText],
      [whText,'Is','He / She / It','going to',tailText],
      [whText,'Are','You / We / They','going to',tailText]
    ];
  }

  if(/past simple: the verb be|past_be|과거형.*was|was.*were|was\/were/.test(signal)){
    questions.forEach(function(s){
      var m=s.match(/^(What|Where|When|Why|How|Who)\s+(was|were)\s+(I|you|he|she|it|we|they)(?:\s+(.+))?$/i);
      if(m){wh.push(m[1]);if(m[4])tails.push(m[4]);}
    });
    if(!wh.length)return null;
    var whBe=optionText(wh,'Where / When / Why');
    var beTail=optionText(tails,'yesterday / at the park / ...');
    return[
      [whBe,'Was','I / He / She / It',beTail],
      [whBe,'Were','You / We / They',beTail]
    ];
  }

  var doParsed=[];
  questions.forEach(function(s){
    var m=s.match(/^(What|Where|When|Why|How|Who)\s+(do|does|did)\s+(I|you|he|she|it|we|they)\s+(.+)$/i);
    if(m)doParsed.push({wh:m[1],aux:m[2].toLowerCase(),tail:m[4]});
  });
  if(doParsed.length){
    var whDo=optionText(doParsed.map(function(x){return x.wh;}),'What / Where / When');
    var doTails=optionText(doParsed.map(function(x){return x.tail;}),'do / go / like ...');
    if(doParsed.some(function(x){return x.aux==='did';}))return[[whDo,'Did','I / You / He / She / It / We / They',doTails]];
    return[
      [whDo,'Does','He / She / It',doTails],
      [whDo,'Do','I / You / We / They',doTails]
    ];
  }

  var modalParsed=[];
  questions.forEach(function(s){
    var m=s.match(/^(What|Where|When|Why|How|Who)\s+(can|could|will|would|should)\s+(I|you|he|she|it|we|they)\s+(.+)$/i);
    if(m)modalParsed.push({wh:m[1],aux:m[2],tail:m[4]});
  });
  if(modalParsed.length){
    return[[
      optionText(modalParsed.map(function(x){return x.wh;}),'What / Where / When'),
      optionText(modalParsed.map(function(x){return x.aux;}),'Can'),
      'I / You / He / She / It / We / They',
      optionText(modalParsed.map(function(x){return x.tail;}),'do / go / ...')
    ]];
  }

  return null;
}
function displayCellText(value){return text(value).replace(/\s*\/\s*/g,'\n');}
function makeCell(value,index){var c=document.createElement('div');c.className='book-study-grammar-builder-cell is-col-'+(index+1);c.textContent=displayCellText(value);return c;}
function makeBuilder(rows,titleText,kind){
  var wrap=document.createElement('div');wrap.className='book-study-grammar-builder'+(kind?' is-'+kind:'');
  var title=document.createElement('div');title.className='book-study-grammar-builder-title';title.textContent=titleText;wrap.appendChild(title);
  rows.forEach(function(values){
    var row=document.createElement('div');row.className='book-study-grammar-builder-row';row.style.setProperty('--grammar-chunks',String(values.length));
    values.forEach(function(v,i){row.appendChild(makeCell(v,i));});wrap.appendChild(row);
  });
  return wrap;
}
function readCard(card){
  var name=text(card.querySelector('h5')&&card.querySelector('h5').textContent);
  var explanation='';Array.prototype.forEach.call(card.children,function(ch){if(ch.tagName==='P'&&!explanation)explanation=text(ch.textContent);});
  var examples=Array.prototype.map.call(card.querySelectorAll('.book-study-grammar-examples strong'),function(n){return text(n.textContent);}).filter(Boolean);
  return{name:name,explanation:explanation,examples:examples};
}
function decorate(){
  root.querySelectorAll('.book-study-grammar').forEach(function(card){
    var info=readCard(card),rows=builderRows(info.name,info.explanation,info.examples),qRows=questionRows(info.name,info.explanation,info.examples),whRows=whQuestionRows(info.name,info.explanation,info.examples);
    if((!rows||!rows.length)&&(!qRows||!qRows.length)&&(!whRows||!whRows.length))return;
    var old=card.querySelector('.book-study-grammar-chart');
    var anchor=old||card.querySelector('.book-study-grammar-examples')||null;
    if(rows&&rows.length&&!card.querySelector('.book-study-grammar-builder.is-statement')){
      var builder=makeBuilder(rows,isKo()?'문장 만들기':'Build a sentence','statement');
      if(anchor)card.insertBefore(builder,anchor);else card.appendChild(builder);
      card.classList.add('has-substitution-builder');
    }
    if(qRows&&qRows.length&&!card.querySelector('.book-study-grammar-builder.is-question')){
      var qBuilder=makeBuilder(qRows,isKo()?'예/아니오 질문 만들기':'Build a yes/no question','question');
      if(old)card.insertBefore(qBuilder,old);else if(anchor)card.insertBefore(qBuilder,anchor);else card.appendChild(qBuilder);
      card.classList.add('has-question-builder');
    }
    if(whRows&&whRows.length&&!card.querySelector('.book-study-grammar-builder.is-wh-question')){
      var whBuilder=makeBuilder(whRows,isKo()?'의문사 질문 만들기':'Build a WH question','wh-question');
      if(old)card.insertBefore(whBuilder,old);else if(anchor)card.insertBefore(whBuilder,anchor);else card.appendChild(whBuilder);
      card.classList.add('has-wh-question-builder');
    }
    if(old)old.hidden=true;
  });
}
var scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;decorate();});}
if(window.MutationObserver)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(function(){root.querySelectorAll('.book-study-grammar-builder').forEach(function(n){n.remove();});schedule();},40);});
schedule();
})();
