(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function addStyles(){
  if($('#naScopeSelectorFixStyles')) return;
  const s=document.createElement('style');
  s.id='naScopeSelectorFixStyles';
  s.textContent=`
    #naFreshEditBg .na-field:has(#naBook){
      border:1.5px solid #dfe4e8;
      border-radius:14px;
      padding:13px;
      background:#fff;
      margin-bottom:14px;
    }
    #naFreshEditBg .na-field:has(#naBook)>label,
    #naFreshEditBg .na-field:has(#naScope)>label{
      font-size:.78rem!important;
      color:#343343!important;
      margin-bottom:8px!important;
    }
    #naFreshEditBg #naBook{
      border:2px solid #cfd7dc!important;
      min-height:46px;
      font-weight:600;
    }
    #naFreshEditBg .na-field:has(#naScope){
      border-top:2px solid #e4e8eb;
      padding-top:14px;
      margin-top:4px;
    }
    #naFreshEditBg #naScope{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:11px;
    }
    #naFreshEditBg .na-scope{
      margin:0!important;
      border:2px solid #d9e0e4!important;
      border-radius:15px!important;
      background:#fff!important;
      overflow:hidden;
      transition:border-color .14s ease,background .14s ease,box-shadow .14s ease,transform .14s ease;
    }
    #naFreshEditBg .na-scope:hover{
      border-color:#a9dce3!important;
    }
    #naFreshEditBg .na-scope.has-selected{
      border-color:#58c3d2!important;
      background:#f0fbfc!important;
      box-shadow:0 0 0 2px rgba(88,195,210,.15);
    }
    #naFreshEditBg .na-scope-head{
      padding:13px 14px!important;
      min-height:49px;
      background:#f8fafb!important;
      font-size:.84rem!important;
      cursor:pointer;
      border-bottom:1px solid #edf0f2;
    }
    #naFreshEditBg .na-scope.has-selected .na-scope-head{
      background:#dff6f8!important;
      color:#176f78!important;
      border-bottom-color:#c7edf1;
    }
    #naFreshEditBg .na-scope-head span{
      font-weight:800;
      font-size:.88rem;
    }
    #naFreshEditBg .na-scope-head small{
      font-size:.62rem;
      color:#8a929b;
      font-weight:700;
    }
    #naFreshEditBg .na-scope.has-selected .na-scope-head small{
      color:#287b85;
    }
    #naFreshEditBg .na-scope-body{
      padding:11px 12px 12px!important;
      gap:6px!important;
      background:transparent!important;
    }
    #naFreshEditBg .na-scope-chip{
      border:1.5px solid #dce2e6!important;
      background:#fff!important;
      color:#68717c!important;
      border-radius:9px!important;
      padding:7px 9px!important;
      font-size:.64rem!important;
      font-weight:700!important;
      transition:.12s ease;
    }
    #naFreshEditBg .na-scope-chip.on{
      border-color:#58c3d2!important;
      background:#58c3d2!important;
      color:#fff!important;
      box-shadow:0 2px 6px rgba(52,164,178,.18);
    }
    #naFreshEditBg .na-scope-chip.on:before{
      content:'✓ ';
      font-weight:900;
    }
    @media(max-width:700px){
      #naFreshEditBg #naScope{grid-template-columns:1fr;gap:9px}
      #naFreshEditBg .na-scope-head{min-height:46px;padding:12px 13px!important}
    }
  `;
  document.head.appendChild(s);
}

function updateUnitStates(){
  $$('#naScope .na-scope').forEach(row=>{
    const selected=$$('.na-scope-chip.on',row);
    row.classList.toggle('has-selected',selected.length>0);
    const small=$('.na-scope-head small',row);
    if(small){
      const total=$$('.na-scope-chip',row).length;
      small.textContent=selected.length ? `${selected.length}/${total} 선택됨` : (total ? '단원 선택' : '문제 없음');
    }
  });
}

let modalWasOpen=false;
function onModalState(){
  const bg=$('#naFreshEditBg');
  if(!bg) return;
  const open=bg.classList.contains('open');
  if(open&&!modalWasOpen){
    modalWasOpen=true;
    requestAnimationFrame(()=>{
      // New tests should start with no lesson silently preselected.
      if(($('#naEditTitle')?.textContent||'').includes('새 시험')){
        $$('#naScope .na-scope-chip.on').forEach(c=>c.classList.remove('on'));
      }
      updateUnitStates();
    });
  }else if(!open&&modalWasOpen){
    modalWasOpen=false;
  }
}

function wire(){
  addStyles();
  const scope=$('#naScope');
  if(scope&&!scope.dataset.unitSelectorWired){
    scope.dataset.unitSelectorWired='1';
    scope.addEventListener('click',()=>setTimeout(updateUnitStates,0));
  }
  const book=$('#naBook');
  if(book&&!book.dataset.unitSelectorWired){
    book.dataset.unitSelectorWired='1';
    book.addEventListener('change',()=>setTimeout(()=>{
      if(($('#naEditTitle')?.textContent||'').includes('새 시험')){
        $$('#naScope .na-scope-chip.on').forEach(c=>c.classList.remove('on'));
      }
      updateUnitStates();
    },0));
  }
  updateUnitStates();
  onModalState();
}

let raf=0;
function scan(){
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(wire);
}

function boot(){
  wire();
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
