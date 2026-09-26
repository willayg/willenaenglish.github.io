(function(){
  'use strict';

  const HOMEWORK_PATH='/.netlify/functions/homework_api?action=create_assignment';
  const CLASSES_PATH='/.netlify/functions/progress_summary?section=teacher_classes';

  function apiUrl(path){
    return window.WillenaAPI&&typeof window.WillenaAPI.getApiUrl==='function'
      ?window.WillenaAPI.getApiUrl(path)
      :path;
  }

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[ch]);
  }

  async function getJson(path,options){
    const response=await (window.WillenaAPI
      ?window.WillenaAPI.fetch(path,options)
      :fetch(apiUrl(path),{credentials:'include',...(options||{})}));
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.success===false)throw new Error(data.error||('Request failed ('+response.status+')'));
    return data;
  }

  function tomorrowIsoDate(days=7){
    const d=new Date();
    d.setDate(d.getDate()+days);
    const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,10);
  }

  function dueAtFromDate(value){
    const text=String(value||'').trim();
    if(!text)return null;
    const d=new Date(text+'T23:59:59');
    return Number.isNaN(d.getTime())?null:d.toISOString();
  }

  async function loadClasses(){
    const data=await getJson(CLASSES_PATH);
    return Array.isArray(data.classes)?data.classes:[];
  }

  async function loadStudents(className){
    if(!className)return[];
    const q=new URLSearchParams({section:'teacher_class_insights',class:className,days:'30'});
    const data=await getJson('/.netlify/functions/progress_summary?'+q.toString());
    return Array.isArray(data.students)?data.students:[];
  }


  function wordBuilderApiFetch(path,options={}){
    const url=window.WillenaAPI&&typeof window.WillenaAPI.getApiUrl==='function'
      ?window.WillenaAPI.getApiUrl(path)
      :path;
    const opts={credentials:'include',cache:'no-store',...options};
    const headers=new Headers(opts.headers||{});
    headers.delete('Authorization');
    headers.delete('authorization');
    opts.headers=headers;
    return window.fetch(url,opts);
  }

  async function persistImagesToR2(worksheet){
    if(!worksheet||worksheet.worksheet_type!=='wordtest'||!worksheet.images)return worksheet;
    let images;
    try{images=typeof worksheet.images==='string'?JSON.parse(worksheet.images):worksheet.images}catch(_){return worksheet}
    if(!images||typeof images!=='object')return worksheet;

    const assets=[];
    for(const [key,image] of Object.entries(images)){
      if(!image||typeof image!=='object')continue;
      const src=String(image.src||'').trim();
      if(!src||src==='emoji'||image.emoji)continue;
      if(!/^https?:/i.test(src)&&!src.startsWith('data:'))continue;
      if(image.asset_key&&image.sha256&&image.mime_type&&image.bytes)continue;
      assets.push({key,source:src});
    }
    if(!assets.length)return worksheet;

    const res=await fetch('https://word-builder-assets.willena.workers.dev',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'omit',
      body:JSON.stringify({assets})
    });
    if(!res.ok)throw new Error('Image persistence failed ('+res.status+')');
    const result=await res.json().catch(()=>null);
    if(!result||result.success!==true||!Array.isArray(result.assets)){
      throw new Error(result?.error||'Image persistence returned invalid data');
    }
    const byKey=new Map(result.assets.map(x=>[String(x.input_key),x]));
    for(const asset of assets){
      const saved=byKey.get(String(asset.key));
      if(!saved||!saved.url||!saved.asset_key||!saved.sha256){
        throw new Error('Image persistence incomplete for '+asset.key);
      }
      images[asset.key]={
        ...(images[asset.key]||{}),
        src:saved.url,
        asset_key:saved.asset_key,
        sha256:saved.sha256,
        mime_type:saved.mime_type||null,
        bytes:saved.bytes||null
      };
    }
    worksheet.images=JSON.stringify(images);
    return worksheet;
  }

  function currentWorksheetForSave(){
    if(typeof window.getCurrentWorksheetData!=='function'){
      throw new Error('Word Test data is not ready yet.');
    }
    const worksheet=window.getCurrentWorksheetData();
    if(!worksheet||worksheet.worksheet_type!=='wordtest'){
      throw new Error('No Word Test is open.');
    }
    const meta=window._loadedWorksheetMeta||{};
    worksheet.book=String(meta.book||worksheet.book||'').trim();
    worksheet.book_id=meta.book_id||worksheet.book_id||null;
    worksheet.unit=String(meta.unit||worksheet.unit||'').trim();
    worksheet.language_point=meta.language_point||worksheet.language_point||'';
    worksheet.notes=meta.notes||worksheet.notes||'';
    if(window._currentWorksheetId)worksheet.user_id=window._currentWorksheetId;
    return worksheet;
  }

  async function ensureSavedWordTest(){
    const worksheet=currentWorksheetForSave();
    if(!Array.isArray(worksheet.words)||!worksheet.words.length){
      throw new Error('Add some words before assigning this Word Test.');
    }
    await persistImagesToR2(worksheet);
    const response=await wordBuilderApiFetch('/.netlify/functions/admin_classes?action=word_builder_save',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(worksheet)
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.success===false||!result.id){
      throw new Error(result.error||('Could not save Word Test ('+response.status+')'));
    }

    window._currentWorksheetId=result.id;
    window._loadedWorksheetMeta={
      ...(window._loadedWorksheetMeta||{}),
      title:worksheet.title||result.title||'',
      book:worksheet.book||'',
      book_id:worksheet.book_id||null,
      unit:worksheet.unit||'',
      language_point:worksheet.language_point||'',
      notes:worksheet.notes||''
    };

    return {
      ...result,
      success:true,
      worksheet:{
        id:result.id,
        title:worksheet.title||result.title||'',
        book:worksheet.book||'',
        book_id:worksheet.book_id||null,
        unit:worksheet.unit||''
      }
    };
  }

  window.onWordBuilderPersisted=function(saveResult){
    const id=saveResult?.id||saveResult?.worksheet?.id||'';
    if(id)window._currentWorksheetId=id;
    if(saveResult?.worksheet){
      window._loadedWorksheetMeta={
        ...(window._loadedWorksheetMeta||{}),
        title:saveResult.worksheet.title||window._loadedWorksheetMeta?.title||'',
        book:saveResult.worksheet.book||window._loadedWorksheetMeta?.book||'',
        book_id:saveResult.worksheet.book_id||window._loadedWorksheetMeta?.book_id||null,
        unit:saveResult.worksheet.unit||window._loadedWorksheetMeta?.unit||''
      };
    }
  };

  window.openWordBuilderAssignment=async function(){
    const btn=document.getElementById('assignWordTestBtn');
    const oldText=btn?.textContent||'Assign Word Test';
    if(btn){
      btn.setAttribute('aria-disabled','true');
      btn.textContent='Preparing…';
    }
    try{
      const saved=await ensureSavedWordTest();
      await openAssignmentModal(saved);
    }catch(error){
      console.error('[Word Builder] could not prepare assignment',error);
      alert('Could not prepare Word Test: '+(error?.message||'Unknown error'));
    }finally{
      if(btn){
        btn.removeAttribute('aria-disabled');
        btn.textContent=oldText;
      }
    }
  };

  function ensureModal(){
    let overlay=document.getElementById('wordBuilderAssignOverlay');
    if(overlay)return overlay;

    overlay=document.createElement('div');
    overlay.id='wordBuilderAssignOverlay';
    overlay.className='wb-assign-overlay';
    overlay.hidden=true;
    overlay.innerHTML=
      '<div class="wb-assign-modal" role="dialog" aria-modal="true" aria-labelledby="wbAssignTitle">'+
        '<button class="wb-assign-close" type="button" aria-label="Close">×</button>'+
        '<div class="wb-assign-kicker">WORD TEST</div>'+
        '<h2 id="wbAssignTitle">Assign Word Test</h2>'+
        '<p class="wb-assign-copy">Choose who should receive this test and which sections they should complete.</p>'+
        '<div class="wb-assign-saved-title" id="wbAssignSavedTitle"></div>'+
        '<label class="wb-assign-field"><span>Class</span><select id="wbAssignClass"><option value="">Loading classes…</option></select></label>'+
        '<fieldset class="wb-assign-scope"><legend>Assign to</legend>'+
          '<label><input type="radio" name="wbAssignScope" value="class" checked> Entire class</label>'+
          '<label><input type="radio" name="wbAssignScope" value="student"> One student</label>'+
        '</fieldset>'+
        '<label class="wb-assign-field" id="wbAssignStudentField" hidden><span>Student</span><select id="wbAssignStudent"><option value="">Choose a class first…</option></select></label>'+
        '<label class="wb-assign-field"><span>Due date</span><input id="wbAssignDue" type="date"></label>'+
        '<fieldset class="wb-assign-modes"><legend>Practice</legend>'+
          '<label><input type="checkbox" value="quiz" checked> Quiz</label>'+
          '<label><input type="checkbox" value="spelling_test" checked> Spelling</label>'+
          '<label><input type="checkbox" value="speaking" checked> Speaking</label>'+
        '</fieldset>'+
        '<div class="wb-assign-note" id="wbAssignNote"></div>'+
        '<div class="wb-assign-actions">'+
          '<button class="wb-assign-secondary" type="button" id="wbAssignCancel">Cancel</button>'+
          '<button class="wb-assign-primary" type="button" id="wbAssignSubmit">Assign Word Test</button>'+
        '</div>'+
      '</div>';

    document.body.appendChild(overlay);

    const close=()=>{
      overlay.hidden=true;
      document.body.classList.remove('wb-assign-open');
    };
    overlay.querySelector('.wb-assign-close')?.addEventListener('click',close);
    overlay.querySelector('#wbAssignCancel')?.addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});

    const scopeInputs=[...overlay.querySelectorAll('input[name="wbAssignScope"]')];
    scopeInputs.forEach(input=>input.addEventListener('change',()=>{
      const studentMode=overlay.querySelector('input[name="wbAssignScope"]:checked')?.value==='student';
      overlay.querySelector('#wbAssignStudentField').hidden=!studentMode;
    }));

    return overlay;
  }

  async function openAssignmentModal(saveResult){
    const overlay=ensureModal();
    const classSelect=overlay.querySelector('#wbAssignClass');
    const studentSelect=overlay.querySelector('#wbAssignStudent');
    const studentField=overlay.querySelector('#wbAssignStudentField');
    const dueInput=overlay.querySelector('#wbAssignDue');
    const titleEl=overlay.querySelector('#wbAssignSavedTitle');
    const noteEl=overlay.querySelector('#wbAssignNote');
    const submitBtn=overlay.querySelector('#wbAssignSubmit');
    const worksheet=saveResult?.worksheet||{};
    const targets=Array.isArray(saveResult?.targets)?saveResult.targets:[];
    const collectionId=saveResult?.id||worksheet.id||'';

    titleEl.textContent=worksheet.title||saveResult?.title||'Saved worksheet';
    dueInput.value=tomorrowIsoDate(7);
    noteEl.classList.remove('is-success');
    noteEl.textContent=targets.length
      ?targets.length+' saved word'+(targets.length===1?'':'s')
      :'No assignable vocabulary targets were returned.';
    submitBtn.disabled=!collectionId||!targets.length;
    submitBtn.textContent='Assign Word Test';
    classSelect.innerHTML='<option value="">Loading classes…</option>';
    studentSelect.innerHTML='<option value="">Choose a class first…</option>';
    studentField.hidden=true;
    const classScope=overlay.querySelector('input[name="wbAssignScope"][value="class"]');
    if(classScope)classScope.checked=true;

    overlay.hidden=false;
    document.body.classList.add('wb-assign-open');

    let currentStudents=[];

    const refreshStudents=async()=>{
      const className=classSelect.value;
      currentStudents=[];
      studentSelect.innerHTML=className?'<option value="">Loading students…</option>':'<option value="">Choose a class first…</option>';
      if(!className)return;
      try{
        currentStudents=await loadStudents(className);
        studentSelect.innerHTML='<option value="">Choose a student…</option>'+
          currentStudents.map(student=>{
            const id=String(student.user_id||student.id||'');
            const name=String(student.name||student.korean_name||'Student');
            const ko=student.korean_name&&student.korean_name!==student.name?' · '+student.korean_name:'';
            return '<option value="'+esc(id)+'">'+esc(name+ko)+'</option>';
          }).join('');
        if(!currentStudents.length)studentSelect.innerHTML='<option value="">No students found</option>';
      }catch(error){
        studentSelect.innerHTML='<option value="">Could not load students</option>';
        noteEl.textContent='Could not load students: '+error.message;
      }
    };
    classSelect.onchange=refreshStudents;

    try{
      const classes=await loadClasses();
      classSelect.innerHTML='<option value="">Choose a class…</option>'+
        classes.map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+
          (Number(c.student_count)>=0?' ('+Number(c.student_count)+')':'')+
          '</option>').join('');
      if(!classes.length)classSelect.innerHTML='<option value="">No classes found</option>';
    }catch(error){
      classSelect.innerHTML='<option value="">Could not load classes</option>';
      noteEl.textContent='Could not load classes: '+error.message;
    }

    submitBtn.onclick=async()=>{
      const className=classSelect.value;
      const scope=overlay.querySelector('input[name="wbAssignScope"]:checked')?.value||'class';
      const dueAt=dueAtFromDate(dueInput.value);
      const modes=[...overlay.querySelectorAll('.wb-assign-modes input:checked')].map(x=>x.value);

      if(!className){noteEl.textContent='Choose a class.';return}
      if(scope==='student'&&!studentSelect.value){noteEl.textContent='Choose a student.';return}
      if(!dueAt){noteEl.textContent='Choose a valid due date.';return}
      if(!modes.length){noteEl.textContent='Choose at least one practice mode.';return}

      const selectedStudent=scope==='student'
        ?currentStudents.find(s=>String(s.user_id||s.id||'')===String(studentSelect.value))
        :null;

      submitBtn.disabled=true;
      submitBtn.textContent='Assigning…';
      noteEl.textContent='';

      try{
        const listMeta={
          source_app:'word_builder',
          word_builder_collection_id:collectionId,
          source_book_id:worksheet.book_id||saveResult?.book_id||null,
          required_modes:modes
        };
        if(selectedStudent){
          const studentId=String(selectedStudent.user_id||selectedStudent.id||'');
          listMeta.target_student_ids=[studentId];
          listMeta.target_students=[{
            id:studentId,
            name:selectedStudent.name||selectedStudent.korean_name||'Student',
            korean_name:selectedStudent.korean_name||null
          }];
        }

        const payload={
          class:className,
          title:worksheet.title||saveResult?.title||'Word Test',
          description:'Assigned from Word Builder',
          source_type:'vocab_study',
          list_key:'word_builder:'+collectionId,
          list_title:worksheet.title||saveResult?.title||null,
          list_meta:listMeta,
          targets:targets.map((target,index)=>({
            lexical_entry_id:target.lexical_entry_id,
            position:Number.isFinite(Number(target.position))?Number(target.position):index,
            english:target.english||'',
            korean:target.korean||''
          })),
          start_at:new Date().toISOString(),
          due_at:dueAt,
          goal_type:'clean_pass',
          goal_value:100
        };

        const data=await getJson(HOMEWORK_PATH,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });

        const who=selectedStudent
          ?(selectedStudent.name||selectedStudent.korean_name||'student')
          :className;
        noteEl.textContent='Assigned to '+who+'.';
        noteEl.classList.add('is-success');
        submitBtn.textContent='Assigned';

        window.dispatchEvent(new CustomEvent('wordbuilder:assignment-created',{
          detail:{assignment:data.assignment||null,collection_id:collectionId}
        }));

        setTimeout(()=>{
          overlay.hidden=true;
          document.body.classList.remove('wb-assign-open');
          noteEl.classList.remove('is-success');
          submitBtn.textContent='Assign Word Test';
          submitBtn.disabled=false;
        },850);
      }catch(error){
        noteEl.textContent='Could not assign: '+error.message;
        submitBtn.disabled=false;
        submitBtn.textContent='Assign Word Test';
      }
    };
  }

  // Backward-compatible handoff for any older save-and-assign callers.
  window.onWordBuilderSaved=function(saveResult){
    if(!saveResult||!saveResult.success)return;
    window.onWordBuilderPersisted(saveResult);
    openAssignmentModal(saveResult).catch(error=>{
      console.error('[Word Builder] Assign Word Test modal failed:',error);
      alert('The word test was saved, but the assignment window could not open.');
    });
  };
})();