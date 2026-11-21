/* Genius Apps usage centre — teachers branch only. */
(() => {
  'use strict';
  const APP = {
    word: { name: 'Word Genius', short: 'WG', color: '#08b3b1' },
    sentence: { name: 'Sentence Genius', short: 'SG', color: '#398cf3' },
    grammar: { name: 'Grammar Genius', short: 'GG', color: '#9655e4' },
    talking: { name: 'Free Talking Genius', short: 'FTG', color: '#ef65a0' },
    writing: { name: 'Writing Genius', short: 'WR', color: '#f5a623' },
    puzzles: { name: 'Puzzles', short: 'PZ', color: '#86c65b' }
  };
  const ui = { data: null, period: '30', className: '', app: '', trend: 'sessions',
               ranking: 'students', rankingStatus: 'active', classOptions: [], current: 0 };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const format = value => Number(value || 0).toLocaleString('en-US');
  const pct = value => Number(value || 0).toFixed(1).replace(/\.0$/,'');
  const label = key => APP[key]?.name || key;
  const $ = (sel,root=document) => root.querySelector(sel);
  const dateLabel = iso => {
    const [year,month,day] = String(iso).split('-');
    return year && month && day ? (Number(month) + '/' + Number(day)) : iso;
  };
  const compare = (current, previous) => {
    if (!previous) return current ? '<span class="ga-up">New activity</span> vs previous period' : 'No previous activity';
    const change = 100 * (current - previous) / previous;
    return '<span class="' + (change >= 0 ? 'ga-up' : 'ga-down') + '">' +
      (change > 0 ? '▲ +' : change < 0 ? '▼ ' : '— ') + pct(change) +
      '%</span> vs previous period';
  };

  const section = document.createElement('section');
  section.id = 'view-genius-usage';
  section.className = 'view';
  section.innerHTML = [
    '<div class="ga-header"><div class="ga-heading"><span class="ga-mark" aria-hidden="true">▥</span>',
    '<div><h1>Genius Apps</h1><p class="ga-subtitle">App usage, activity and top users</p></div></div>',
    '<div class="ga-controls">',
    '<select class="ga-control" id="gaPeriod" aria-label="Date range">',
    '<option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option>',
    '<option value="90">Last 90 days</option><option value="custom">Custom range</option></select>',
    '<select class="ga-control" id="gaClass" aria-label="Class"><option value="">All classes</option></select>',
    '<select class="ga-control" id="gaApp" aria-label="Genius app"><option value="">All apps</option>',
    ...Object.keys(APP).map(k => '<option value="' + k + '">' + escape(label(k)) + '</option>'),
    '</select><button class="ga-button" id="gaRefresh" type="button">↻ Refresh</button></div></div>',
    '<div id="gaCustom" class="ga-custom-range" hidden><label>From <input type="date" id="gaStart" class="ga-control"></label>',
    '<label>To <input type="date" id="gaEnd" class="ga-control"></label>',
    '<button type="button" class="ga-button" id="gaApply">Apply dates</button></div>',
    '<div id="gaMessage" class="ga-loading" role="status">Open Genius Apps to load usage analytics.</div>',
    '<div id="gaContent" hidden>',
    '<div class="ga-kpis" id="gaKpis"></div>',
    '<div class="ga-grid"><article class="ga-card"><div class="ga-card-head">',
    '<div><h2>Daily App Usage</h2><p id="gaTrendDescription">Recorded sessions per day</p></div>',
    '<div class="ga-pills"><button type="button" class="ga-pill active" data-ga-trend="sessions">Sessions</button>',
    '<button type="button" class="ga-pill" data-ga-trend="students">Students</button></div></div>',
    '<div id="gaChart"></div></article>',
    '<article class="ga-card"><div class="ga-card-head"><div><h2 id="gaRankingTitle">Top Students</h2>',
    '<p id="gaRankingSubtitle">Most active students in this period</p></div>',
    '<div class="ga-pills"><button type="button" class="ga-pill active" data-ga-ranking="students">Students</button>',
    '<button type="button" class="ga-pill" data-ga-ranking="classes">Classes</button></div></div>',
    '<div id="gaRankingExtras"></div><div class="ga-ranked" id="gaRanking"></div></article></div>',
    '<div class="ga-grid"><article class="ga-card"><div class="ga-card-head"><div>',
    '<h2>App Usage Breakdown</h2><p>Share of recorded sessions · tap to filter</p></div></div>',
    '<div class="ga-app-content"><div id="gaDonut"></div><div id="gaAppList" class="ga-app-list"></div></div></article>',
    '<article class="ga-card"><div class="ga-card-head"><div><h2>Recent Activity</h2>',
    '<p>Latest recorded student sessions in the selected period</p></div></div>',
    '<div class="ga-feed" id="gaRecent"></div></article></div>',
    '<p class="ga-note">Counts represent recorded practice sessions, not app opens or time on screen. ',
    'Where both study and progress systems recorded the same activity, the overlapping event is counted once. ',
    'Student testing/ghost profiles and Test classes are excluded. All dates use Korean time (KST).</p>',
    '</div>'
  ].join('');

  const workspace = $('.workspace');
  const rail = $('.rail');
  if (!workspace || !rail || $('#view-genius-usage')) return;
  workspace.insertBefore(section, workspace.firstChild);
  const button = document.createElement('button');
  button.className = 'nav';
  button.type = 'button';
  button.dataset.view = 'genius-usage';
  button.innerHTML = '<span class="nav-icon" aria-hidden="true">▥</span><span>Genius Apps</span>';
  const after = rail.querySelector('[data-view="assignments"]');
  rail.insertBefore(button, after ? after.nextSibling : rail.querySelector('[data-view="vocab"]'));
  const mobile = $('.mobile-tabs');
  let mobileButton = null;
  if (mobile) {
    mobileButton = document.createElement('button');
    mobileButton.type = 'button';
    mobileButton.className = 'mobile-tab';
    mobileButton.dataset.view = 'genius-usage';
    mobileButton.innerHTML = '<b aria-hidden="true">▥</b>Genius Apps';
    mobile.insertBefore(mobileButton, mobile.querySelector('[data-view="apps"]'));
  }

  function changeView() {
    if (typeof switchView === 'function') switchView('genius-usage');
    else {
      document.querySelectorAll('.view').forEach(x => x.classList.toggle('active',x===section));
      document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active',x===button||x===mobileButton));
    }
    if (!ui.data) load();
  }
  button.addEventListener('click',changeView);
  mobileButton?.addEventListener('click',changeView);

  function kpis(data) {
    const summary = data.summary || {};
    const active = Number(summary.activeStudents || 0), enrolled = Number(summary.enrolledStudents || 0);
    const sessions = Number(summary.sessions || 0);
    const items = [
      ['Active students', format(active), compare(active,Number(summary.priorActiveStudents||0))],
      ['Recorded sessions', format(sessions), compare(sessions,Number(summary.priorSessions||0))],
      ['Participation', enrolled ? pct(100*active/enrolled)+'%' : '—', format(active)+' of '+format(enrolled)+' enrolled'],
      ['Sessions per active student', active ? pct(sessions/active) : '0', format(data.range?.days||30)+' day period']
    ];
    $('#gaKpis',section).innerHTML = items.map(([key,value,foot]) =>
      '<div class="ga-kpi"><div class="ga-kpi-label">'+escape(key)+'</div>'+
      '<div class="ga-kpi-number">'+escape(value)+'</div><div class="ga-kpi-foot">'+foot+'</div></div>').join('');
  }
  function drawChart(data) {
    const points = Array.isArray(data.daily) ? data.daily : [];
    const target = $('#gaChart',section);
    if (!points.length) { target.innerHTML='<div class="ga-empty">No activity in this period.</div>'; return; }
    const width=700,height=255,left=43,right=12,top=13,bottom=38,plotW=width-left-right,plotH=height-top-bottom;
    const series=points.map(p=>Number(p[ui.trend]||0)), max=Math.max(1,...series);
    const ceiling=Math.ceil(max/4)*4;
    const x=i=>left+(points.length===1?plotW/2:i*plotW/(points.length-1));
    const y=value=>top+plotH-(value/ceiling)*plotH;
    const coords=series.map((value,i)=>x(i).toFixed(2)+','+y(value).toFixed(2));
    const area='M '+coords.join(' L ')+' L '+x(points.length-1)+','+(top+plotH)+' L '+x(0)+','+(top+plotH)+' Z';
    const grid=Array.from({length:5},(_,i)=>{
      const val=Math.round(ceiling*i/4), yy=y(val);
      return '<line class="ga-gridline" x1="'+left+'" x2="'+(width-right)+'" y1="'+yy+'" y2="'+yy+'"/>'+
        '<text x="'+(left-7)+'" y="'+(yy+4)+'" text-anchor="end">'+val+'</text>';
    }).join('');
    const step=Math.max(1,Math.ceil(points.length/7));
    const labels=points.map((p,i)=>(i%step===0||i===points.length-1)
      ? '<text x="'+x(i)+'" y="'+(height-13)+'" text-anchor="middle">'+escape(dateLabel(p.date))+'</text>':'').join('');
    const circles=points.map((p,i)=>
      '<circle class="ga-dot" cx="'+x(i)+'" cy="'+y(series[i])+'" r="'+(points.length>35?'2':'3')+'">'+
      '<title>'+escape(p.date)+': '+format(series[i])+' '+ui.trend+'</title></circle>').join('');
    target.innerHTML='<svg class="ga-chart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escape(ui.trend)+' by day">'+
      grid+'<path class="ga-area" d="'+area+'"/><polyline class="ga-line" points="'+coords.join(' ')+'"/>'+
      circles+labels+'</svg><div class="ga-chart-foot"><span>'+escape(data.range?.start||'')+
      ' – '+escape(data.range?.end||'')+'</span><span>Peak: '+format(max)+' '+ui.trend+'</span></div>';
    $('#gaTrendDescription',section).textContent=ui.trend==='students'?'Unique students active each day':'Recorded sessions per day (all selected apps)';
    section.querySelectorAll('[data-ga-trend]').forEach(btn=>btn.classList.toggle('active',btn.dataset.gaTrend===ui.trend));
  }
  function ranking(data) {
    const isClasses=ui.ranking==='classes';
    $('#gaRankingTitle',section).textContent=isClasses?'Top Classes':'Top Students';
    $('#gaRankingSubtitle',section).textContent=isClasses
      ? 'Participation and usage by class'
      : ui.rankingStatus==='inactive'?'Students without recorded activity in this period':'Most active students in this period';
    section.querySelectorAll('[data-ga-ranking]').forEach(btn=>btn.classList.toggle('active',btn.dataset.gaRanking===ui.ranking));
    const extras=$('#gaRankingExtras',section);
    extras.innerHTML=isClasses?'':'<div class="ga-pills" style="margin:-3px 0 14px">'+
      '<button type="button" class="ga-pill '+(ui.rankingStatus==='active'?'active':'')+'" data-ga-students="active">Top users</button>'+
      '<button type="button" class="ga-pill '+(ui.rankingStatus==='inactive'?'active':'')+'" data-ga-students="inactive">Not active</button></div>';
    const rows=isClasses?data.classes:(ui.rankingStatus==='inactive'?data.inactive:data.students);
    const max=Math.max(1,...(rows||[]).map(r=>Number(r.sessions||0)));
    $('#gaRanking',section).innerHTML=(rows?.length?rows.map((r,i)=>{
      const value=Number(r.sessions||0), fill=isClasses?Math.max(3,Number(r.participation||0)):value/max*100;
      const detail=isClasses
        ? format(r.activeStudents)+' / '+format(r.students)+' active · '+pct(r.participation)+'%'
        : ui.rankingStatus==='inactive'?r.className
        : escape(r.className)+' · '+format(r.days)+' days · '+format(r.apps)+' apps';
      return '<div class="ga-rank"><span class="ga-rank-num">'+(i+1)+'</span>'+
        '<div class="ga-rank-name" title="'+escape(r.name)+'">'+escape(r.name)+
        '<small>'+detail+'</small></div><div class="ga-rank-bar-wrap">'+
        '<div class="ga-rank-value">'+(ui.rankingStatus==='inactive'&&!isClasses?'No sessions':format(value)+' sessions')+'</div>'+
        '<div class="ga-track"><div class="ga-fill" style="width:'+Math.min(100,fill).toFixed(1)+'%"></div></div></div></div>';
    }).join(''):'<div class="ga-empty">No students found for this filter.</div>');
  }
  function breakdown(data) {
    const rows=Array.isArray(data.apps)?data.apps:[];
    const total=rows.reduce((sum,r)=>sum+Number(r.sessions||0),0);
    const donut=$('#gaDonut',section);
    let offset=0;
    const segments=rows.filter(r=>r.sessions>0).map(r=>{
      const amount=Number(r.sessions||0)/Math.max(total,1)*100;
      const start=offset; offset+=amount;
      return (APP[r.app]?.color||'#aab')+' '+start.toFixed(2)+'% '+offset.toFixed(2)+'%';
    });
    donut.innerHTML='<div class="ga-donut" style="background:'+
      (segments.length?'conic-gradient('+segments.join(',')+')':'#e9f0f1')+
      '"><div class="ga-donut-center">'+format(total)+'<small>sessions</small></div></div>';
    const allRows=Object.keys(APP).map(k=>rows.find(r=>r.app===k)||{app:k,sessions:0,students:0});
    $('#gaAppList',section).innerHTML=allRows.map(r=>
      '<button type="button" class="ga-app-row '+(ui.app===r.app?'active':'')+'" data-ga-app="'+escape(r.app)+'">'+
      '<span class="ga-app-dot" style="background:'+(APP[r.app]?.color||'#aab')+'"></span>'+
      '<span class="ga-app-name">'+escape(label(r.app))+'</span>'+
      '<span class="ga-app-count">'+format(r.sessions)+' · '+(total?pct(100*r.sessions/total):0)+'%</span>'+
      '<small>'+format(r.students)+' students</small></button>').join('');
  }
  function recent(data) {
    const rows=data.recent||[];
    $('#gaRecent',section).innerHTML=rows.length?rows.map(r=>{
      const app=APP[r.app]||{short:'?',color:'#8da1a5'};
      const date=new Date(r.at);
      const when=isNaN(date.getTime())?'':date.toLocaleString('en-GB',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      return '<div class="ga-feed-item"><span class="ga-tag" style="background:'+app.color+'">'+
        escape(app.short)+'</span><span class="ga-feed-name">'+escape(r.name)+
        '<small>'+escape(r.className)+' · '+escape(label(r.app))+'</small></span>'+
        '<time class="ga-feed-time" datetime="'+escape(r.at)+'">'+escape(when)+'</time></div>';
    }).join(''):'<div class="ga-empty">No sessions recorded.</div>';
  }
  function populateClasses() {
    const select=$('#gaClass',section);
    const options=ui.classOptions;
    select.innerHTML='<option value="">All classes</option>'+options.map(c=>
      '<option value="'+escape(c)+'">'+escape(c)+'</option>').join('');
    select.value=ui.className;
  }
  function render() {
    if (!ui.data) return;
    kpis(ui.data);drawChart(ui.data);ranking(ui.data);breakdown(ui.data);recent(ui.data);
    $('#gaMessage',section).hidden=true;
    $('#gaContent',section).hidden=false;
  }
  // Teacher auth cookies are HttpOnly; obtain a short-lived JWT through the
  // existing refresh endpoint, or reuse the valid token cached by WillenaAPI.
  function validToken(token) {
    if(typeof token!=='string'||token.split('.').length!==3)return false;
    try {
      const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      return Number(claims.exp)*1000>Date.now()+30000;
    } catch { return false; }
  }
  async function teacherToken() {
    let token=window.WillenaAPI?.getLocalAccessToken?.()||'';
    if(validToken(token))return token;
    const path='/.netlify/functions/supabase_auth?action=refresh';
    const request=window.WillenaAPI?.fetch
      ? window.WillenaAPI.fetch.bind(window.WillenaAPI)
      : (url,options)=>fetch(url,options);
    const response=await request(path,{credentials:'include',cache:'no-store'});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!validToken(body.access_token))return null;
    window.WillenaAPI?.setLocalTokens?.(body.access_token,body.refresh_token||'');
    return body.access_token;
  }
  let pending=null;
  async function load() {
    const id=++ui.current;
    pending?.abort();
    const controller=new AbortController();
    pending=controller;
    const message=$('#gaMessage',section);
    message.className='ga-loading';message.textContent='Loading usage analytics…';message.hidden=false;
    if (!ui.data) $('#gaContent',section).hidden=true;
    const params=new URLSearchParams({
      days:ui.period==='custom'?'30':ui.period,
      ...(ui.className?{class:ui.className}:{}),
      ...(ui.app?{app:ui.app}:{})
    });
    if (ui.period==='custom') {
      params.set('start',$('#gaStart',section).value);
      params.set('end',$('#gaEnd',section).value);
    }
    const endpoint='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/genius-usage-analytics';
    try {
      const token=await teacherToken();
      if(!token)throw new Error('Teacher session not ready. Sign in again or refresh the page.');
      const body=Object.fromEntries(params.entries());
      const response=await fetch(endpoint,{
        method:'POST',credentials:'omit',cache:'no-store',signal:controller.signal,
        headers:{
          'Content-Type':'application/json',
          'apikey':'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e',
          'Authorization':'Bearer '+token
        },
        body:JSON.stringify(body)
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.success===false)throw new Error(result.error||'Analytics request failed ('+response.status+')');
      if(id!==ui.current)return;
      ui.data=result;
      if(!ui.className&&!ui.app) {
        ui.classOptions=(result.classes||[]).map(c=>c.name).filter(name=>name&&name!=='Unassigned').sort((a,b)=>a.localeCompare(b));
      }
      if(!ui.classOptions.length && result.classes)ui.classOptions=result.classes.map(c=>c.name).filter(Boolean).sort();
      populateClasses();
      render();
    }catch(err) {
      if(controller.signal.aborted||id!==ui.current)return;
      message.hidden=false;message.className='ga-error';message.textContent='Usage analytics unavailable: '+err.message;
      if(!ui.data)$('#gaContent',section).hidden=true;
    }finally{
      if(id===ui.current) pending=null;
    }
  }
  $('#gaPeriod',section).addEventListener('change',event=>{
    ui.period=event.target.value;
    $('#gaCustom',section).hidden=ui.period!=='custom';
    if(ui.period!=='custom')load();
  });
  $('#gaClass',section).addEventListener('change',event=>{ui.className=event.target.value;load();});
  $('#gaApp',section).addEventListener('change',event=>{ui.app=event.target.value;load();});
  $('#gaRefresh',section).addEventListener('click',load);
  $('#gaApply',section).addEventListener('click',()=>{
    const start=$('#gaStart',section).value,end=$('#gaEnd',section).value;
    const days=(new Date(end)-new Date(start))/86400000;
    if(!start||!end||!Number.isFinite(days)||days<0||days>89){alert('Choose a range of 1–90 days.');return;}
    load();
  });
  section.addEventListener('click',event=>{
    const trend=event.target.closest('[data-ga-trend]');
    if(trend){ui.trend=trend.dataset.gaTrend;if(ui.data)drawChart(ui.data);return;}
    const rank=event.target.closest('[data-ga-ranking]');
    if(rank){ui.ranking=rank.dataset.gaRanking;if(ui.data)ranking(ui.data);return;}
    const studentMode=event.target.closest('[data-ga-students]');
    if(studentMode){ui.rankingStatus=studentMode.dataset.gaStudents;if(ui.data)ranking(ui.data);return;}
    const app=event.target.closest('[data-ga-app]');
    if(app){ui.app=ui.app===app.dataset.gaApp?'':app.dataset.gaApp;$('#gaApp',section).value=ui.app;load();}
  });
  const today = new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
  const t=new Date(today+'T00:00:00Z');
  $('#gaEnd',section).value=today;
  $('#gaStart',section).value=new Date(t.getTime()-29*86400000).toISOString().slice(0,10);
  const previouslySelected=(()=>{try{return localStorage.getItem('willena.teachers.activeView.v1')}catch{return''}})();
  if(['genius-apps','vocab','sentence-genius','grammar-foundations','free-talking-genius'].includes(previouslySelected)){
    try{localStorage.setItem('willena.teachers.activeView.v1','genius-usage')}catch{}
  }
  if(section.classList.contains('active'))load();
  window.WillenaGeniusUsage={open:changeView,refresh:load};
})();
