(function(global){
'use strict';
if(location.hostname!=='staging.willenaenglish.com')return;
var CACHE_PREFIX='willena-study-v2-home:v1:';
var RUNNABLE=['vocabulary','spelling','grammar','sentence_building','conversation','listening','reading'];
var KO={vocabulary:'어휘',spelling:'철자',grammar:'문법',sentence_building:'문장 만들기',conversation:'회화',listening:'듣기',reading:'읽기'};
var open=false,tab='student',timer=0;
function t(v){return String(v==null?'':v).trim();}
function a(v){return Array.isArray(v)?v:[];}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function uid(){try{return t(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId'));}catch(_){return'';}}
function cache(){try{var id=uid(),o=id&&JSON.parse(localStorage.getItem(CACHE_PREFIX+id)||'null');return o&&Array.isArray(o.books)?o:null;}catch(_){return null;}}
function title(b){return t(b&&b.book_title||b&&b.title||'Book');}
function un(u){return Number(u&&u.unit_number)||0;}
function days(ms){return ms?Math.max(0,Math.floor((Date.now()-ms)/86400000)):999;}
function assignmentUnit(book){var units=a(book&&book.units),hint=t(book&&book.current_unit||book&&book.starting_unit),num=(hint.match(/\d+/)||[])[0];return units.find(function(u){return String(u.id)===hint||(num&&String(u.unit_number)===String(num));})||book.currentUnit||units[0]||null;}
function currentUnit(book,snap){var s=snap&&snap.dailyStates&&snap.dailyStates[String(book.book_id)],units=a(book.units);return s&&s.current_unit_id?units.find(function(u){return String(u.id)===String(s.current_unit_id);})||assignmentUnit(book):assignmentUnit(book);}
function rowsFor(snap,bid,unitId){var stats=snap&&snap.stats||{};return Object.keys(stats).map(function(k){return stats[k];}).filter(function(r){return String(r.bookId)===String(bid)&&String(r.unitId)===String(unitId);});}
function avg(rows){if(!rows.length)return 0;var w=0,total=0;rows.forEach(function(s){var ww=Math.max(1,s.attempts||s.unique||1);total+=s.mastery*ww;w+=ww;});return w?Math.round(total/w):0;}
function selectedKey(c){return [c.bookId,c.unitId,c.skill,c.type].join('|');}
function reconstruct(){
  var coach=global.WillenaStudyV2Coach,snap=coach&&coach.getSnapshot&&coach.getSnapshot(),chosen=coach&&coach.getCandidates?coach.getCandidates():[],c=cache(),books=c?a(c.books):[],out=[],bookSeen=(snap&&snap.bookSeen)||{};
  books.forEach(function(book){
    var bid=String(book.book_id),cur=currentUnit(book,snap),curId=cur&&String(cur.id),state=snap&&snap.dailyStates&&snap.dailyStates[bid]||{},available=a(book.availableSkills).length?a(book.availableSkills):RUNNABLE;
    a(book.units).forEach(function(unit){
      var rows=rowsFor(snap,bid,unit.id),isCurrent=curId===String(unit.id),attention=!!(isCurrent&&state.attention_needed);
      rows.forEach(function(s){
        if(RUNNABLE.indexOf(s.skill)<0)return;
        var gap=Math.max(0,80-s.mastery),currentBonus=isCurrent?8:0,attentionBonus=attention?8:0,ageBonus=Math.min(8,Math.max(0,days(s.lastSeen)-3)),parts=[];
        if((s.lapses>0||s.mastery<75)&&s.attempts+s.unique>0){
          var lapseBonus=Math.min(24,s.lapses*4),gapBonus=Math.min(18,gap*.45),dueBonus=Math.min(12,s.due*4),age=Math.min(5,ageBonus),low=s.mastery<60?8:0,score=72+lapseBonus+gapBonus+dueBonus+currentBonus+attentionBonus+age+low;
          parts=[['weak base',72],['lapses',lapseBonus],['mastery gap',gapBonus],['due',dueBonus],['current unit',currentBonus],['attention',attentionBonus],['time since seen',age],['mastery <60',low]];
          out.push(make('weak',score,book,unit,s,isCurrent,parts));return;
        }
        if(s.due>0){
          var db=Math.min(24,s.due*6),ab=Math.min(6,ageBonus),ds=62+db+currentBonus+ab;
          parts=[['review base',62],['due items',db],['current unit',currentBonus],['time since seen',ab]];
          out.push(make('due',ds,book,unit,s,isCurrent,parts));return;
        }
        if(s.mastery>=75&&s.mastery<85&&s.attempts>=4){
          var nb=(85-s.mastery)*.8,ns=50+nb+currentBonus;
          parts=[['near-secure base',50],['distance from 85%',nb],['current unit',currentBonus]];
          out.push(make('near',ns,book,unit,s,isCurrent,parts));return;
        }
        if(isCurrent&&s.attempts>0&&(s.attempts<4||s.unique<2)){
          var cb=(4-Math.min(4,s.attempts))*3,cs=45+cb+currentBonus;
          parts=[['coverage base',45],['low attempts',cb],['current unit',currentBonus]];
          out.push(make('coverage',cs,book,unit,s,true,parts));
        }
      });
    });
    if(cur){
      var cr=rowsFor(snap,bid,cur.id),av=avg(cr),major=cr.some(function(s){return s.mastery<65&&s.attempts+s.unique>0;}),units=a(book.units).slice().sort(function(x,y){return un(x)-un(y);}),idx=units.findIndex(function(u){return String(u.id)===String(cur.id);}),next=idx>=0&&idx<units.length-1?units[idx+1]:null;
      if(next&&av>=82&&!major){var ps=36+(av>=90?5:0),skill=available.indexOf('vocabulary')>=0?'vocabulary':available[0]||'vocabulary';out.push({type:'preview',score:ps,bookId:bid,bookTitle:title(book),unitId:String(next.id),unitNumber:un(next),skill:skill,mastery:av,attempts:0,unique:0,lapses:0,due:0,lastSeen:0,current:false,parts:[['preview base',36],['mastery ≥90',av>=90?5:0]]});}
      if(!cr.length){var fs=available[0]||'vocabulary';out.push({type:'fresh',score:40,bookId:bid,bookTitle:title(book),unitId:String(cur.id),unitNumber:un(cur),skill:fs,mastery:0,attempts:0,unique:0,lapses:0,due:0,lastSeen:0,current:true,parts:[['fresh/current unit',40]]});}
    }
  });
  var newest=0;Object.keys(bookSeen).forEach(function(k){newest=Math.max(newest,bookSeen[k]||0);});
  if(books.length>1&&newest)out.forEach(function(c){var seen=bookSeen[c.bookId]||0,lag=(newest-seen)/86400000;if(lag>=2){var bonus=Math.min(8,Math.floor(lag));c.score+=bonus;c.parts.push(['book balance',bonus]);}});
  out.sort(function(x,y){return y.score-x.score||(y.current?1:0)-(x.current?1:0);});
  var picked={};chosen.forEach(function(c,i){picked[selectedKey(c)]=i+1;});out.forEach(function(c,i){c.rank=i+1;c.selected=picked[selectedKey(c)]||0;});
  return{snapshot:snap,books:books,candidates:out,chosen:chosen};
}
function make(type,score,book,unit,s,current,parts){return{type:type,score:score,bookId:String(book.book_id),bookTitle:title(book),unitId:String(unit.id),unitNumber:un(unit),skill:s.skill,mastery:s.mastery,accuracy:s.accuracy,attempts:s.attempts,unique:s.unique,lapses:s.lapses,due:s.due,lastSeen:s.lastSeen,current:current,parts:parts};}
function style(){if(document.getElementById('coachDebugStyle'))return;var s=document.createElement('style');s.id='coachDebugStyle';s.textContent='\
#coachDebugFab{position:fixed;right:16px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:24000;border:0;border-radius:999px;padding:12px 16px;background:#17313a;color:#fff;font:800 12px/1 Poppins,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2)}\
#coachDebugShade{position:fixed;inset:0;z-index:23990;background:rgba(12,28,33,.42);backdrop-filter:blur(3px)}\
#coachDebugPanel{position:fixed;z-index:24010;right:10px;top:10px;bottom:10px;width:min(760px,calc(100vw - 20px));overflow:auto;background:#f6f9fa;border:1px solid #dbe5e7;border-radius:24px;box-shadow:0 24px 60px rgba(0,0,0,.24);font-family:Poppins,sans-serif;color:#17313a}\
.coach-debug-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:10px;padding:16px;background:#fff;border-bottom:1px solid #dde6e8;border-radius:24px 24px 0 0}.coach-debug-head strong{font-size:17px}.coach-debug-head small{display:block;color:#73858a;font-size:11px}.coach-debug-spacer{flex:1}.coach-debug-head button,.coach-debug-tabs button{min-height:42px;border:1px solid #cbdadd;border-radius:12px;background:#fff;color:#28474e;font-weight:800;padding:9px 12px}.coach-debug-tabs{display:flex;gap:8px;padding:12px 16px;background:#fff;border-bottom:1px solid #dde6e8}.coach-debug-tabs button.is-active{border-color:#25b8c4;background:#eafafb;color:#176f78}.coach-debug-body{padding:16px}.coach-debug-card{background:#fff;border:1px solid #dce6e8;border-radius:17px;padding:14px;margin-bottom:12px}.coach-debug-card h3{margin:0 0 10px;font-size:14px}.coach-debug-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.coach-debug-stat{padding:10px;border-radius:12px;background:#f2f7f8}.coach-debug-stat small{display:block;color:#7b8b90;font-size:10px}.coach-debug-stat strong{font-size:15px}.coach-debug-book{border-top:1px solid #edf1f2;padding-top:12px;margin-top:12px}.coach-debug-book:first-of-type{border-top:0;padding-top:0}.coach-debug-row{display:grid;grid-template-columns:34px minmax(0,1.6fr) .8fr .65fr .65fr .65fr;gap:8px;align-items:center;padding:11px 8px;border-top:1px solid #edf1f2;font-size:12px}.coach-debug-row.is-selected{background:#eafafb;border-radius:12px;border-top-color:transparent;margin:3px 0}.coach-debug-rank{font-weight:900}.coach-debug-score{font-size:16px;font-weight:900;color:#176f78}.coach-debug-pill{display:inline-flex;padding:4px 7px;border-radius:999px;background:#edf3f4;font-size:10px;font-weight:800}.coach-debug-reason{grid-column:2/-1;color:#687b80;font-size:10px;line-height:1.45}.coach-debug-empty{padding:28px;text-align:center;color:#74878c}.coach-debug-raw{white-space:pre-wrap;word-break:break-word;font:11px/1.45 monospace;background:#14292f;color:#dff6f8;border-radius:14px;padding:13px;max-height:360px;overflow:auto}\
@media(max-width:650px){#coachDebugPanel{inset:6px;width:auto}.coach-debug-grid{grid-template-columns:1fr 1fr}.coach-debug-row{grid-template-columns:30px 1fr .7fr}.coach-debug-row>*:nth-child(4),.coach-debug-row>*:nth-child(5),.coach-debug-row>*:nth-child(6){display:none}.coach-debug-reason{grid-column:2/-1}}';document.head.appendChild(s);}
function mount(){style();var fab=document.createElement('button');fab.id='coachDebugFab';fab.type='button';fab.textContent='COACH DEBUG';fab.addEventListener('click',function(){open=true;render();});document.body.appendChild(fab);}
function shell(){var old=document.getElementById('coachDebugPanel');if(old)old.remove();var sh=document.getElementById('coachDebugShade');if(sh)sh.remove();var shade=document.createElement('div');shade.id='coachDebugShade';shade.addEventListener('click',closePanel);document.body.appendChild(shade);var p=document.createElement('section');p.id='coachDebugPanel';p.innerHTML='<div class="coach-debug-head"><div><strong>AI Coach · Under the Hood</strong><small>STAGING · read-only diagnostics</small></div><span class="coach-debug-spacer"></span><button id="coachDebugRefresh" type="button">Refresh</button><button id="coachDebugClose" type="button">×</button></div><div class="coach-debug-tabs"><button data-tab="student">Student snapshot</button><button data-tab="candidates">Candidate ranking</button><button data-tab="raw">Raw</button></div><div class="coach-debug-body" id="coachDebugBody"></div>';document.body.appendChild(p);p.querySelector('#coachDebugClose').onclick=closePanel;p.querySelector('#coachDebugRefresh').onclick=function(){var c=global.WillenaStudyV2Coach;if(c&&c.refresh)c.refresh();setTimeout(renderBody,450);};p.querySelectorAll('[data-tab]').forEach(function(b){b.onclick=function(){tab=b.dataset.tab;renderBody();};});}
function closePanel(){open=false;var p=document.getElementById('coachDebugPanel'),s=document.getElementById('coachDebugShade');if(p)p.remove();if(s)s.remove();}
function render(){if(!open)return;shell();renderBody();}
function renderBody(){if(!open)return;var d=reconstruct(),body=document.getElementById('coachDebugBody');if(!body)return;document.querySelectorAll('#coachDebugPanel [data-tab]').forEach(function(b){b.classList.toggle('is-active',b.dataset.tab===tab);});if(tab==='student')body.innerHTML=studentHtml(d);else if(tab==='candidates')body.innerHTML=candidatesHtml(d);else body.innerHTML='<pre class="coach-debug-raw">'+esc(JSON.stringify({snapshot:d.snapshot,chosen:d.chosen,candidates:d.candidates},null,2))+'</pre>';}
function studentHtml(d){if(!d.snapshot)return'<div class="coach-debug-empty">Coach snapshot not ready yet. Tap Refresh.</div>';var stats=Object.keys(d.snapshot.stats||{}).map(function(k){return d.snapshot.stats[k];}),attempts=stats.reduce(function(n,s){return n+(s.attempts||0);},0),lapses=stats.reduce(function(n,s){return n+(s.lapses||0);},0),due=stats.reduce(function(n,s){return n+(s.due||0);},0),h='<div class="coach-debug-card"><h3>Current student</h3><div class="coach-debug-grid"><div class="coach-debug-stat"><small>User ID</small><strong>'+esc(uid()||'—')+'</strong></div><div class="coach-debug-stat"><small>Assigned books</small><strong>'+d.books.length+'</strong></div><div class="coach-debug-stat"><small>Total attempts</small><strong>'+attempts+'</strong></div><div class="coach-debug-stat"><small>Due / lapses</small><strong>'+due+' / '+lapses+'</strong></div></div></div>';
  d.books.forEach(function(book){var cur=currentUnit(book,d.snapshot),rows=cur?rowsFor(d.snapshot,book.book_id,cur.id):[],state=d.snapshot.dailyStates&&d.snapshot.dailyStates[String(book.book_id)]||{};h+='<div class="coach-debug-card"><h3>'+esc(title(book))+'</h3><div class="coach-debug-grid"><div class="coach-debug-stat"><small>Coach current unit</small><strong>'+(cur?'Unit '+un(cur):'—')+'</strong></div><div class="coach-debug-stat"><small>Available skills</small><strong>'+a(book.availableSkills).length+'</strong></div><div class="coach-debug-stat"><small>Attention needed</small><strong>'+(state.attention_needed?'YES':'no')+'</strong></div><div class="coach-debug-stat"><small>Last activity</small><strong>'+fmtAge(d.snapshot.bookSeen&&d.snapshot.bookSeen[String(book.book_id)])+'</strong></div></div><div class="coach-debug-book">'+(rows.length?rows.map(skillHtml).join(''):'<div class="coach-debug-empty">No mastery rows for this unit yet.</div>')+'</div></div>';});return h;}
function skillHtml(s){return'<div class="coach-debug-row"><span></span><strong>'+esc(KO[s.skill]||s.skill)+'</strong><span>'+s.mastery+'%</span><span>'+((s.accuracy==null)?'—':s.accuracy+'%')+'</span><span>'+s.attempts+' tries</span><span>'+s.lapses+' lapses</span><div class="coach-debug-reason">unique '+s.unique+' · due '+s.due+' · last seen '+fmtAge(s.lastSeen)+'</div></div>';}
function candidatesHtml(d){if(!d.candidates.length)return'<div class="coach-debug-empty">No candidates yet. Tap Refresh after the Coach has loaded.</div>';var h='<div class="coach-debug-card"><h3>Ranked candidates</h3><div class="coach-debug-grid"><div class="coach-debug-stat"><small>Considered</small><strong>'+d.candidates.length+'</strong></div><div class="coach-debug-stat"><small>Live Coach chose</small><strong>'+d.chosen.length+'</strong></div><div class="coach-debug-stat"><small>Top score</small><strong>'+d.candidates[0].score.toFixed(1)+'</strong></div><div class="coach-debug-stat"><small>Winner</small><strong>'+esc(KO[d.candidates[0].skill]||d.candidates[0].skill)+'</strong></div></div></div><div class="coach-debug-card">';d.candidates.forEach(function(c){h+=candidateHtml(c);});return h+'</div>';}
function candidateHtml(c){var reason=c.parts.filter(function(p){return Math.abs(Number(p[1])||0)>.001;}).map(function(p){return p[0]+' +'+Number(p[1]).toFixed(Number(p[1])%1?1:0);}).join(' · ');return'<div class="coach-debug-row'+(c.selected?' is-selected':'')+'"><span class="coach-debug-rank">#'+c.rank+'</span><div><strong>'+esc(c.bookTitle)+' · Unit '+c.unitNumber+' · '+esc(KO[c.skill]||c.skill)+'</strong><br><span class="coach-debug-pill">'+esc(c.type)+'</span>'+(c.selected?' <span class="coach-debug-pill">SELECTED '+c.selected+'</span>':'')+'</div><span class="coach-debug-score">'+c.score.toFixed(1)+'</span><span>'+c.mastery+'%</span><span>'+c.attempts+' tries</span><span>'+c.lapses+' lapses</span><div class="coach-debug-reason">'+esc(reason||'base score only')+' · due '+c.due+' · '+(c.current?'current unit':'other unit')+'</div></div>';}
function fmtAge(ms){if(!ms)return'never';var d=days(ms);return d===0?'today':d===1?'1 day':' '+d+' days';}
function wait(){clearInterval(timer);var tries=0;timer=setInterval(function(){tries++;if(global.WillenaStudyV2Coach){clearInterval(timer);mount();}else if(tries>100)clearInterval(timer);},50);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wait,{once:true});else wait();
})(window);
