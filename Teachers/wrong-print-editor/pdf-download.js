(function(){
'use strict';
const CDN='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function loadHtml2Pdf(){
  if(window.html2pdf)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=CDN;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('PDF library failed to load'));document.head.appendChild(s);
  });
}

function headerHtml(){
  const q=new URLSearchParams(location.search),student=q.get('student')||'Student',exam=q.get('exam')||'';
  return `<div class="pdf-head"><div class="pdf-brand"><img src="/Assets/Images/color-logo.png"><div><h1>오답 다시 풀기</h1><p>Willena English · Test Prep Review</p></div></div><div class="pdf-student"><b>${esc(student)}</b><span>${esc(exam)}</span><span>${esc(new Date().toLocaleDateString('ko-KR'))}</span></div></div>`;
}

function buildAnswerKey(source){
  if(!$('#answerKey')?.checked)return'';
  const sections=[...source.querySelectorAll('.skill-section')];
  const html=sections.map(sec=>{
    const label=sec.querySelector('.skill-heading')?.textContent?.trim()||'Section';
    const answers=[];
    sec.querySelectorAll('.vocab-row').forEach(row=>{const a=row.querySelector('.editor-answer')?.textContent?.trim();if(a)answers.push(a)});
    sec.querySelectorAll('.question-card').forEach(card=>{const a=card.querySelector('.answer.correct')?.textContent?.replace(/^정답\s*/,'').trim();if(a)answers.push(a)});
    if(!answers.length)return'';
    return `<section class="pdf-answer-skill"><h3>${esc(label)}</h3><div class="pdf-answer-grid">${answers.map((a,i)=>`<div><b>${i+1}.</b> ${esc(a)}</div>`).join('')}</div></section>`;
  }).join('');
  return html?`<section class="pdf-answer-key"><h2>정답지</h2>${html}</section>`:'';
}

function normalizeSentenceBreaks(root){
  root.querySelectorAll('.context,.prompt').forEach(el=>{
    const text=el.textContent||'';
    if(!/\s\|\s/.test(text))return;
    el.textContent=text.replace(/\s*\|\s*/g,'\n');
  });
}

function sanitizeClone(source){
  const clone=source.cloneNode(true);
  clone.querySelectorAll('.status,.remove-btn,.answers,.raw-note,.editor-answer').forEach(el=>el.remove());
  if(!$('#showMeta')?.checked)clone.querySelectorAll('.tag').forEach(el=>el.remove());
  clone.querySelectorAll('.print-blank').forEach(el=>el.style.display='block');
  normalizeSentenceBreaks(clone);
  return clone;
}

function pageShell(){
  const page=document.createElement('section');
  page.className='pdf-page';
  page.innerHTML=`${headerHtml()}<div class="pdf-page-body"><div class="pdf-col pdf-col-left"></div><div class="pdf-mid-rule"></div><div class="pdf-col pdf-col-right"></div></div>`;
  return page;
}

function vocabItemFromRow(row,n){
  const item=document.createElement('div');
  item.className='pdf-vocab-item';
  const ko=row.querySelector('.vocab-ko')?.textContent?.trim()||'';
  item.innerHTML=`<b class="pdf-qnum">${n}.</b><span class="pdf-vocab-ko">${esc(ko)}</span><span class="pdf-vocab-blank"></span>`;
  return item;
}

function numberedCard(card,n){
  const c=card.cloneNode(true);
  c.querySelectorAll('.pdf-qnum').forEach(x=>x.remove());
  const num=document.createElement('b');num.className='pdf-qnum';num.textContent=`${n}.`;c.prepend(num);
  return c;
}

function overflowed(col){return col.scrollHeight>col.clientHeight+1}

function paginateSections(sourceClone,pagesHost){
  let page=null,col=null,colIndex=0;
  const newPage=()=>{
    page=pageShell();pagesHost.appendChild(page);col=page.querySelector('.pdf-col-left');colIndex=0;
  };
  const nextCol=()=>{
    if(!page)newPage();
    if(colIndex===0){col=page.querySelector('.pdf-col-right');colIndex=1}else newPage();
  };
  const appendFit=node=>{
    if(!page)newPage();
    col.appendChild(node);
    if(!overflowed(col))return;
    node.remove();nextCol();col.appendChild(node);
  };

  const sections=[...sourceClone.querySelectorAll('.skill-section')];
  sections.forEach(sec=>{
    const label=sec.querySelector('.skill-heading')?.textContent?.trim()||'Section';
    const raw=[];
    sec.querySelectorAll('.vocab-row').forEach((row,i)=>raw.push(vocabItemFromRow(row,i+1)));
    sec.querySelectorAll('.question-card').forEach((card,i)=>raw.push(numberedCard(card,(sec.querySelectorAll('.vocab-row').length)+i+1)));
    if(!raw.length)return;

    /* Heading and first item are one atomic placement unit: never orphan the heading. */
    const start=document.createElement('div');
    start.className='pdf-section-start';
    start.innerHTML=`<div class="pdf-skill-heading">${esc(label)}</div>`;
    start.appendChild(raw.shift());
    appendFit(start);

    raw.forEach(item=>appendFit(item));

    const rule=document.createElement('div');rule.className='pdf-section-rule';
    col.appendChild(rule);
    if(overflowed(col))rule.remove();
  });
}

function makeExportNode(){
  const source=$('#cards');
  if(!source)throw new Error('No printable content');
  const clone=sanitizeClone(source);
  const root=document.createElement('div');root.className='pdf-export-root';
  root.innerHTML=`<style>
    *{box-sizing:border-box}
    .pdf-export-root{width:210mm;background:#fff;color:#242634;font-family:"Noto Sans KR","Malgun Gothic",Arial,sans-serif;margin:0;padding:0}
    .pdf-pages{width:210mm}
    .pdf-page{width:210mm;height:297mm;padding:10mm 12mm 12mm;background:#fff;display:flex;flex-direction:column;overflow:hidden;break-after:page;page-break-after:always}
    .pdf-page:last-child{break-after:auto;page-break-after:auto}
    .pdf-head{flex:0 0 auto;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:2px solid #42b9cc;padding:0 0 4mm;margin:0 0 4mm}
    .pdf-brand{display:flex;align-items:center;gap:10px}.pdf-brand img{width:27mm;height:auto}.pdf-brand h1{font:800 16pt/1.1 Poppins,"Noto Sans KR",sans-serif;margin:0 0 2px}.pdf-brand p{margin:0;color:#666;font-size:8pt}
    .pdf-student{display:flex;flex-direction:column;text-align:right;font-size:8pt;color:#555}.pdf-student b{color:#222;font-size:10pt}
    .pdf-page-body{position:relative;flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:5mm}
    .pdf-mid-rule{position:absolute;left:50%;top:0;bottom:0;border-left:1px solid #d5d9e0;transform:translateX(-.5px);pointer-events:none}
    .pdf-col{height:100%;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:2.5mm}
    .pdf-section-start{break-inside:avoid!important;page-break-inside:avoid!important;display:flex;flex-direction:column;gap:2.5mm}
    .pdf-skill-heading{font:800 13pt/1.1 Poppins,"Noto Sans KR",sans-serif;margin:0;padding:0}
    .pdf-section-rule{height:1px;min-height:1px;background:#4d5260;margin:1mm 0 1.5mm}
    .question-card{position:relative;flex:0 0 auto;box-shadow:none!important;border:1px solid #dfe3ea!important;border-radius:2mm!important;margin:0!important;padding:2.5mm 2.5mm 3mm 7.5mm!important;background:#fff!important;break-inside:avoid!important;page-break-inside:avoid!important}
    .pdf-qnum{position:absolute;left:2.5mm;top:2.6mm;font:800 8.5pt/1 Poppins,"Noto Sans KR",sans-serif;color:#343844}
    .card-top{display:block}.tags{display:flex;gap:1mm;flex-wrap:wrap}.tag{font-size:7pt;padding:1mm 1.5mm;border-radius:10mm;background:#f0f2f6;color:#656b7b}.prompt{font-size:9.5pt;margin:2mm 0 1.5mm;font-weight:700;white-space:pre-wrap}.context{font-size:8.5pt;padding:1.5mm 2mm;margin:1.5mm 0;line-height:1.45;background:#f6f7fa;border-radius:2mm;white-space:pre-wrap}.choices{font-size:8.5pt;margin:1.5mm 0 0;padding-left:5mm}.choices li{padding:.4mm 0}
    .pdf-vocab-item{position:relative;flex:0 0 auto;display:grid;grid-template-columns:minmax(0,1fr) 31mm;gap:2mm;align-items:center;padding:2mm 0 2mm 7.5mm;border-bottom:1px solid #edf0f3;break-inside:avoid!important;page-break-inside:avoid!important}.pdf-vocab-ko{font-size:8.8pt;font-weight:700}.pdf-vocab-blank{display:block;border-bottom:1px solid #5e6470;height:5mm}
    .pdf-answer-key{width:186mm;margin:10mm 12mm 12mm;break-before:page;page-break-before:always}.pdf-answer-key h2{font:800 15pt/1.1 Poppins,"Noto Sans KR",sans-serif;margin:0 0 4mm;border-bottom:2px solid #42b9cc;padding-bottom:2mm}.pdf-answer-skill h3{margin:4mm 0 2mm}.pdf-answer-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm 5mm}.pdf-answer-grid div{padding:1.5mm 0;border-bottom:1px solid #eee;font-size:9pt}
  </style><div class="pdf-pages"></div>${buildAnswerKey(source)}`;
  paginateSections(clone,root.querySelector('.pdf-pages'));
  return root;
}

async function downloadPdf(){
  const btn=$('#downloadPdfBtn');if(!btn)return;
  const old=btn.textContent;btn.disabled=true;btn.textContent='Preparing PDF…';
  let host=null;
  try{
    await loadHtml2Pdf();
    host=document.createElement('div');host.style.position='fixed';host.style.left='-10000px';host.style.top='0';host.style.width='210mm';host.style.background='#fff';host.style.zIndex='-1';document.body.appendChild(host);
    const node=makeExportNode();host.appendChild(node);
    const q=new URLSearchParams(location.search);const student=(q.get('student')||'student').replace(/[^\w가-힣-]+/g,'_');
    await window.html2pdf().set({
      margin:0,
      filename:`${student}_오답_다시풀기.pdf`,
      image:{type:'jpeg',quality:.98},
      html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
      pagebreak:{mode:['css','legacy'],before:['.pdf-answer-key'],avoid:['.pdf-page','.question-card','.pdf-section-start','.pdf-vocab-item']}
    }).from(node).save();
  }catch(e){console.error('[wrong-print-editor] PDF download failed',e);alert(`PDF 만들기 실패: ${e.message||e}`)}finally{host?.remove();btn.disabled=false;btn.textContent=old}
}

document.addEventListener('DOMContentLoaded',()=>{$('#downloadPdfBtn')?.addEventListener('click',downloadPdf)});
})();
