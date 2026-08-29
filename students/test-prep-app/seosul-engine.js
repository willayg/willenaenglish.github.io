(function(){
'use strict';
const U='https://gxwfsqxyuufqtitspfqg.supabase.co';
const K=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const H={apikey:K,Authorization:`Bearer ${K}`};
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=a=>[...a].sort(()=>Math.random()-.5);
let bank=[],questions=[],index=0,score=0,wrongIds=[],startedAt=0,checked=false;

function installStyles(){if($('#seosulStyles'))return;const s=document.createElement('style');s.id='seosulStyles';s.textContent=`
.seosul-kind{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:#eef9fa;color:#19777e;font-size:11px;font-weight:800;margin-bottom:12px}
.seosul-instruction{font-size:13px;color:#68747d;margin:0 0 12px;line-height:1.55}
.seosul-source{padding:16px 17px;border:1.5px solid #dde5e8;border-radius:15px;background:#f8fafb;font-size:16px;line-height:1.65;margin:0 0 14px;white-space:pre-wrap}
.seosul-bank{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}.seosul-word{border:1.5px solid #cfdadd;background:#fff;border-radius:10px;padding:7px 10px;font-weight:700;font-size:13px;color:#47545d}
.seosul-answer{width:100%;min-height:56px;box-sizing:border-box;border:2px solid #d9e2e5;border-radius:14px;padding:13px 14px;font:600 16px/1.45 inherit;resize:vertical;outline:none;background:#fff;color:#303941}.seosul-answer:focus{border-color:#58c3d2;box-shadow:0 0 0 3px rgba(88,195,210,.12)}
.seosul-order{display:flex;flex-wrap:wrap;gap:8px;min-height:48px;padding:10px;border:1.5px dashed #cfdadd;border-radius:13px;margin-bottom:10px;background:#fbfcfc}.seosul-order .seosul-word{cursor:pointer}.seosul-order.answer{border-style:solid;background:#f4fbfc}
.seosul-model{display:none;margin-top:12px;padding:13px 14px;border-radius:12px;background:#f4f7f8;font-size:14px;line-height:1.6}.seosul-model.show{display:block}.seosul-model b{display:block;color:#19777e;margin-bottom:4px}
.seosul-self{display:none;gap:8px;margin-top:10px}.seosul-self.show{display:flex}.seosul-self button{flex:1;border:0;border-radius:12px;padding:12px;font-weight:800;cursor:pointer}.seosul-self .yes{background:#19777e;color:#fff}.seosul-self .no{background:#edf1f2;color:#47545d}
`;
document.head.appendChild(s)}

async function get(path){const r=await fetch(U+path,{headers:H,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
function inFilter(ids){return encodeURIComponent('('+ids.join(',')+')')}
function cleanBreaks(v){return String(v||'').replace(/\\\\n/g,'\n').replace(/\\n/g,'\n').replace(/\r/g,'').trim()}
function stripSpeaker(line){return String(line||'').replace(/^[^:：]{1,28}[:：]\s*/, '').trim()}
function tokenize(s){return String(s||'').replace(/[“”"!?.,;:()]/g,'').split(/\s+/).filter(Boolean)}
function norm(s){return String(s??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[.!?,;:]+$/g,'').replace(/\s+/g,' ').trim()}
function same(a,b){return norm(a)===norm(b)}
function stable(type,id,extra=''){return `seosul:${type}:${id}${extra?':'+extra:''}`}

function passagePairs(passages){const out=[];for(const p of passages){const en=cleanBreaks(p.body).split('\n').map(x=>x.trim()).filter(Boolean);let ko=Array.isArray(p.metadata?.sentence_translations_ko)?p.metadata.sentence_translations_ko:cleanBreaks(p.translation_ko).split('\n').map(x=>x.trim()).filter(Boolean);if(en.length!==ko.length)continue;for(let i=0;i<en.length;i++){const a=stripSpeaker(en[i]),b=stripSpeaker(ko[i]);if(!a||!b||tokenize(a).length<3||tokenize(a).length>18)continue;out.push({passage:p,index:i,en:a,ko:b})}}return out}
function reqWords(en){const stop=new Set(['the','a','an','is','are','was','were','am','be','been','to','of','in','on','at','for','and','or','but','it','i','you','we','they','he','she','this','that','than','with']);const words=tokenize(en).map(x=>x.replace(/[^A-Za-z'-]/g,'')).filter(x=>x.length>=3&&!stop.has(x.toLowerCase()));return [...new Set(words)].slice(0,3)}

function makeDefinition(lex){return lex.filter(x=>x.definition_en&&x.canonical_text).map(x=>({
 id:stable('definition_to_word',x.id),type:'definition_to_word',kind:'정의 → 단어',instruction:'영어 정의에 맞는 단어나 표현을 쓰세요.',source:x.definition_en,answer:x.canonical_text,targets:['vocabulary'],origin:x.id
}))}
function makeKoEn(lex){return lex.filter(x=>x.translation_ko&&x.canonical_text).map(x=>({
 id:stable('korean_to_english',x.id),type:'korean_to_english',kind:'우리말 → 영어',instruction:'우리말 뜻에 맞는 단어나 표현을 영어로 쓰세요.',source:x.translation_ko,answer:x.canonical_text,targets:['vocabulary'],origin:x.id
}))}
function makeWordBank(pairs){return pairs.map(x=>{const words=shuffle(tokenize(x.en));return{
 id:stable('word_bank_sentence',x.passage.id,x.index),type:'word_bank_sentence',kind:'단어 배열 영작',instruction:'보기의 단어를 모두 사용하여 우리말과 같은 문장을 쓰세요.',source:x.ko,bank:words,answer:x.en,targets:['sentence_production'],origin:x.passage.id
}})}
function makeUnscramble(pairs){return pairs.map(x=>({
 id:stable('sentence_unscramble',x.passage.id,x.index),type:'sentence_unscramble',kind:'문장 순서 배열',instruction:'단어를 눌러 올바른 문장을 만드세요.',source:x.ko,chips:shuffle(tokenize(x.en)),answer:x.en,targets:['sentence_order'],origin:x.passage.id
}))}
function makeConstrained(pairs){return pairs.map(x=>{const words=reqWords(x.en),n=tokenize(x.en).length;if(!words.length)return null;return{
 id:stable('constrained_translation',x.passage.id,x.index),type:'constrained_translation',kind:'조건 영작',instruction:`우리말과 같도록 영어로 쓰세요. (${n}단어 · ${words.join(', ')} 포함)`,source:x.ko,bank:words,answer:x.en,targets:['sentence_production'],origin:x.passage.id
}}).filter(Boolean)}
function makeDialogue(dialogues){const out=[];for(const d of dialogues){const full=cleanBreaks(d.metadata?.full_text);const lines=full.split('\n').map(x=>x.trim()).filter(Boolean);if(lines.length<2)continue;for(let i=0;i<lines.length;i++){const m=lines[i].match(/^([^:：]{1,28}[:：])\s*(.+)$/);if(!m||!m[2])continue;const shown=lines.map((line,j)=>j===i?`${m[1]} ______`:line).join('\n');out.push({id:stable('dialogue_completion',d.id,i),type:'dialogue_completion',kind:'대화 완성',instruction:'대화의 빈칸에 들어갈 말을 쓰세요.',source:shown,answer:m[2].trim(),targets:[d.language_function||'communication'],origin:d.id})}}return out}
function makeReadingTranslation(pairs){return pairs.map(x=>({
 id:stable('reading_translation',x.passage.id,x.index),type:'reading_translation',kind:'본문 해석',instruction:'다음 본문 문장을 우리말로 해석하세요. 정답을 확인한 뒤 스스로 채점합니다.',source:x.en,answer:x.ko,selfCheck:true,targets:['reading_translation'],origin:x.passage.id
}))}

async function loadBank(unitId){
 const occ=await get(`/rest/v1/source_content_occurrences?select=lexical_entry_id,passage_id&unit_id=eq.${encodeURIComponent(unitId)}`);
 const lexIds=[...new Set(occ.map(x=>x.lexical_entry_id).filter(Boolean))],passageIds=[...new Set(occ.map(x=>x.passage_id).filter(Boolean))];
 const [lex,passages,dialogues]=await Promise.all([
  lexIds.length?get(`/rest/v1/lexical_entries?select=id,canonical_text,headword,translation_ko,definition_en,part_of_speech&status=neq.archived&id=in.${inFilter(lexIds)}`):[],
  passageIds.length?get(`/rest/v1/passages?select=id,title,body,translation_ko,metadata,source_key&id=in.${inFilter(passageIds)}`):[],
  get(`/rest/v1/source_dialogues?select=id,title,language_function,metadata,source_key&unit_id=eq.${encodeURIComponent(unitId)}&status=neq.archived`)
 ]);
 const pairs=passagePairs(passages);
 const groups=[makeDefinition(lex),makeKoEn(lex),makeWordBank(pairs),makeUnscramble(pairs),makeConstrained(pairs),makeDialogue(dialogues),makeReadingTranslation(pairs)];
 bank=groups.flat();
 const picked=[];for(const g of groups){picked.push(...shuffle(g).slice(0,4))}
 questions=shuffle(picked).slice(0,20);
 return{bank,questions,counts:{definition_to_word:groups[0].length,korean_to_english:groups[1].length,word_bank_sentence:groups[2].length,sentence_unscramble:groups[3].length,constrained_translation:groups[4].length,dialogue_completion:groups[5].length,reading_translation:groups[6].length}};
}

function cardEl(){return $('#card')}function barEl(){return $('#bar')}
function head(q){return `<div class="card-head"><div class="qnum">${index+1} / ${questions.length}</div><div style="display:flex;align-items:center;gap:4px"><span class="source w">서술형 · 자동 생성</span></div></div>`}
function sourceHtml(q){return `<div class="seosul-kind">${esc(q.kind)}</div><p class="seosul-instruction">${esc(q.instruction)}</p><div class="seosul-source">${esc(q.source)}</div>${q.bank?.length?`<div class="seosul-bank">${q.bank.map(w=>`<span class="seosul-word">${esc(w)}</span>`).join('')}</div>`:''}`}
function renderOrder(q){return `${sourceHtml(q)}<div class="seosul-order answer" id="seosulBuilt"></div><div class="seosul-order" id="seosulPool">${q.chips.map((w,i)=>`<button type="button" class="seosul-word" data-chip="${i}">${esc(w)}</button>`).join('')}</div><div class="feedback" id="feedback"></div><div class="actions"><button class="primary" id="seosulCheck" disabled>정답 확인</button></div>`}
function renderInput(q){return `${sourceHtml(q)}<textarea class="seosul-answer" id="seosulAnswer" autocomplete="off" autocapitalize="sentences" spellcheck="false" placeholder="답을 입력하세요"></textarea><div class="feedback" id="feedback"></div><div class="seosul-model" id="seosulModel"><b>모범 답안</b>${esc(q.answer)}</div>${q.selfCheck?'<div class="seosul-self" id="seosulSelf"><button class="no" data-self="0">다시 볼래요</button><button class="yes" data-self="1">맞았어요</button></div>':''}<div class="actions"><button class="primary" id="seosulCheck" disabled>정답 확인</button></div>`}
function render(){const card=cardEl(),bar=barEl();if(!card)return;if(!questions.length){card.innerHTML='<div class="empty">이 Lesson에서 만들 수 있는 서술형 문제가 아직 없습니다.</div>';if(bar)bar.style.width='0';return}if(index>=questions.length)return result();checked=false;startedAt=Date.now();if(bar)bar.style.width=`${index/questions.length*100}%`;const q=questions[index];card.innerHTML=head(q)+`<div class="body">${q.type==='sentence_unscramble'?renderOrder(q):renderInput(q)}</div>`;if(q.type==='sentence_unscramble')wireOrder(q);else wireInput(q)}
function wireInput(q){const input=$('#seosulAnswer'),btn=$('#seosulCheck');input.oninput=()=>btn.disabled=!input.value.trim();input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!btn.disabled){e.preventDefault();btn.click()}};btn.onclick=()=>checkInput(q,input.value);setTimeout(()=>input.focus(),30)}
function wireOrder(q){const built=$('#seosulBuilt'),pool=$('#seosulPool'),btn=$('#seosulCheck'),selected=[];function redraw(){built.innerHTML=selected.map((x,i)=>`<button type="button" class="seosul-word" data-built="${i}">${esc(x.word)}</button>`).join('');pool.querySelectorAll('[data-chip]').forEach(b=>b.hidden=selected.some(x=>x.i===Number(b.dataset.chip)));btn.disabled=!selected.length;built.querySelectorAll('[data-built]').forEach(b=>b.onclick=()=>{selected.splice(Number(b.dataset.built),1);redraw()})}pool.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{selected.push({i:Number(b.dataset.chip),word:b.textContent});redraw()});btn.onclick=()=>checkInput(q,selected.map(x=>x.word).join(' '));redraw()}
async function saveAttempt(q,mine,ok){try{await window.WillenaTestPrepAuth?.recordAttempt?.({practice_type:'constructed_response',question_id:q.id,selected_answer:mine,correct_answer:q.answer,is_correct:ok,question_type:q.type,targets:q.targets||[],response_time_ms:Date.now()-startedAt,metadata:{generated:true,origin_id:q.origin,engine:'seosul_v1'}})}catch(_){}}
function feedback(ok,q){const f=$('#feedback');if(f){f.className='feedback '+(ok?'ok':'bad');f.textContent=ok?'정답입니다!':'정답을 확인해 보세요.'}const model=$('#seosulModel');if(model)model.classList.add('show');const btn=$('#seosulCheck');if(btn){btn.disabled=false;btn.textContent=index===questions.length-1?'결과 보기':'다음 문제';btn.onclick=()=>{index++;render()}}}
async function checkInput(q,mine){if(checked)return;if(q.selfCheck){checked=true;$('#seosulModel')?.classList.add('show');$('#seosulSelf')?.classList.add('show');const btn=$('#seosulCheck');if(btn)btn.style.display='none';$('#seosulSelf')?.querySelectorAll('[data-self]').forEach(b=>b.onclick=async()=>{const ok=b.dataset.self==='1';if(ok)score++;else wrongIds.push(q.id);await saveAttempt(q,mine,ok);index++;render()});return}checked=true;const ok=same(mine,q.answer);if(ok)score++;else wrongIds.push(q.id);await saveAttempt(q,mine,ok);feedback(ok,q)}
function result(){const card=cardEl(),bar=barEl();if(bar)bar.style.width='100%';window.WillenaTestPrepAuth?.completeSession?.(score,questions.length,wrongIds);const p=questions.length?Math.round(score/questions.length*100):0;card.innerHTML=`<div class="result"><div class="score">${score}/${questions.length}</div><h2>${p>=80?'서술형 준비가 잘 되고 있어요.':'틀린 유형을 한 번 더 연습해 보세요.'}</h2><p>정답률 ${p}% · 다시 볼 문제 ${wrongIds.length}개</p><div class="actions"><button class="secondary" id="seosulAgain">새 문제 세트</button></div></div>`;$('#seosulAgain').onclick=()=>{questions=shuffle(bank).slice(0,20);index=0;score=0;wrongIds=[];render()}}
async function start(opts={}){installStyles();const card=cardEl(),bar=barEl();if(card)card.innerHTML='<div class="loading">서술형 문제를 만들고 있어요...</div>';if(bar)bar.style.width='0';index=0;score=0;wrongIds=[];const unitId=opts.unitId||window.WillenaAssignedTestPrep?.selection?.unitId;if(!unitId)throw new Error('Lesson 정보를 찾지 못했습니다.');const data=await loadBank(unitId);render();return data}

window.WillenaSeosulEngine={start,loadBank,get bank(){return bank},get questions(){return questions}};
})();