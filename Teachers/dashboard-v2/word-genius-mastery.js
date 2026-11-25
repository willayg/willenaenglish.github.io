/* Word Genius: teacher-only read view of persisted book/unit mastery and permanent gold awards. */
(()=>{'use strict';
 const OPERATIONS='https://fiieuiktlsivwfgyivai.supabase.co';
 const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
 const OP_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
 const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=v=>String(v??'').trim();
 const arr=v=>Array.isArray(v)?v:[];
 const shortId=id=>text(id).slice(0,8);
 const token=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
 let currentRequest=0;
 async function refresh(){
   const url='/.netlify/functions/supabase_auth?action=refresh&_='+Date.now();
   const response=await (window.WillenaAPI?.fetch?window.WillenaAPI.fetch(url,{credentials:'include',cache:'no-store'}):fetch(url,{credentials:'include',cache:'no-store'}));
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data?.access_token)throw Error('Teacher sign-in expired');
   window.WillenaAPI?.setLocalTokens?.(data.access_token,data.refresh_token||'');
   return data.access_token;
 }
 async function teacherProgress(studentId){
   const url=OPERATIONS+'/rest/v1/rpc/teacher_word_genius_unit_progress_v1';
   let access=token()||await refresh();
   const run=accessToken=>fetch(url,{method:'POST',headers:{apikey:OP_KEY,Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({p_student_id:studentId}),cache:'no-store'});
   let r=await run(access);if(r.status===401){access=await refresh();r=await run(access)}
   const result=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(result.message||result.error||'Could not load Word Genius unit progress');
   return arr(result.units);
 }
 async function content(path){
   const response=await fetch(CONTENT+'/rest/v1/'+path,{headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store'});
   const body=await response.json().catch(()=>[]);
   if(!response.ok)throw Error('Book catalog unavailable ('+response.status+')');
   return arr(body);
 }
 function inClause(ids){return encodeURIComponent('('+ids.join(',')+')')}
 const unique=values=>[...new Set(values.filter(Boolean).map(text))];
 async function catalogFor(rows){
   const bookIds=unique(rows.map(r=>r.book_id)),unitIds=unique(rows.map(r=>r.unit_id));
   if(!bookIds.length||!unitIds.length)return {books:new Map(),units:new Map(),totals:new Map()};
   const [books,units]=await Promise.all([
     content('content_books?select=id,title&id=in.'+inClause(bookIds)+'&limit=1000'),
     content('content_units?select=id,book_id,unit_number,title&id=in.'+inClause(unitIds)+'&limit=1000')
   ]);
   const names=new Map(books.map(b=>[text(b.id),b]));
   const unitMap=new Map(units.map(u=>[text(u.id),u]));
   const totals=new Map();
   const targetRows=await content('unit_vocab_targets?select=unit_id,lexical_entry_id&unit_id=in.'+inClause(unitIds)+'&active=eq.true&limit=10000');
   const ids=unique(targetRows.map(t=>t.lexical_entry_id));
   if(!ids.length)return {books:names,units:unitMap,totals};
   // Keep requests below PostgREST URL and row limits.
   const entries=[];
   for(let i=0;i<ids.length;i+=150){
     entries.push(...await content('lexical_entries?select=id,canonical_text,translation_ko&id=in.'+inClause(ids.slice(i,i+150))+'&status=in.(review,published)&limit=1000'));
   }
   const dictionary=new Map(entries.map(x=>[text(x.id),x]));
   const eligible=new Map();
   for(const t of targetRows){
     const e=dictionary.get(text(t.lexical_entry_id)),word=text(e?.canonical_text),ko=text(e?.translation_ko);
     if(!word||!ko||!/[A-Za-z]/.test(word))continue;
     const unitId=text(t.unit_id);if(!eligible.has(unitId))eligible.set(unitId,new Map());
     eligible.get(unitId).set(text(t.lexical_entry_id),word);
   }
   for(const [unitId,words] of eligible){
     let spelling=0,speaking=0;
     for(const original of words.values()){
       let target=original.replace(/_{2,}\s*['’]?s\b/gi,'').replace(/_{2,}\s*(?:ing|ed|s)?\b/gi,' ').replace(/_{2,}/g,' ').replace(/[~～]+/g,'').replace(/\s+/g,' ').trim();
       if(!target||target.includes('_'))continue;
       spelling++;
       const spoken=target.toLowerCase().replace(/[’‘]/g,"'").replace(/[-–—]/g,' ').replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim();
       if(spoken&&!/^(?:s|'s|[a-z])$/.test(spoken))speaking++;
     }
     totals.set(unitId,{quiz:words.size,spelling,speaking});
   }
   return {books:names,units:unitMap,totals};
 }
 function scoreCell(label,passed,total){
   const n=Math.max(0,Number(passed)||0);
   return '<span class="wg-mastery-skill">'+esc(label)+' <b>'+n+(Number.isInteger(total)?'/'+total:' passed')+'</b></span>';
 }
 function status(row,counts){
   if(row.golden)return {key:'gold',label:'Golden Unit',icon:'★'};
   if(counts&&counts.quiz>0&&counts.spelling>0&&
      Number(row.quiz_passed)>=counts.quiz&&
      Number(row.spelling_passed)>=counts.spelling&&
      (counts.speaking===0||Number(row.speaking_passed)>=counts.speaking)){
     return {key:'complete',label:'All skills passed · gold not recorded',icon:'✓'};
   }
   return {key:'working',label:'In progress',icon:'◌'};
 }
 function unitHtml(row,lookup){
   const meta=lookup.units.get(text(row.unit_id));
   const count=lookup.totals.get(text(row.unit_id));
   const badge=status(row,count);
   const unitNumber=meta?.unit_number;
   const label=unitNumber!=null?'Unit '+unitNumber:(meta?.title||'Unit '+shortId(row.unit_id));
   const title=meta?.title&&unitNumber!=null?'<small>'+esc(meta.title)+'</small>':'';
   const earned=row.golden&&row.earned_at?'<div class="wg-mastery-earned">Earned '+esc(new Date(row.earned_at).toLocaleDateString())+'</div>':'';
   return '<article class="wg-mastery-unit wg-mastery-'+badge.key+'">'+
     '<div class="wg-mastery-unithead"><div class="wg-mastery-title"><strong>'+esc(label)+'</strong>'+title+'</div>'+
     '<span class="wg-mastery-pill"><span aria-hidden="true">'+badge.icon+'</span> '+esc(badge.label)+'</span></div>'+
     '<div class="wg-mastery-skills">'+
     scoreCell('Quiz',row.quiz_passed,count?.quiz)+
     scoreCell('Spelling',row.spelling_passed,count?.spelling)+
     scoreCell('Speaking',row.speaking_passed,count?.speaking)+
     '</div>'+earned+'</article>';
 }
 function renderRows(rows,lookup){
   if(!rows.length)return '<div class="wg-mastery-empty">No recorded Word Genius unit progress yet.</div>';
   const bookGroups=new Map();
   rows.forEach(r=>{const key=text(r.book_id);if(!bookGroups.has(key))bookGroups.set(key,[]);bookGroups.get(key).push(r)});
   let golden=0,complete=0;
   for(const row of rows){const st=status(row,lookup.totals.get(text(row.unit_id)));if(st.key==='gold')golden++;if(st.key==='gold'||st.key==='complete')complete++;}
   const sorted=[...bookGroups.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
   return '<div class="wg-mastery-summary"><span><b>'+bookGroups.size+'</b> books</span><span><b>'+complete+'</b> mastered units</span><span class="wg-mastery-goldcount"><b>★ '+golden+'</b> Golden Units</span></div>'+
     sorted.map(([bookId,list])=>{
       const book=lookup.books.get(bookId);
       const name=book?.title||'Book '+shortId(bookId);
       const gold=list.filter(r=>r.golden).length;
       list.sort((a,b)=>{const na=lookup.units.get(text(a.unit_id))?.unit_number,nb=lookup.units.get(text(b.unit_id))?.unit_number;return Number(na??999)-Number(nb??999)});
       return '<section class="wg-mastery-book"><div class="wg-mastery-bookhead"><strong>'+esc(name)+'</strong><span>'+list.length+' units · ★ '+gold+' gold</span></div>'+
        '<div class="wg-mastery-unitlist">'+list.map(r=>unitHtml(r,lookup)).join('')+'</div></section>';
     }).join('')+
     '<p class="wg-mastery-note">Shows units with saved progress or an awarded Golden Unit. Gold is verified against permanent achievements, not estimated from percentages. Counts use active textbook vocabulary where available.</p>';
 }
 async function show(studentId,element){
   const request=++currentRequest;
   const mount=element||document.getElementById('wordGeniusStudentMastery');
   if(!mount)return;
   mount.innerHTML='<div class="wg-mastery-loading">Loading books and Golden Units…</div>';
   const alive=()=>request===currentRequest&&mount.isConnected&&String(window.rosterDrawerStudent)===String(studentId);
   try{
     const rows=await teacherProgress(studentId);
     if(!alive())return;
     if(!rows.length){mount.innerHTML=renderRows(rows,null);return}
     let lookup;
     try{lookup=await catalogFor(rows)}
     catch(error){
       console.warn('[Word Genius mastery] book metadata unavailable',error);
       lookup={books:new Map(),units:new Map(),totals:new Map()};
     }
     if(!alive())return;
     mount.innerHTML=renderRows(rows,lookup);
   }catch(error){if(alive())mount.innerHTML='<div class="wg-mastery-error">Could not load unit progress: '+esc(error.message)+'</div>'}
 }
 window.addEventListener('teacher:student-insights-ready',event=>{
   if(event.detail?.studentId)void show(String(event.detail.studentId));
 });
 window.TeacherWordGeniusMastery={show};
})();
