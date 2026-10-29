import {renderCard} from './renderer.js';
const el=(id)=>document.getElementById(id), message=el('message');
const order=['Brown','Stanford','Manchester','New York','Hawaii','Boston','Sydney','Berkeley','Chicago','Cambridge','Yale','Princeton','Oxford','MIT'];
const defs=[['phonics','Phonics (P)','phonics'],['listening','Listening (L)','listening'],['vocab','Vocab (V)','vocabulary'],['grammar','Grammar (G)','grammar'],['gw','Grammar/Write (GW)','grammarWriting'],['write','Write (W)','writing'],['reading','Reading (R)','reading'],['speaking','Speaking (S)','speaking']];
let records=[],shown=[],active=null,revision=0,loadedAt=null;

// October 2026 per-class maximum marks, verified against the real Google Sheet TOTAL rows.
// Array follows phonics, listening, vocab, grammar, grammar-writing, writing, reading, speaking.
const OCTOBER_MAXIMA={
 Brown:[20,22,20,null,null,null,null,35],
 Stanford:[20,22,20,null,null,null,null,35],
 Manchester:[22,20,14,8,null,6,null,35],
 'New York':[null,19,16,18,2,7,7,35],
 Hawaii:[null,19,16,18,2,7,7,35],
 Boston:[null,19,19,25,null,12,11,35],
 Sydney:[null,15,26,21,null,23,11,35],
 Berkeley:[null,15,26,21,null,23,11,35],
 Chicago:[null,14,28,16,null,30,11,35],
 Cambridge:[null,14,28,16,null,30,11,35],
 Yale:[null,16,14,16,null,21,11,35],
 Princeton:[null,null,null,null,null,null,null,35],
 Oxford:[null,15,23,17,24,35,13,35],
 MIT:[null,15,22,35,24,35,17,35]
};

const clean=x=>String(x??'').trim(), pick=(s,keys)=>keys.map(k=>s?.[k]).find(v=>v!==undefined&&v!==null&&v!=='')??'';
const numeric=x=>{if(x===null||x===undefined||String(x).trim()==='')return '';const v=Number(String(x).replace(/,/g,''));return Number.isFinite(v)?v:''};
function normalize(s,i){
 const scores=s.scores||s.skillScores||{};
 const data={};
 for(const [key,,field] of defs){const aliases=[field,key,field==='vocabulary'?'vocab':field==='grammarWriting'?'grammar_writing':field==='writing'?'write':field];
  const val=pick(scores,aliases);data[key]=numeric(val===''?pick(s,aliases):val);
 }
 data.lib_reading=clean(pick(s,['bookReading','book_reading','lib_reading']));
 data.lib_raz=clean(pick(s,['razKids','raz_kids','lib_raz']));
 data.lib_punctuality=clean(pick(s,['punctuality','lib_punctuality']));
 return {id:String(pick(s,['sheetRow','rowNumber','id'])||i),name:clean(pick(s,['englishName','name','english_name'])),korean_name:clean(pick(s,['koreanName','korean_name','korean'])),class:clean(pick(s,['class','className','klass'])),next_class:clean(pick(s,['nextClass','next_class'])),data};
}
function fmtDate(){return '2026-10';}
function columnsFor(student){
 const maxima=OCTOBER_MAXIMA[student?.class]||[];
 return defs.map(([key,label],i)=>({key,label,type:'number',max:maxima[i]??null}));
}
function currentTest(student=active){return {name:'October 2026 Report Cards',date:'2026-10-01',term_from:'2026-10',term_to:'2026-10',columns:columnsFor(student)};}
function setStatus(s,error=false){message.textContent=s;message.style.color=error?'#a61f24':'#1e5067'}
function orderedClasses(){return [...new Set(records.map(s=>s.class).filter(Boolean))].sort((a,b)=>{const x=order.indexOf(a),y=order.indexOf(b);return (x===-1?999:x)-(y===-1?999:y)||a.localeCompare(b)})}
function filter(){
 const klass=el('klass').value,q=clean(el('search').value).toLowerCase();
 shown=records.filter(s=>(!klass||s.class===klass)&&(!q||[s.name,s.korean_name].some(v=>v.toLowerCase().includes(q))));
 el('counts').textContent=shown.length+' visible / '+records.length+' total students · '+orderedClasses().length+' classes';
 const box=el('students');box.replaceChildren();
 for(const s of shown){const b=document.createElement('button');b.className='student'+(active===s?' active':'');
 const a=document.createElement('span');a.textContent=s.name+' · '+s.korean_name;
 const cls=document.createElement('small');cls.textContent=s.class;b.append(a,cls);b.onclick=()=>choose(s);box.append(b)}
 if(active&&!shown.includes(active))choose(shown[0]||null,false);else if(!active&&shown.length)choose(shown[0],false);
}
function choose(student,updateList=true){active=student;
 if(updateList)filter();
 el('selection').textContent=student?student.name+' · '+student.class:'No student selected';
 el('print').disabled=!student;el('pdf').disabled=!student;el('classpdf').disabled=!records.length;
 render();
}
function render(){const mount=el('paper');if(!active){mount.replaceChildren();return}
 try{mount.innerHTML=renderCard({student:active,test:currentTest(active),notes:el('comment').value,totalMode:el('totalMode').value});}
 catch(err){setStatus('Rendering failed: '+err.message,true);}
}
async function load(){
 const my=++revision;
 el('load').disabled=true;setStatus('Reading October 2026 from the private Google Sheets connection…');
 try{
  const response=await fetch('/api/report-card-sheet',{credentials:'include',cache:'no-store'});
  const j=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error((j.error||'HTTP '+response.status)+(j.upstreamStatus?' (reader HTTP '+j.upstreamStatus+')':''));
  if(!Array.isArray(j.students))throw new Error('Reader response contains no students array');
  if(my!==revision)return;
  records=j.students.map(normalize).filter(s=>s.name&&s.korean_name&&s.class&&!/ TOTAL$/i.test(s.name));
  loadedAt=new Date();active=null;
  const select=el('klass');select.replaceChildren(new Option('All classes',''));
  for(const klass of orderedClasses())select.add(new Option(klass,klass));
  filter();
  const missing=records.filter(s=>!defs.some(([key])=>s.data[key]!==''&&s.data[key]!=null)).length;
  setStatus('Connected. '+records.length+' students in '+orderedClasses().length+' classes. '+missing+' records have no numeric score entered. Read-only; no database writes.\nPercentage bars use the per-class TOTAL rows verified on October 29, 2026.');
  el('mode').textContent='Live sheet · '+loadedAt.toLocaleTimeString();
 }catch(e){setStatus('Connection failed: '+e.message+'\nThe app is running, but the server-side Sheets connection has not passed. No scores were changed.',true);el('mode').textContent='Connection unavailable'}
 finally{el('load').disabled=false}
}
async function exportPdf(list){
 if(!list.length)return;
 if(!window.jspdf?.jsPDF||!window.html2canvas){setStatus('PDF libraries have not loaded; please try again.',true);return}
 const old=active;el('pdf').disabled=true;el('classpdf').disabled=true;setStatus('Generating '+list.length+' PDF page(s)…');
 try{
 const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 const mount=el('paper');
 for(let i=0;i<list.length;i++){
  if(i)pdf.addPage('a4','portrait');
  mount.innerHTML=renderCard({student:list[i],test:currentTest(list[i]),notes:el('comment').value,totalMode:el('totalMode').value});
  await document.fonts.ready;
  const canvas=await window.html2canvas(mount.querySelector('.rc-page'),{scale:2,backgroundColor:'#fff',useCORS:true});
  const img=canvas.toDataURL('image/jpeg',.95);const height=210*canvas.height/canvas.width;
  pdf.addImage(img,'JPEG',0,Math.max(0,(297-height)/2),210,height);
 }
 const safe=x=>clean(x).replace(/[^\w-]+/g,'_');
 const label=list.length===1?safe(list[0].name):safe(el('klass').value||'AllClasses');
 pdf.save('Willena_Report_Cards_2026-10_'+label+'.pdf');
 setStatus('Exported '+list.length+' report card(s). Score maxima follow October 2026 class TOTAL rows.');
 }catch(e){setStatus('PDF generation failed: '+e.message,true)}
 finally{active=old;render();el('pdf').disabled=!active;el('classpdf').disabled=!records.length}
}
el('load').onclick=load;el('retry').onclick=load;
el('search').oninput=filter;el('klass').onchange=()=>{active=null;filter()};
el('comment').oninput=render;el('totalMode').onchange=render;
el('pdf').onclick=()=>exportPdf(active?[active]:[]);
el('classpdf').onclick=()=>exportPdf(shown.length?shown:[]);
el('print').onclick=()=>window.print();
load();
