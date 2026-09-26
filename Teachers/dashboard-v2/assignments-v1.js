(function(){
  'use strict';

  const state={
    assignments:[],
    filter:'current',
    className:'',
    loaded:false,
    selectedAssignment:null,
    progress:null,
    studentDetail:null
  };

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  function fmtDate(v){
    if(!v)return'—';
    const d=new Date(v);
    if(Number.isNaN(d.getTime()))return'—';
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:d.getFullYear()!==new Date().getFullYear()?'numeric':undefined});
  }

  function dateInputValue(v){
    if(!v)return'';
    const d=new Date(v);
    if(Number.isNaN(d.getTime()))return'';
    const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,10);
  }

  function dueAtFromDate(v){
    if(!v)return null;
    const d=new Date(String(v)+'T23:59:59');
    return Number.isNaN(d.getTime())?null:d.toISOString();
  }

  function route(action,params={}){
    const q=new URLSearchParams({action,...params});
    return '/.netlify/functions/homework_api?'+q.toString();
  }

  async function api(path,options={}){
    const resolved=window.WillenaAPI&&typeof window.WillenaAPI.getApiUrl==='function'
      ?window.WillenaAPI.getApiUrl(path)
      :path;
    const r=await fetch(resolved,Object.assign({credentials:'include',cache:'no-store'},options));
    let data={};
    try{data=await r.json()}catch(_){}
    if(!r.ok||data?.success===false)throw new Error(data?.error||('Request failed ('+r.status+')'));
    return data;
  }

  async function loadClassStudents(className){
    if(!className)return[];
    const q=new URLSearchParams({section:'teacher_class_insights',class:className,days:'30'});
    const data=await api('/.netlify/functions/progress_summary?'+q.toString());
    return Array.isArray(data.students)?data.students:[];
  }

  function isCurrent(a){
    return a&&a.active!==false&&String(a.status||'active').toLowerCase()!=='ended'&&!a.ended_at;
  }

  function visibleAssignments(){
    return state.assignments.filter(a=>{
      if(state.className&&String(a.class||'')!==state.className)return false;
      return state.filter==='current'?isCurrent(a):!isCurrent(a);
    });
  }

  function classNames(){
    return [...new Set(state.assignments.map(a=>String(a.class||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  }

  function populateClassFilter(){
    const select=$('#assignmentClassFilter');
    if(!select)return;
    const current=state.className;
    select.innerHTML='<option value="">All classes</option>'+classNames().map(name=>
      '<option value="'+esc(name)+'">'+esc(name)+'</option>'
    ).join('');
    select.value=current;
  }

  function assignmentCard(a){
    const required=Array.isArray(a?.list_meta?.required_modes)?a.list_meta.required_modes:[];
    const labels={quiz:'Quiz',spelling_test:'Spelling',speaking:'Speaking'};
    const targetStudents=Array.isArray(a?.list_meta?.target_students)?a.list_meta.target_students:[];
    const scope=targetStudents.length
      ? targetStudents.map(s=>s?.name||s?.korean_name||'Student').filter(Boolean).join(', ')
      : (a.class||'No class');
    return '<button type="button" class="assignment-card" data-assignment-id="'+esc(a.id)+'">'+
      '<div class="assignment-card-head">'+
        '<div><strong>'+esc(a.title||'Vocabulary Study')+'</strong><span>'+esc(scope)+' · '+esc(required.map(x=>labels[x]||x).join(' · ')||'Vocabulary Study')+(assignmentWorkloadMode(a)==='split'?' · Split workload':'')+'</span></div>'+
        '<span class="assignment-state '+(isCurrent(a)?'is-current':'is-history')+'">'+(isCurrent(a)?'Current':(a.ended_at?'Cancelled':'History'))+'</span>'+
      '</div>'+
      '<div class="assignment-card-meta"><span>Due <b>'+esc(fmtDate(a.due_at))+'</b></span><span>Created <b>'+esc(fmtDate(a.created_at))+'</b></span></div>'+
    '</button>';
  }

  function renderList(){
    const list=$('#assignmentList');
    const detail=$('#assignmentDetail');
    if(!list)return;
    const rows=visibleAssignments();
    if(detail){
      detail.hidden=true;
      detail.innerHTML='';
    }
    state.selectedAssignment=null;
    state.progress=null;
    state.studentDetail=null;
    if(!rows.length){
      list.innerHTML='<div class="empty">No '+(state.filter==='current'?'current':'past')+' Vocabulary Study assignments'+(state.className?' for '+esc(state.className):'')+'.</div>';
      return;
    }
    list.innerHTML=rows.map(assignmentCard).join('');
    $$('.assignment-card',list).forEach(card=>card.addEventListener('click',()=>openAssignment(card.dataset.assignmentId)));
  }

  async function loadAssignments(force=false){
    if(state.loaded&&!force){renderList();return}
    const list=$('#assignmentList');
    if(list)list.innerHTML='<div class="empty">Loading assignments…</div>';
    try{
      const data=await api(route('list_assignments'));
      state.assignments=(Array.isArray(data.assignments)?data.assignments:[])
        .filter(a=>String(a?.source_type||'').toLowerCase()==='vocab_study');
      state.loaded=true;
      populateClassFilter();
      renderList();
    }catch(error){
      if(list)list.innerHTML='<div class="empty">Could not load assignments: '+esc(error.message)+'</div>';
    }
  }

  function assignmentMeta(assignment){
    return assignment?.list_meta&&typeof assignment.list_meta==='object'?assignment.list_meta:{};
  }

  function assignmentWorkloadMode(assignment){
    return String(assignmentMeta(assignment).workload_mode||'all').toLowerCase()==='split'?'split':'all';
  }

  function assignmentModeTargetIds(assignment,mode){
    if(assignmentWorkloadMode(assignment)!=='split')return null;
    const ids=assignmentMeta(assignment)?.mode_target_ids?.[mode];
    return Array.isArray(ids)?ids.map(String).filter(Boolean):[];
  }

  function assignmentModeTargetCount(assignment,mode,fallback=0){
    const ids=assignmentModeTargetIds(assignment,mode);
    return ids===null?Math.max(0,Number(fallback)||0):ids.length;
  }

  function adjustedStudentMode(assignment,student,mode){
    const raw=student?.modes?.[mode]||{};
    const total=assignmentModeTargetCount(assignment,mode,raw.total);
    const clean=Math.min(total,Math.max(0,Number(raw.clean)||0));
    const percent=total>0?Math.round(100*clean/total):0;
    return{...raw,total,clean,percent};
  }

  function adjustedStudentSummary(assignment,student,modes){
    const states=(modes||[]).map(mode=>adjustedStudentMode(assignment,student,mode));
    const overall=states.length?Math.round(states.reduce((sum,m)=>sum+(Number(m.percent)||0),0)/states.length):0;
    const complete=states.length>0&&states.every(m=>m.total>0&&m.clean>=m.total);
    const started=states.some(m=>Number(m.clean)>0||Number(m.attempts)>0);
    return{modes:states,overall,status:complete?'complete':started?'in_progress':'not_started'};
  }

  function shuffleCopy(items){
    const out=items.slice();
    for(let i=out.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [out[i],out[j]]=[out[j],out[i]];
    }
    return out;
  }

  function balancedModeSplit(targetIds,modes){
    const active=(modes||[]).filter(Boolean);
    const ids=shuffleCopy([...new Set((targetIds||[]).map(String).filter(Boolean))]);
    const out={};
    active.forEach(mode=>{out[mode]=[]});
    if(!active.length)return out;
    ids.forEach((id,index)=>out[active[index%active.length]].push(id));
    return out;
  }

  function avgMode(students,mode){
    const values=students.map(s=>Number(s?.modes?.[mode]?.percent)).filter(Number.isFinite);
    return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;
  }

  function statusLabel(status){
    if(status==='complete')return'Complete';
    if(status==='in_progress')return'In progress';
    return'Not started';
  }

  function pctClass(value){
    const n=Number(value)||0;
    if(n>=100)return'is-complete';
    if(n>0)return'is-progress';
    return'is-zero';
  }

  function renderProgress(progress){
    const detail=$('#assignmentDetail');
    if(!detail)return;
    const a=progress.assignment||{};
    const allStudents=Array.isArray(progress.students)?progress.students:[];
    const targetIds=new Set((Array.isArray(a?.list_meta?.target_student_ids)?a.list_meta.target_student_ids:
      (Array.isArray(state.selectedAssignment?.list_meta?.target_student_ids)?state.selectedAssignment.list_meta.target_student_ids:[]))
      .map(String));
    const students=targetIds.size?allStudents.filter(s=>targetIds.has(String(s?.student_id||''))):allStudents;
    const assignmentView={
      ...(state.selectedAssignment||{}),
      ...a,
      list_meta:assignmentMeta(state.selectedAssignment||a)
    };
    const modes=Array.isArray(assignmentView?.list_meta?.required_modes)&&assignmentView.list_meta.required_modes.length
      ?assignmentView.list_meta.required_modes
      :(Array.isArray(a.required_modes)?a.required_modes:[]);
    const labels={quiz:'Quiz',spelling_test:'Spelling',speaking:'Speaking'};
    const summaries=students.map(student=>({student,summary:adjustedStudentSummary(assignmentView,student,modes)}));
    const complete=summaries.filter(x=>x.summary.status==='complete').length;
    const started=summaries.filter(x=>x.summary.status==='in_progress').length;
    const overall=summaries.length?Math.round(summaries.reduce((sum,x)=>sum+x.summary.overall,0)/summaries.length):0;
    const modeStats=modes.map(mode=>{
      const values=summaries.map(x=>adjustedStudentMode(assignmentView,x.student,mode).percent);
      const pct=values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length):0;
      const count=assignmentModeTargetCount(assignmentView,mode,progress.target_count);
      return '<div class="assignment-kpi"><strong>'+pct+'%</strong><span>'+esc(labels[mode]||mode)+' · '+count+' words</span></div>';
    }).join('');

    detail.hidden=false;
    detail.innerHTML=
      '<div class="assignment-detail-head">'+
        '<button class="assignment-back" type="button" id="assignmentBackBtn">← Assignments</button>'+
        '<div><h2>'+esc(a.title||'Vocabulary Study')+'</h2><p>'+esc(a.class||'')+' · '+progress.target_count+' words'+(assignmentWorkloadMode(assignmentView)==='split'?' · Split workload':'')+' · Due '+esc(fmtDate(a.due_at))+'</p></div>'+
        '<div class="assignment-detail-actions">'+
          (isCurrent(state.selectedAssignment||a)
            ?'<button class="control" type="button" id="assignmentEditBtn">Edit</button><button class="control assignment-cancel-btn" type="button" id="assignmentCancelBtn">Cancel assignment</button>'
            :((state.selectedAssignment||a)?.ended_at?'<button class="control assignment-reactivate-btn" type="button" id="assignmentReactivateBtn">Reactivate</button>':''))+
          '<button class="control assignment-delete-btn" type="button" id="assignmentDeleteBtn">Delete</button>'+
          '<button class="control" type="button" id="assignmentDetailRefresh">Refresh</button>'+
        '</div>'+
      '</div>'+
      '<div id="assignmentManagePanel" class="assignment-manage-panel" hidden></div>'+
      '<div class="assignment-kpis">'+
        '<div class="assignment-kpi"><strong>'+overall+'%</strong><span>Class overall</span></div>'+
        '<div class="assignment-kpi"><strong>'+complete+'/'+students.length+'</strong><span>Complete</span></div>'+
        '<div class="assignment-kpi"><strong>'+started+'</strong><span>In progress</span></div>'+
        modeStats+
      '</div>'+
      '<div class="assignment-matrix-wrap"><table class="assignment-matrix"><thead><tr>'+
        '<th>Student</th>'+
        modes.map(mode=>'<th>'+esc(labels[mode]||mode)+'</th>').join('')+
        '<th>Overall</th><th>Status</th>'+
      '</tr></thead><tbody>'+
      students.map(s=>{
        const summary=adjustedStudentSummary(assignmentView,s,modes);
        return '<tr class="assignment-student-row" data-student-id="'+esc(s.student_id)+'">'+
          '<td><strong>'+esc(s.name||s.korean_name||'Student')+'</strong>'+(s.korean_name&&s.korean_name!==s.name?'<small>'+esc(s.korean_name)+'</small>':'')+'</td>'+
          modes.map(mode=>{
            const m=adjustedStudentMode(assignmentView,s,mode);
            return '<td><span class="assignment-pct '+pctClass(m.percent)+'">'+m.percent+'%</span><small>'+m.clean+'/'+m.total+'</small></td>';
          }).join('')+
          '<td><span class="assignment-pct '+pctClass(summary.overall)+'">'+summary.overall+'%</span></td>'+
          '<td><span class="assignment-status '+esc(summary.status)+'">'+esc(statusLabel(summary.status))+'</span></td>'+
        '</tr>';
      }).join('')+
      '</tbody></table></div>'+
      '<div id="assignmentStudentDetail" class="assignment-student-detail" hidden></div>';

    $('#assignmentBackBtn')?.addEventListener('click',renderList);
    $('#assignmentDetailRefresh')?.addEventListener('click',()=>openAssignment(a.id,true));
    $('#assignmentEditBtn')?.addEventListener('click',()=>showAssignmentEdit(a.id));
    $('#assignmentCancelBtn')?.addEventListener('click',()=>cancelAssignment(a.id));
    $('#assignmentReactivateBtn')?.addEventListener('click',()=>reactivateAssignment(a.id));
    $('#assignmentDeleteBtn')?.addEventListener('click',()=>deleteAssignment(a.id));
    $$('.assignment-student-row',detail).forEach(row=>row.addEventListener('click',()=>openStudentDetail(a.id,row.dataset.studentId)));
  }

  async function showAssignmentEdit(id){
    const assignment=state.assignments.find(x=>String(x.id)===String(id))||state.selectedAssignment;
    const panel=$('#assignmentManagePanel');
    if(!assignment||!panel)return;
    const required=Array.isArray(assignment?.list_meta?.required_modes)?assignment.list_meta.required_modes:[];
    const initialWorkload=assignmentWorkloadMode(assignment);
    let splitAllocation=initialWorkload==='split'
      ?JSON.parse(JSON.stringify(assignmentMeta(assignment).mode_target_ids||{}))
      :{};
    let assignmentTargetIds=Array.isArray(state.progress?.targets)
      ?state.progress.targets.map(target=>String(target?.lexical_entry_id||target?.id||'')).filter(Boolean)
      :[];
    if(!assignmentTargetIds.length&&initialWorkload==='split'){
      assignmentTargetIds=[...new Set(Object.values(splitAllocation).flat().map(String).filter(Boolean))];
    }
    if(!assignmentTargetIds.length){
      try{
        const targetData=await api(route('vocab_assignment_progress',{assignment_id:id}));
        assignmentTargetIds=Array.isArray(targetData?.targets)
          ?targetData.targets.map(target=>String(target?.lexical_entry_id||target?.id||'')).filter(Boolean)
          :[];
      }catch(error){
        console.warn('[Assignments] could not preload workload targets',error);
      }
    }
    const targetIds=new Set((Array.isArray(assignment?.list_meta?.target_student_ids)?assignment.list_meta.target_student_ids:[]).map(String));
    const targeted=targetIds.size>0;

    panel.hidden=false;
    panel.innerHTML=
      '<form id="assignmentEditForm" class="assignment-edit-form">'+
        '<div class="assignment-edit-grid">'+
          '<label><span>Title</span><input id="assignmentEditTitle" type="text" value="'+esc(assignment.title||'')+'" required></label>'+
          '<label><span>Due date</span><input id="assignmentEditDue" type="date" value="'+esc(dateInputValue(assignment.due_at))+'" required></label>'+
        '</div>'+
        '<fieldset class="assignment-edit-modes"><legend>Required sections</legend>'+
          '<label><input type="checkbox" value="quiz"'+(required.includes('quiz')?' checked':'')+'> Quiz</label>'+
          '<label><input type="checkbox" value="spelling_test"'+(required.includes('spelling_test')?' checked':'')+'> Spelling</label>'+
          '<label><input type="checkbox" value="speaking"'+(required.includes('speaking')?' checked':'')+'> Speaking</label>'+
        '</fieldset>'+
        '<fieldset class="assignment-edit-workload"><legend>Workload</legend>'+
          '<label><input type="radio" name="assignmentWorkload" value="all"'+(initialWorkload==='all'?' checked':'')+'> All words in every mode</label>'+
          '<label><input type="radio" name="assignmentWorkload" value="split"'+(initialWorkload==='split'?' checked':'')+'> Split words between modes</label>'+
          '<div id="assignmentWorkloadSummary" class="assignment-workload-summary"></div>'+
          '<button type="button" class="control assignment-reshuffle-btn" id="assignmentReshuffleBtn">↻ Reshuffle split</button>'+
        '</fieldset>'+
        '<fieldset class="assignment-edit-target"><legend>Students</legend>'+
          '<label><input type="radio" name="assignmentTargetScope" value="class"'+(!targeted?' checked':'')+'> Entire class</label>'+
          '<label><input type="radio" name="assignmentTargetScope" value="students"'+(targeted?' checked':'')+'> Selected students</label>'+
          '<div id="assignmentStudentPicker" class="assignment-student-picker"'+(targeted?'':' hidden')+'><div class="assignment-edit-loading">Loading students…</div></div>'+
        '</fieldset>'+
        '<div class="assignment-edit-note" id="assignmentEditNote"></div>'+
        '<div class="assignment-edit-actions"><button type="button" class="control" id="assignmentEditClose">Close</button><button type="submit" class="control assignment-save-btn">Save changes</button></div>'+
      '</form>';

    $('#assignmentEditClose',panel)?.addEventListener('click',()=>{panel.hidden=true;panel.innerHTML=''});

    const picker=$('#assignmentStudentPicker',panel);
    let classStudents=[];
    try{
      classStudents=await loadClassStudents(assignment.class||'');
      picker.innerHTML=classStudents.length
        ?classStudents.map(student=>{
          const sid=String(student.user_id||student.id||'');
          const name=student.name||student.korean_name||'Student';
          const ko=student.korean_name&&student.korean_name!==student.name?' · '+student.korean_name:'';
          return '<label class="assignment-student-check"><input type="checkbox" value="'+esc(sid)+'"'+(targetIds.has(sid)?' checked':'')+'><span>'+esc(name+ko)+'</span></label>';
        }).join('')
        :'<div class="assignment-edit-loading">No students found in '+esc(assignment.class||'this class')+'.</div>';
    }catch(error){
      picker.innerHTML='<div class="assignment-edit-loading">Could not load students: '+esc(error.message)+'</div>';
    }

    const workloadSummary=$('#assignmentWorkloadSummary',panel);
    const reshuffle=$('#assignmentReshuffleBtn',panel);
    const editModes=()=>$('.assignment-edit-modes input:checked',panel).map(input=>input.value);
    const editWorkload=()=>$('input[name="assignmentWorkload"]:checked',panel)?.value||'all';
    const renderWorkload=({reshuffleSplit=false}={})=>{
      const modes=editModes();
      const workload=editWorkload();
      if(workload==='split'){
        const keys=Object.keys(splitAllocation||{});
        if(reshuffleSplit||keys.length!==modes.length||modes.some(mode=>!keys.includes(mode))){
          splitAllocation=balancedModeSplit(assignmentTargetIds,modes);
        }
      }
      if(reshuffle)reshuffle.hidden=workload!=='split'||modes.length<2;
      if(!workloadSummary)return;
      if(workload!=='split'){
        workloadSummary.innerHTML='<span>'+assignmentTargetIds.length+' words in every selected mode</span>';
        return;
      }
      const labels={quiz:'Quiz',spelling_test:'Spelling',speaking:'Speaking'};
      workloadSummary.innerHTML=modes.map(mode=>{
        const count=Array.isArray(splitAllocation?.[mode])?splitAllocation[mode].length:0;
        return '<span><b>'+esc(labels[mode]||mode)+'</b> '+count+' words'+(mode==='quiz'?' · '+(count*2)+' questions':'')+'</span>';
      }).join('');
    };
    $('.assignment-edit-modes input',panel).forEach(input=>input.addEventListener('change',()=>renderWorkload({reshuffleSplit:true})));
    $('input[name="assignmentWorkload"]',panel).forEach(input=>input.addEventListener('change',()=>renderWorkload({reshuffleSplit:input.value==='split'})));
    reshuffle?.addEventListener('click',()=>{
      const anyStarted=Array.isArray(state.progress?.students)&&state.progress.students.some(student=>
        Object.values(student?.modes||{}).some(mode=>Number(mode?.attempts)>0||Number(mode?.clean)>0)
      );
      if(anyStarted&&!confirm('Students have already started this assignment. Reshuffling changes which words they need in each mode. Continue?'))return;
      renderWorkload({reshuffleSplit:true});
    });
    renderWorkload();

    $('input[name="assignmentTargetScope"]',panel).forEach(input=>input.addEventListener('change',()=>{
      const studentMode=$('input[name="assignmentTargetScope"]:checked',panel)?.value==='students';
      picker.hidden=!studentMode;
    }));

    $('#assignmentEditForm',panel)?.addEventListener('submit',async e=>{
      e.preventDefault();
      const title=$('#assignmentEditTitle',panel)?.value.trim()||'';
      const dueAt=dueAtFromDate($('#assignmentEditDue',panel)?.value||'');
      const modes=$('.assignment-edit-modes input:checked',panel).map(input=>input.value);
      const workload=editWorkload();
      if(workload==='split')renderWorkload();
      const scope=$('input[name="assignmentTargetScope"]:checked',panel)?.value||'class';
      const studentIds=scope==='students'
        ?$$('.assignment-student-picker input:checked',panel).map(input=>input.value)
        :[];
      const note=$('#assignmentEditNote',panel);

      if(!title){note.textContent='Enter a title.';return}
      if(!dueAt){note.textContent='Choose a valid due date.';return}
      if(!modes.length){note.textContent='Choose at least one required section.';return}
      if(scope==='students'&&!studentIds.length){note.textContent='Choose at least one student.';return}

      const submit=$('.assignment-save-btn',panel);
      submit.disabled=true;
      submit.textContent='Saving…';
      note.textContent='';

      try{
        const targetStudents=scope==='students'
          ?classStudents.filter(student=>studentIds.includes(String(student.user_id||student.id||''))).map(student=>({
              id:String(student.user_id||student.id||''),
              name:student.name||student.korean_name||'Student',
              korean_name:student.korean_name||null
            }))
          :[];

        const listMeta={
          required_modes:modes,
          target_student_ids:studentIds,
          target_students:targetStudents,
          workload_mode:workload,
          workload_version:1,
          mode_target_ids:workload==='split'?Object.fromEntries(modes.map(mode=>[mode,(splitAllocation[mode]||[]).slice()])):null,
          mode_target_counts:workload==='split'?Object.fromEntries(modes.map(mode=>[mode,(splitAllocation[mode]||[]).length])):null
        };

        // The deployed homework API already supports metadata updates. Student targeting
        // and required modes live in list_meta, so do not require the newer worker action.
        const metaData=await api(route('update_assignment_meta'),{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            assignment_id:id,
            list_meta:listMeta
          })
        });

        // Title/due-date editing needs the newer full update endpoint. Only call it when
        // those values actually changed, so ordinary student-target edits work everywhere.
        const originalTitle=String(assignment.title||'').trim();
        const originalDue=dateInputValue(assignment.due_at);
        const requestedDue=$('#assignmentEditDue',panel)?.value||'';
        let finalAssignment=metaData.assignment||assignment;

        if(title!==originalTitle||requestedDue!==originalDue){
          try{
            const fullData=await api(route('update_assignment'),{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({assignment_id:id,title,due_at:dueAt})
            });
            if(fullData.assignment)finalAssignment=fullData.assignment;
          }catch(fullError){
            if(String(fullError.message||'').toLowerCase().includes('invalid action')){
              note.textContent='Student settings saved. Title/due-date editing needs the newer homework API deployment.';
            }else{
              throw fullError;
            }
          }
        }

        if(finalAssignment){
          const idx=state.assignments.findIndex(x=>String(x.id)===String(id));
          if(idx>=0)state.assignments[idx]=finalAssignment;
          state.selectedAssignment=finalAssignment;
        }
        panel.hidden=true;
        panel.innerHTML='';
        state.loaded=false;
        await loadAssignments(true);
        await openAssignment(id,true);
      }catch(error){
        note.textContent='Could not save changes: '+error.message;
        submit.disabled=false;
        submit.textContent='Save changes';
      }
    });
  }

  async function cancelAssignment(id){
    const assignment=state.assignments.find(x=>String(x.id)===String(id))||state.selectedAssignment;
    if(!assignment)return;
    if(!confirm('Cancel this assignment?\n\nStudents will no longer see it as current work. Existing progress will be kept.'))return;
    try{
      await api(route('end_assignment'),{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({assignment_id:id})
      });
      state.loaded=false;
      await loadAssignments(true);
    }catch(error){
      alert('Could not cancel assignment: '+error.message);
    }
  }

  async function reactivateAssignment(id){
    const assignment=state.assignments.find(x=>String(x.id)===String(id))||state.selectedAssignment;
    if(!assignment)return;
    if(!confirm('Reactivate this assignment?\n\nStudents will see it as current work again.'))return;
    try{
      await api(route('reactivate_assignment'),{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({assignment_id:id})
      });
      state.loaded=false;
      state.filter='current';
      $$('[data-assignment-status]').forEach(btn=>btn.classList.toggle('active',btn.dataset.assignmentStatus==='current'));
      await loadAssignments(true);
    }catch(error){
      alert('Could not reactivate assignment: '+error.message);
    }
  }

  async function deleteAssignment(id){
    const assignment=state.assignments.find(x=>String(x.id)===String(id))||state.selectedAssignment;
    if(!assignment)return;
    if(!confirm('Delete this assignment permanently?\n\nThis removes the assignment record. This cannot be undone.'))return;
    try{
      await api(route('delete_assignment',{id}),{method:'DELETE'});
      state.loaded=false;
      await loadAssignments(true);
    }catch(error){
      alert('Could not delete assignment: '+error.message);
    }
  }

  async function openAssignment(id,force=false){
    const a=state.assignments.find(x=>String(x.id)===String(id));
    if(!a)return;
    state.selectedAssignment=a;
    const list=$('#assignmentList');
    const detail=$('#assignmentDetail');
    if(list)list.innerHTML='<div class="empty">Loading class progress…</div>';
    if(detail)detail.hidden=true;
    try{
      const data=await api(route('assignment_progress',{assignment_id:id,class:a.class||''}));
      state.progress=data;
      renderProgress(data);
      if(list)list.innerHTML='';
    }catch(error){
      if(list)list.innerHTML='<div class="empty">Could not load assignment progress: '+esc(error.message)+'</div>';
    }
  }

  function modeCell(m){
    if(!m||!m.attempts)return'<span class="word-state not-started">—</span>';
    if(m.clean)return'<span class="word-state clean">Clean</span>';
    return '<span class="word-state needs-work">Review</span><small>'+Number(m.wrong_attempts||0)+' wrong · '+Number(m.attempts||0)+' attempts</small>';
  }

  function renderStudentDetail(data){
    const box=$('#assignmentStudentDetail');
    if(!box)return;
    const student=data.student||{};
    const targets=Array.isArray(data.targets)?data.targets:[];
    const modes=Array.isArray(data.required_modes)?data.required_modes:[];
    const labels={quiz:'Quiz',spelling_test:'Spelling',speaking:'Speaking'};
    const needs=targets.filter(t=>Object.values(t.modes||{}).some(m=>m&&m.attempts>0&&!m.clean)).length;
    const clean=targets.filter(t=>t.fully_clean).length;
    box.hidden=false;
    box.innerHTML=
      '<div class="assignment-student-head"><div><h3>'+esc(student.name||student.korean_name||'Student')+'</h3><p>'+clean+' fully clean · '+needs+' words need review</p></div><button type="button" class="assignment-student-close">×</button></div>'+
      '<div class="assignment-word-table-wrap"><table class="assignment-word-table"><thead><tr><th>Word</th>'+
      modes.map(mode=>'<th>'+esc(labels[mode]||mode)+'</th>').join('')+
      '</tr></thead><tbody>'+
      targets.map(t=>'<tr class="'+(t.fully_clean?'fully-clean':(t.started?'started':'not-started'))+'"><td><strong>'+esc(t.english||'')+'</strong><small>'+esc(t.korean||'')+'</small></td>'+
        modes.map(mode=>'<td>'+modeCell(t.modes?.[mode])+'</td>').join('')+
      '</tr>').join('')+
      '</tbody></table></div>';
    $('.assignment-student-close',box)?.addEventListener('click',()=>{box.hidden=true;box.innerHTML=''});
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  async function openStudentDetail(assignmentId,studentId){
    const box=$('#assignmentStudentDetail');
    if(!box)return;
    box.hidden=false;
    box.innerHTML='<div class="empty">Loading word progress…</div>';
    try{
      const data=await api(route('vocab_assignment_student_detail',{assignment_id:assignmentId,student_id:studentId}));
      state.studentDetail=data;
      renderStudentDetail(data);
    }catch(error){
      box.innerHTML='<div class="empty">Could not load word detail: '+esc(error.message)+'</div>';
    }
  }

  function wire(){
    $('#assignmentClassFilter')?.addEventListener('change',e=>{
      state.className=e.target.value||'';
      renderList();
    });
    $('#assignmentRefreshBtn')?.addEventListener('click',()=>loadAssignments(true));
    $('[data-assignment-status]').forEach(btn=>btn.addEventListener('click',()=>{
      state.filter=btn.dataset.assignmentStatus||'current';
      $('[data-assignment-status]').forEach(x=>x.classList.toggle('active',x===btn));
      renderList();
    }));
    $$('[data-view="assignments"]').forEach(btn=>btn.addEventListener('click',()=>loadAssignments()));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});
  else wire();

  window.WillenaAssignmentsV1={reload:()=>loadAssignments(true)};
})();