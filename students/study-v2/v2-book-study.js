(function(){
'use strict';
var ROOT='https://gxwfsqxyuufqtitspfqg.supabase.co/rest/v1/';
var KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var sourceStrip=document.getElementById('unitStrip');
var studyStrip=document.getElementById('bookStudyUnitStrip');
var currentLabel=document.getElementById('bookStudyCurrentUnitLabel');
var contentRoot=document.getElementById('bookStudyContent');
var bookStudyNote=document.getElementById('bookStudyNote');
if(!sourceStrip||!studyStrip||!contentRoot)return;
var activeUnitId='';
var activeKind='vocabulary';
var requestToken=0;
var cached=null;

function ko(){var b=document.getElementById('languageBtn');return !b||String(b.textContent||'').trim()==='English';}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function txt(v){return String(v==null?'':v).trim();}
function uniq(list){var out=[],seen={};(list||[]).forEach(function(v){v=txt(v);var k=v.toLowerCase();if(v&&!seen[k]){seen[k]=1;out.push(v);}});return out;}
function ids(rows,key){return uniq((rows||[]).map(function(r){return r&&r[key];}).filter(Boolean));}
function byId(rows){var m={};(rows||[]).forEach(function(r){if(r&&r.id)m[String(r.id)]=r;});return m;}
function listQuery(values){return encodeURIComponent('('+values.join(',')+')');}
function occurrenceTranslation(o){return txt(o&&o.metadata&&o.metadata.translation_ko);}
function listenButton(value){return '<button class="book-study-listen" type="button" data-listen-text="'+esc(value)+'">'+(ko()?'듣기':'Listen')+'</button>';}
async function rest(path){var r=await fetch(ROOT+path,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'});if(!r.ok)throw new Error('Content DB '+r.status);var d=await r.json();return Array.isArray(d)?d:[];}
function state(message){contentRoot.innerHTML='<div class="book-study-content-state">'+esc(message)+'</div>';}
function currentSourceButton(){return sourceStrip.querySelector('.study-v2-unit.is-current,[data-unit-id].is-current')||sourceStrip.querySelector('[data-unit-id]');}
function sourceButtonById(id){var out=null;Array.prototype.some.call(sourceStrip.querySelectorAll('[data-unit-id]'),function(b){if(txt(b.getAttribute('data-unit-id'))===id){out=b;return true;}return false;});return out;}
function mirrorUnits(){var buttons=Array.prototype.slice.call(sourceStrip.querySelectorAll('[data-unit-id]'));if(!buttons.length){studyStrip.innerHTML='';if(!activeUnitId)state(ko()?'교재를 불러오는 중이에요.':'Loading your book…');return;}studyStrip.innerHTML=buttons.map(function(b){var id=txt(b.getAttribute('data-unit-id'));var on=b.classList.contains('is-current');return '<button class="book-study-unit'+(on?' is-current':'')+'" type="button" data-study-unit-id="'+esc(id)+'">'+esc(txt(b.textContent)||'Unit')+'</button>';}).join('');studyStrip.querySelectorAll('[data-study-unit-id]').forEach(function(b){b.addEventListener('click',function(){var id=txt(b.getAttribute('data-study-unit-id'));var target=sourceButtonById(id);if(target)target.click();studyStrip.querySelectorAll('.book-study-unit').forEach(function(x){x.classList.toggle('is-current',x===b);});loadUnit(id,txt(b.textContent));});});var current=currentSourceButton();if(current){var id=txt(current.getAttribute('data-unit-id'));if(id&&id!==activeUnitId)loadUnit(id,txt(current.textContent));else syncCurrentLabel(txt(current.textContent));}}
function syncCurrentLabel(fallback){var label=fallback||'';if(cached&&cached.unit){label='Unit '+cached.unit.unit_number+(cached.unit.title?' · '+cached.unit.title:'');}if(currentLabel)currentLabel.textContent=(ko()?'현재 · ':'Current · ')+(label||'Unit —');if(bookStudyNote)bookStudyNote.textContent='';}
function looksSentence(s){s=txt(s);return !!s&&(/[.?!]$/.test(s)||/^(what|where|when|who|why|how|do|does|did|is|are|was|were|can|could|will|would|should|have|has|had)\b/i.test(s));}
function isStudySentence(s){s=txt(s);return looksSentence(s)&&!(/[+{}]|→/.test(s));}

async function loadUnit(unitId,fallbackLabel){
  unitId=txt(unitId);if(!unitId)return;activeUnitId=unitId;var token=++requestToken;syncCurrentLabel(fallbackLabel);state(ko()?'교재 내용을 불러오는 중이에요.':'Loading book content…');
  try{
    var base=await Promise.all([
      rest('content_units?select=id,unit_number,title&id=eq.'+encodeURIComponent(unitId)+'&limit=1'),
      rest('source_content_occurrences?select=id,occurrence_type,skill,activity_label,source_text,lexical_entry_id,sentence_id,pattern_id,passage_id,page_number,metadata&unit_id=eq.'+encodeURIComponent(unitId)+'&status=in.(review,published)&order=page_number.asc.nullslast,created_at.asc')
    ]);
    if(token!==requestToken)return;
    var unit=base[0][0]||null,occ=base[1]||[];
    var lexicalIds=ids(occ,'lexical_entry_id'),sentenceIds=ids(occ,'sentence_id'),patternIds=ids(occ,'pattern_id');
    var details=await Promise.all([
      lexicalIds.length?rest('lexical_entries?select=id,canonical_text,translation_ko&id=in.'+listQuery(lexicalIds)+'&status=in.(review,published)'):Promise.resolve([]),
      sentenceIds.length?rest('sentences?select=id,text,canonical_text,translation_ko,grammar_notes&id=in.'+listQuery(sentenceIds)+'&status=in.(review,published)'):Promise.resolve([]),
      patternIds.length?rest('patterns?select=id,name,grammar_category,prompt_pattern,response_pattern,explanation_en,explanation_ko&id=in.'+listQuery(patternIds)+'&status=in.(review,published)'):Promise.resolve([])
    ]);
    if(token!==requestToken)return;
    cached={unit:unit,occ:occ,lex:byId(details[0]),sent:byId(details[1]),patterns:byId(details[2])};render(cached);syncCurrentLabel(fallbackLabel);
  }catch(e){console.warn('[StudyV2 Book Study]',e);if(token===requestToken)state(ko()?'교재 내용을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.':'Could not load the book content. Please try again.');}
}

function vocabSection(data){var rows=data.occ.filter(function(o){return o.occurrence_type==='lexical_entry'||(o.skill==='vocabulary'&&o.lexical_entry_id);});var seen={},items=[];rows.forEach(function(o){var d=data.lex[String(o.lexical_entry_id)]||{};var word=txt(d.canonical_text||o.source_text);if(!word)return;var key=word.toLowerCase();if(seen[key])return;seen[key]=1;items.push({word:word,translation:txt(d.translation_ko)||occurrenceTranslation(o)});});if(!items.length)return'';return section('vocabulary',ko()?'어휘':'Vocabulary',items.length,'<div class="book-study-vocab-grid">'+items.map(function(v){return '<div class="book-study-vocab"><div class="book-study-vocab-copy"><strong>'+esc(v.word)+'</strong>'+(v.translation?'<small>'+esc(v.translation)+'</small>':'')+'</div>'+listenButton(v.word)+'</div>';}).join('')+'</div>');}
function sentenceSection(data){var items=[],seen={};data.occ.forEach(function(o){var text='',translation='';if(o.occurrence_type==='sentence'&&o.sentence_id){var d=data.sent[String(o.sentence_id)]||{};text=txt(d.canonical_text||d.text||o.source_text);translation=txt(d.translation_ko)||occurrenceTranslation(o);}else if(o.occurrence_type==='sentence'){text=txt(o.source_text);translation=occurrenceTranslation(o);}else if(o.occurrence_type==='pattern'&&isStudySentence(o.source_text)){text=txt(o.source_text);translation=occurrenceTranslation(o);}if(!text)return;var key=text.toLowerCase();if(seen[key])return;seen[key]=1;items.push({text:text,translation:translation});});if(!items.length)return'';return section('sentences',ko()?'핵심 문장':'Key Sentences',items.length,'<div class="book-study-sentence-list">'+items.map(function(v){return '<div class="book-study-sentence"><div class="book-study-sentence-copy"><strong>'+esc(v.text)+'</strong>'+(v.translation?'<small>'+esc(v.translation)+'</small>':'')+'</div>'+listenButton(v.text)+'</div>';}).join('')+'</div>');}
function grammarSection(data){var groups={};data.occ.filter(function(o){return o.occurrence_type==='pattern'||o.skill==='grammar';}).forEach(function(o){if(!o.pattern_id)return;var id=String(o.pattern_id);if(!groups[id])groups[id]={detail:data.patterns[id]||{},examples:[]};if(isStudySentence(o.source_text))groups[id].examples.push({text:txt(o.source_text),translation:occurrenceTranslation(o)});});var cards=[];Object.keys(groups).forEach(function(id){var g=groups[id],d=g.detail||{};var name=txt(d.name||d.grammar_category||'Grammar');var explanation=txt((ko()?d.explanation_ko:d.explanation_en)||d.explanation_en||d.explanation_ko);var examples=[];for(var i=0;i<g.examples.length;i+=2){var first=g.examples[i],second=g.examples[i+1];examples.push('<div class="book-study-grammar-pair"><div><strong>'+esc(first.text)+'</strong>'+(first.translation?'<small>'+esc(first.translation)+'</small>':'')+'</div>'+(second?'<div><strong>'+esc(second.text)+'</strong>'+(second.translation?'<small>'+esc(second.translation)+'</small>':'')+'</div>':'')+'</div>');}cards.push('<div class="book-study-grammar"><h5>'+esc(name)+'</h5>'+(explanation?'<p>'+esc(explanation)+'</p>':'')+(examples.length?'<div class="book-study-grammar-examples">'+examples.join('')+'</div>':'')+'</div>');});if(!cards.length)return'';return section('grammar',ko()?'문법':'Grammar',cards.length,'<div class="book-study-grammar-list">'+cards.join('')+'</div>');}
function section(kind,title,count,body){return '<section class="book-study-section" data-kind="'+kind+'" id="bookStudy-'+kind+'" role="tabpanel"><div class="book-study-section-head"><h4>'+esc(title)+'</h4><span>'+count+'</span></div>'+body+'</section>';}
function setActiveKind(kind){var sections=Array.prototype.slice.call(contentRoot.querySelectorAll('.book-study-section'));if(!sections.length)return;var exists=sections.some(function(s){return s.getAttribute('data-kind')===kind;});if(!exists)kind=sections[0].getAttribute('data-kind')||'vocabulary';activeKind=kind;contentRoot.querySelectorAll('[data-study-kind]').forEach(function(b){var on=b.getAttribute('data-study-kind')===kind;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;});sections.forEach(function(s){var on=s.getAttribute('data-kind')===kind;s.hidden=!on;s.setAttribute('aria-hidden',on?'false':'true');});}
function bindAudio(){contentRoot.querySelectorAll('[data-listen-text]').forEach(function(button){button.addEventListener('click',function(){var value=txt(button.getAttribute('data-listen-text'));if(!value)return;var player=window.WillenaAudioPlayback;if(player&&typeof player.playText==='function')player.playText(button,value,{lang:'en-US',rate:.9});});});}
function render(data){var blocks=[],tabs=[];[['vocabulary',vocabSection],['sentences',sentenceSection],['grammar',grammarSection]].forEach(function(pair){var html=pair[1](data);if(html){blocks.push(html);var label={vocabulary:ko()?'어휘':'Vocabulary',sentences:ko()?'문장':'Sentences',grammar:ko()?'문법':'Grammar'}[pair[0]];tabs.push('<button type="button" role="tab" data-study-kind="'+pair[0]+'" aria-selected="false">'+esc(label)+'</button>');}});if(!blocks.length){state(ko()?'이 단원에는 아직 연결된 어휘, 문장 또는 문법이 없어요.':'No vocabulary, sentences, or grammar are linked to this unit yet.');return;}var unit=data.unit||{},unitName='Unit '+(unit.unit_number||'')+(unit.title?' · '+unit.title:'');contentRoot.innerHTML='<div class="book-study-content-top"><h3>'+esc(unitName)+'</h3></div><div class="book-study-jump" role="tablist" aria-label="'+(ko()?'교재 내용':'Book content')+'">'+tabs.join('')+'</div><div class="book-study-active-pane">'+blocks.join('')+'</div>';contentRoot.querySelectorAll('[data-study-kind]').forEach(function(b){b.addEventListener('click',function(){setActiveKind(b.getAttribute('data-study-kind'));});});bindAudio();setActiveKind(activeKind);}

if(window.MutationObserver)new MutationObserver(function(){setTimeout(mirrorUnits,0);}).observe(sourceStrip,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});var lang=document.getElementById('languageBtn');if(lang)lang.addEventListener('click',function(){setTimeout(function(){mirrorUnits();if(cached){render(cached);syncCurrentLabel();}},20);});mirrorUnits();setTimeout(mirrorUnits,250);setTimeout(mirrorUnits,900);setTimeout(mirrorUnits,1800);
})();