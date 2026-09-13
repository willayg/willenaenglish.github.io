(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const AUTH='/.netlify/functions/supabase_auth';
const SKILL_ORDER=['phonics','vocabulary','grammar','listening','reading','sentence_building','writing','speaking'];
let bank=[];
let filtered=[];
let currentId='';

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function text(v){return String(v??'').trim()}
function label(v){return text(v).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function sourceKey(q){return text(q?.metadata?.source_key||q?.id)}
function isVisual(q){return Array.isArray(q?.options)&&q.options.some(o=>o&&(o.kind==='image'||o.assetKey||o.src))}
function typeName(q){return text(q?.type||q?.metadata?.database_item_type||q?.renderKind||'question')}
function previewUrl(q){return '/visit-level-test/?question='+encodeURIComponent(sourceKey(q))+'&viewer=1'}
function qSearch(q){return [sourceKey(q),q?.prompt,q?.q,q?.context,q?.meaning,q?.answerValue,q?.a,q?.stimulus?.text,q?.metadata?.transcript,q?.skill,typeName(q)].map(text).join(' ').toLowerCase()}
function skillRank(v){const i=SKILL_ORDER.indexOf(text(v));return i<0?99:i}

async function api(url){const r=await fetch(url,{credentials:'include',cache:'no-store'});let j={};try{j=await r.json()}catch{}if(!r.ok)throw Error(j.error||`Request failed (${r.status})`);return j}
async function requireTeacher(){
  try{
    const who=await api(AUTH+'?action=whoami');
    if(!who.user_id)throw Error('No session');
    const role=await api(AUTH+'?action=get_role&user_id='+encodeURIComponent(who.user_id));
    if(!['teacher','admin'].includes(text(role.role).toLowerCase()))throw Error('Teacher access required');
    return true;
  }catch{
    location.href='/Teachers/login.html?redirect='+encodeURIComponent(location.pathname+location.search);
    return false;
  }
}
function fillSelect(select,values,allLabel){
  select.innerHTML='<option value="all">'+esc(allLabel)+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(label(v))+'</option>').join('');
}
function setupFilters(){
  const levels=[...new Set(bank.map(q=>Number(q.level)).filter(Number.isFinite))].sort((a,b)=>a-b);
  $('#levelFilter').innerHTML='<option value="all">All levels</option>'+levels.map(n=>'<option value="'+n+'">Internal '+n+'</option>').join('');
  const skills=[...new Set(bank.map(q=>text(q.skill)).filter(Boolean))].sort((a,b)=>skillRank(a)-skillRank(b)||a.localeCompare(b));
  fillSelect($('#skillFilter'),skills,'All skills');
  const types=[...new Set(bank.map(typeName).filter(Boolean))].sort();
  fillSelect($('#typeFilter'),types,'All types');
}
function sortBank(items){
  return items.slice().sort((a,b)=>Number(a.level)-Number(b.level)||skillRank(a.skill)-skillRank(b.skill)||Number(a.difficulty||0)-Number(b.difficulty||0)||sourceKey(a).localeCompare(sourceKey(b)));
}
function renderList(){
  const host=$('#questionList');
  $('#count').textContent=`${filtered.length} of ${bank.length} questions`;
  if(!filtered.length){host.innerHTML='<div class="empty">No questions match these filters.</div>';updatePreview(null);return}
  if(!filtered.some(q=>sourceKey(q)===currentId))currentId=sourceKey(filtered[0]);
  host.innerHTML=filtered.map((q,i)=>{
    const id=sourceKey(q),visual=isVisual(q);
    return `<button class="question-row ${id===currentId?'active':''}" type="button" data-id="${esc(id)}"><span class="question-index">${i+1}</span><span class="question-copy"><strong>${esc(id)}</strong><p>${esc(q.prompt||q.q||'Untitled question')}</p><span class="row-badges"><span>L${esc(q.level)}</span><span>${esc(label(q.skill||typeName(q)))}</span>${visual?'<span class="visual">IMAGE</span>':''}</span></span></button>`;
  }).join('');
  $$('.question-row',host).forEach(b=>b.addEventListener('click',()=>selectQuestion(b.dataset.id)));
  updatePreview(filtered.find(q=>sourceKey(q)===currentId)||filtered[0],false);
}
function applyFilters(){
  const level=$('#levelFilter').value;
  const skill=$('#skillFilter').value;
  const type=$('#typeFilter').value;
  const visual=$('#visualFilter').value;
  const query=text($('#searchInput').value).toLowerCase();
  filtered=bank.filter(q=>{
    if(level!=='all'&&String(q.level)!==level)return false;
    if(skill!=='all'&&text(q.skill)!==skill)return false;
    if(type!=='all'&&typeName(q)!==type)return false;
    if(visual==='visual'&&!isVisual(q))return false;
    if(visual==='text'&&isVisual(q))return false;
    if(query&&!qSearch(q).includes(query))return false;
    return true;
  });
  renderList();
}
function updatePreview(q,load=true){
  const frame=$('#previewFrame'),loading=$('#frameLoading'),open=$('#openBtn');
  if(!q){
    currentId='';
    $('#currentTitle').textContent='Question —';
    $('#currentSub').textContent='No matching question';
    frame.removeAttribute('src');
    loading.classList.remove('hidden');
    loading.textContent='No question selected';
    $('#prevBtn').disabled=true;$('#nextBtn').disabled=true;open.href='#';
    return;
  }
  currentId=sourceKey(q);
  const idx=filtered.findIndex(x=>sourceKey(x)===currentId);
  $('#currentTitle').textContent=`${idx+1} / ${filtered.length} · ${currentId}`;
  $('#currentSub').textContent=`Internal ${q.level} · ${label(q.skill||typeName(q))}${isVisual(q)?' · image choices':''}`;
  const url=previewUrl(q);
  open.href=url;
  $('#prevBtn').disabled=idx<=0;
  $('#nextBtn').disabled=idx<0||idx>=filtered.length-1;
  if(load){loading.textContent='Loading question…';loading.classList.remove('hidden');frame.src=url}
  $$('.question-row').forEach(row=>row.classList.toggle('active',row.dataset.id===currentId));
  const active=$('.question-row.active');if(active)active.scrollIntoView({block:'nearest'});
}
function selectQuestion(id,{push=true}={}){
  const q=filtered.find(x=>sourceKey(x)===id)||bank.find(x=>sourceKey(x)===id);
  if(!q)return;
  currentId=sourceKey(q);
  updatePreview(q,true);
  if(push){const u=new URL(location.href);u.searchParams.set('question',currentId);history.replaceState(null,'',u)}
}
function step(delta){
  const idx=filtered.findIndex(q=>sourceKey(q)===currentId);
  const next=filtered[idx+delta];if(next)selectQuestion(sourceKey(next));
}
function bind(){
  ['levelFilter','skillFilter','typeFilter','visualFilter'].forEach(id=>$('#'+id).addEventListener('change',applyFilters));
  $('#searchInput').addEventListener('input',applyFilters);
  $('#resetFilters').addEventListener('click',()=>{['levelFilter','skillFilter','typeFilter','visualFilter'].forEach(id=>$('#'+id).value='all');$('#searchInput').value='';applyFilters()});
  $('#prevBtn').addEventListener('click',()=>step(-1));
  $('#nextBtn').addEventListener('click',()=>step(1));
  $('#previewFrame').addEventListener('load',()=>$('#frameLoading').classList.add('hidden'));
  document.addEventListener('keydown',e=>{
    const tag=e.target?.tagName?.toLowerCase();if(tag==='input'||tag==='select'||tag==='textarea')return;
    if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}
    if(e.key==='ArrowRight'){e.preventDefault();step(1)}
  });
}
async function boot(){
  if(!(await requireTeacher()))return;
  bind();
  try{
    if(typeof window.loadQuestionBank!=='function')throw Error('Level-test bank loader is unavailable.');
    bank=sortBank(await window.loadQuestionBank());
    setupFilters();
    const wanted=text(new URLSearchParams(location.search).get('question'));
    currentId=bank.some(q=>sourceKey(q)===wanted)?wanted:(bank[0]?sourceKey(bank[0]):'');
    applyFilters();
    if(currentId)selectQuestion(currentId,{push:false});
  }catch(e){
    $('#count').textContent='Could not load';
    $('#questionList').innerHTML='<div class="empty">'+esc(e.message||'Could not load level-test bank.')+'</div>';
    $('#frameLoading').textContent='Bank unavailable';
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
