(function(){
'use strict';
if(!/^staging\./i.test(location.hostname))return;
var STORAGE_KEY='willena-study-preview-book';
var CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY};
var preview=null;
try{preview=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');}catch(e){preview=null;}

/* Staging QA shim only: swap the class assignment response in-memory. No DB write. */
if(preview&&preview.book_id){
 var nativeFetch=window.fetch.bind(window);
 window.fetch=async function(input,init){
  var response=await nativeFetch(input,init);
  var url=typeof input==='string'?input:(input&&input.url)||'';
  if(url.indexOf('/rest/v1/rpc/get_study_assignment_for_class')<0||!response.ok)return response;
  try{
   var data=await response.clone().json();
   if(!data||!data.success||!data.assignment)return response;
   data.assignment=Object.assign({},data.assignment,{
    book_id:preview.book_id,
    book_title:preview.book_title,
    current_unit:preview.unit_number?String(preview.unit_number):null,
    starting_unit:null,
    preview_override:true
   });
   var headers=new Headers(response.headers);headers.set('content-type','application/json');
   return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:headers});
  }catch(error){console.warn('[StudyPreview] Could not apply preview override',error);return response;}
 };
}

async function contentGet(path){
 var response=await fetch(CONTENT_URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});
 if(!response.ok)throw new Error('Could not load preview books ('+response.status+').');
 return response.json();
}
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
function option(value,text){var o=document.createElement('option');o.value=value;o.textContent=text;return o;}
function closeModal(modal){modal.classList.remove('is-open');setTimeout(function(){modal.hidden=true;},120);}
async function buildModal(){
 var modal=el('div','study-preview-modal');modal.id='studyPreviewModal';modal.hidden=true;
 var shade=el('button','study-preview-shade');shade.type='button';shade.setAttribute('aria-label','Close preview');
 var card=el('section','study-preview-card');
 var head=el('div','study-preview-head');var titles=el('div');titles.appendChild(el('span','study-preview-eyebrow','STAGING TOOL'));titles.appendChild(el('h2','', 'Preview another book'));
 var close=el('button','study-preview-close','×');close.type='button';head.appendChild(titles);head.appendChild(close);card.appendChild(head);
 card.appendChild(el('p','study-preview-note','Temporary browser-only override. The student’s real class book is not changed.'));
 var form=el('div','study-preview-form');
 var seriesLabel=el('label','study-preview-field');seriesLabel.appendChild(el('span','', 'Series'));var seriesSelect=el('select','');seriesSelect.id='studyPreviewSeries';seriesLabel.appendChild(seriesSelect);
 var bookLabel=el('label','study-preview-field');bookLabel.appendChild(el('span','', 'Book'));var bookSelect=el('select','');bookSelect.id='studyPreviewBook';bookLabel.appendChild(bookSelect);
 var unitLabel=el('label','study-preview-field');unitLabel.appendChild(el('span','', 'Unit'));var unitSelect=el('select','');unitSelect.id='studyPreviewUnit';unitLabel.appendChild(unitSelect);
 form.appendChild(seriesLabel);form.appendChild(bookLabel);form.appendChild(unitLabel);card.appendChild(form);
 var actions=el('div','study-preview-actions');var reset=el('button','study-preview-reset','Reset to assigned book');reset.type='button';var apply=el('button','study-preview-apply','Preview book');apply.type='button';actions.appendChild(reset);actions.appendChild(apply);card.appendChild(actions);
 modal.appendChild(shade);modal.appendChild(card);document.body.appendChild(modal);
 shade.addEventListener('click',function(){closeModal(modal);});close.addEventListener('click',function(){closeModal(modal);});
 reset.addEventListener('click',function(){sessionStorage.removeItem(STORAGE_KEY);location.reload();});
 var series=[],books=[];
 async function loadCatalog(){
  if(series.length)return;
  var all=await Promise.all([
   contentGet('content_series?select=id,name&order=name.asc'),
   contentGet('content_books?select=id,series_id,title,book_number,status&status=in.(review,published)&order=book_number.asc,title.asc')
  ]);series=all[0];books=all[1];
  seriesSelect.innerHTML='';series.forEach(function(s){seriesSelect.appendChild(option(s.id,s.name));});
  if(preview&&preview.series_id)seriesSelect.value=preview.series_id;
  renderBooks();
 }
 function renderBooks(){
  var rows=books.filter(function(b){return b.series_id===seriesSelect.value;});bookSelect.innerHTML='';rows.forEach(function(b){bookSelect.appendChild(option(b.id,b.title));});
  if(preview&&preview.book_id&&rows.some(function(b){return b.id===preview.book_id;}))bookSelect.value=preview.book_id;
  loadUnits();
 }
 async function loadUnits(){
  var bookId=bookSelect.value;unitSelect.innerHTML='';unitSelect.appendChild(option('','Loading…'));
  if(!bookId)return;
  try{
   var units=await contentGet('content_units?select=id,unit_number,title&book_id=eq.'+encodeURIComponent(bookId)+'&status=in.(review,published)&order=unit_number.asc');
   unitSelect.innerHTML='';units.forEach(function(u){unitSelect.appendChild(option(String(u.unit_number),'Unit '+u.unit_number+' · '+(u.title||'')));});
   if(preview&&preview.book_id===bookId&&preview.unit_number)unitSelect.value=String(preview.unit_number);
  }catch(error){unitSelect.innerHTML='';unitSelect.appendChild(option('','Could not load units'));}
 }
 seriesSelect.addEventListener('change',renderBooks);bookSelect.addEventListener('change',loadUnits);
 apply.addEventListener('click',function(){
  var book=books.find(function(b){return b.id===bookSelect.value;});if(!book)return;
  sessionStorage.setItem(STORAGE_KEY,JSON.stringify({series_id:seriesSelect.value,book_id:book.id,book_title:book.title,unit_number:unitSelect.value||null}));location.reload();
 });
 return{modal:modal,load:loadCatalog};
}

var modalApi=null;
async function openPreview(){
 try{
  if(!modalApi)modalApi=await buildModal();
  modalApi.modal.hidden=false;requestAnimationFrame(function(){modalApi.modal.classList.add('is-open');});
  await modalApi.load();
 }catch(error){console.error('[StudyPreview]',error);alert(error.message||'Could not open preview tool.');}
}
function mount(){
 var controls=document.querySelector('.study-controls');if(!controls)return;
 var button=el('button','ghost-button study-preview-trigger',preview?'Preview: '+preview.book_title:'Preview book');button.type='button';button.addEventListener('click',openPreview);controls.insertBefore(button,controls.firstChild);
 if(preview){document.documentElement.classList.add('study-preview-active');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
