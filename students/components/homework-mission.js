const MISSION_SESSION_KEY = 'missionModalShownV3';

function apiFetch(url, options) {
  if (window.WillenaAPI && typeof window.WillenaAPI.fetch === 'function') {
    return window.WillenaAPI.fetch(url, options);
  }
  return fetch(url, { credentials: 'include', ...(options || {}) });
}

// Sentence Genius assignments live in the authenticated operational homework
// table, not the older wordlist homework API. Read only this student's rows.
async function sentenceGeniusMissions() {
  const key='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
  const endpoint='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/sg_homework_student_v2';
  const getToken=async refresh=>{
    const current=window.WillenaAPI?.getLocalAccessToken?.();
    if(current&&!refresh)return current;
    const response=await apiFetch('/.netlify/functions/supabase_auth?action=refresh',{cache:'no-store'});
    if(!response.ok)throw Error('Student session expired');
    const body=await response.json().catch(()=>({}));
    if(!body.access_token)throw Error('No student access token');
    window.WillenaAPI?.setLocalTokens?.(body.access_token,body.refresh_token||'');
    return body.access_token;
  };
  const query=token=>fetch(endpoint,{
    method:'POST',cache:'no-store',credentials:'omit',
    headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:'{}'
  });
  let response=await query(await getToken(false));
  if(response.status===401)response=await query(await getToken(true));
  if(!response.ok)throw Error('Sentence Genius homework unavailable: '+response.status);
  const data=await response.json().catch(()=>({}));
  if(data.success!==true||!Array.isArray(data.assignments))return [];
  return data.assignments.map(row=>({
    ...row,source_type:'sentence_genius',
    list_meta:{source_book_id:row.book_id,source_unit_id:row.unit_id}
  }));
}

function sourceType(assignment) {
  return String(assignment?.source_type || assignment?.list_meta?.source_type || assignment?.list_meta?.app || '').trim().toLowerCase() || 'wordlist';
}

function destinationFor(assignment) {
  const source = sourceType(assignment);
  if (source === 'sentence_genius') {
    const meta=assignment?.list_meta||{};
    const book=meta.source_book_id||'';
    const unit=meta.source_unit_id||'';
    const q=new URLSearchParams();
    if(book)q.set('book',book);
    if(unit)q.set('unit',unit);
    return {
      app: 'Sentence Genius',
      href: '/students/sentence-genius/'+(q.toString()?'?'+q.toString():''),
      buttonLabel: 'Sentence Genius에서 숙제 시작하기'
    };
  }
  if (source === 'vocab_study') {
    return {
      app: 'Word Genius',
      href: '/students/vocab-study/?open=wordtest',
      buttonLabel: 'Word Genius에서 숙제 시작하기'
    };
  }
  if (['wordlist', 'english_arcade', 'arcade', 'saved_game', 'grammar', 'phonics'].includes(source)) {
    return {
      app: 'English Arcade',
      href: '/Games/english_arcade/index.html?openHomework=1',
      buttonLabel: 'English Arcade에서 숙제 시작하기'
    };
  }
  return null;
}

function modalIsActuallyVisible(node) {
  if (!node) return false;
  if (node.closest('[aria-hidden="true"]')) return false;
  const style = getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

function hasVisibleModal() {
  return [...document.querySelectorAll('[aria-modal="true"], .modal[role="dialog"]')]
    .some((node) => node.id !== 'missionModalGlobal' && modalIsActuallyVisible(node));
}

function shouldSuppressForActivity() {
  try {
    const path = location.pathname;

    // Sentence Genius displays its own assignment cards; never interrupt exercises.
    if (/\/students\/sentence-genius\//i.test(path)) return true;

    if (/\/students\/vocab-study\//i.test(path) && document.body?.classList?.contains('vocab-session-open')) {
      return true;
    }

    if (!/\/Games\/english_arcade\//i.test(path)) return false;

    const params = new URLSearchParams(location.search);
    if (params.get('openHomework') === '1') return false;
    if (params.get('autostart') === '1') return false;

    if (window.WordArcade) {
      try {
        if (typeof window.WordArcade.isInGame === 'function' && window.WordArcade.isInGame()) return true;
        if (window.WordArcade.isPlaying === true) return true;
      } catch {}
    }

    const opening = document.getElementById('openingButtons');
    const gameArea = document.getElementById('gameArea');
    const openingHidden = opening ? getComputedStyle(opening).display === 'none' : false;
    const gameBusy = gameArea ? gameArea.childElementCount > 0 : false;
    return openingHidden && gameBusy;
  } catch {
    return false;
  }
}

async function currentStudentId() {
  try {
    const response = await apiFetch('/.netlify/functions/supabase_auth?action=whoami&_=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    return data?.success ? (data.user_id || data.id || null) : null;
  } catch {
    return null;
  }
}

async function assignmentIsComplete(assignment, uid) {
  if(sourceType(assignment)==='sentence_genius'){
    const total=Number(assignment.total)||0;
    return total>0&&Number(assignment.done)>=total;
  }
  try {
    const response = await apiFetch(
      '/.netlify/functions/homework_api?action=assignment_progress&assignment_id=' +
      encodeURIComponent(assignment.id) + '&_=' + Date.now(),
      { cache: 'no-store' }
    );

    // Preserve the old mission behavior: if progress cannot be resolved,
    // an active assignment should still surface as homework rather than disappear.
    if (!response.ok) return false;

    const data = await response.json().catch(() => ({}));
    if (!data?.success || !Array.isArray(data.progress)) return false;

    let row = uid ? data.progress.find((item) => String(item.user_id) === String(uid)) : null;
    if (!row && data.progress.length === 1) row = data.progress[0];
    if (!row) return false;

    let completion = 0;
    if (typeof row.completion === 'number') completion = row.completion;
    else if (typeof row.completion_pct === 'number') completion = row.completion_pct;
    else if (typeof row.modes_attempted === 'number' && typeof row.modes_total === 'number' && row.modes_total > 0) {
      completion = Math.round((row.modes_attempted / row.modes_total) * 100);
    }

    if (data.stars_required && typeof row.stars === 'number') {
      completion = Math.round((row.stars / data.stars_required) * 100);
    }

    return Math.max(0, Math.min(100, completion)) >= 100;
  } catch {
    return false;
  }
}

function renderMission(assignment, destination) {
  if (document.getElementById('missionModalGlobal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'missionModalGlobal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(3px);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:26px;';

  const panel = document.createElement('div');
  panel.style.cssText = 'background:#fff;border-radius:24px;max-width:520px;width:100%;padding:36px 32px 28px;border:2px solid #93cbcf;box-shadow:0 16px 60px rgba(0,0,0,.18);text-align:center;font-family:"Poppins",system-ui,Arial,sans-serif;';
  panel.innerHTML = `
    <h2 style="margin:0 0 12px;font-size:2.2rem;font-weight:800;color:#ff6fa9;letter-spacing:.4px;">You Have A Mission</h2>
    <img src="/Games/english_arcade/assets/Images/icons/rocket.svg" alt="rocket" style="width:72px;height:72px;margin:0 auto 14px;display:block;">
    <div id="missionAssignmentLabel" style="margin:0 auto 14px;max-width:390px;color:#475569;font-weight:700;line-height:1.35;"></div>
    <div style="display:flex;gap:18px;align-items:center;justify-content:center;margin-top:12px;flex-wrap:wrap;">
      <a id="missionDoNowBtn" href="#" style="display:inline-block;font-size:1.05rem;font-weight:800;color:#555;background:#fff;border:2px solid #ff6fa9;padding:14px 26px;border-radius:16px;text-decoration:none;min-width:260px;box-shadow:0 6px 16px rgba(255,111,169,.12);"></a>
      <button id="missionDismissBtn" type="button" style="background:#fff;border:2px solid #e2e8f0;color:#334155;font-weight:700;padding:10px 16px;border-radius:12px;cursor:pointer;margin-top:18px;">Not Now</button>
    </div>
  `;

  panel.querySelector('#missionAssignmentLabel').textContent =
    destination.app + ' · ' + (assignment.title || assignment.list_title || 'Homework');
  panel.querySelector('#missionDoNowBtn').textContent = destination.buttonLabel;

  const finish = () => {
    try { overlay.remove(); } catch {}
    try { sessionStorage.setItem(MISSION_SESSION_KEY, '1'); } catch {}
  };

  panel.querySelector('#missionDismissBtn')?.addEventListener('click', finish);
  panel.querySelector('#missionDoNowBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    try { sessionStorage.setItem(MISSION_SESSION_KEY, '1'); } catch {}
    location.href = destination.href;
  });

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

let checkInFlight = null;

export async function showHomeworkMission() {
  if (checkInFlight) return checkInFlight;

  checkInFlight = (async () => {
    try {
      if (/\/students\/(?:login|signin)\.html$/i.test(location.pathname)) return;
      if (sessionStorage.getItem(MISSION_SESSION_KEY) === '1') return;
      if (shouldSuppressForActivity()) return;

      if (hasVisibleModal()) {
        setTimeout(() => {
          if (!hasVisibleModal()) showHomeworkMission();
        }, 800);
        return;
      }

      await new Promise((resolve) => {
        try { (window.requestIdleCallback || window.requestAnimationFrame)(() => resolve()); }
        catch { setTimeout(resolve, 0); }
      });

      // Failure in one homework service must not hide assignments from the other.
      const sources=await Promise.allSettled([
        apiFetch('/.netlify/functions/homework_api?action=list_assignments&mode=student&_='+Date.now(),
          {cache:'no-store'}).then(async response=>{
          if(!response.ok)return [];
          const data=await response.json().catch(()=>({}));
          return data?.success&&Array.isArray(data.assignments)?data.assignments:[];
        }),
        sentenceGeniusMissions()
      ]);
      const legacy=sources[0].status==='fulfilled'?sources[0].value:[];
      const sentence=sources[1].status==='fulfilled'?sources[1].value:[];
      const byId=new Map();
      for(const assignment of [...legacy,...sentence]){
        if(destinationFor(assignment))byId.set(sourceType(assignment)+':'+assignment.id,assignment);
      }
      const assignments=[...byId.values()].sort((a,b)=>
        new Date(a?.due_at||0).getTime()-new Date(b?.due_at||0).getTime());
      if(!assignments.length)return;

      const uid = await currentStudentId();

      for (const assignment of assignments) {
        const destination = destinationFor(assignment);
        if (!destination) continue;
        const complete = await assignmentIsComplete(assignment, uid);
        if (!complete) {
          renderMission(assignment, destination);
          return;
        }
      }
    } catch (error) {
      console.debug('[homework-mission] check failed', error);
    } finally {
      checkInFlight = null;
    }
  })();

  return checkInFlight;
}

export function resetHomeworkMissionSession() {
  try { sessionStorage.removeItem(MISSION_SESSION_KEY); } catch {}
}

if (typeof window !== 'undefined') {
  window.WillenaHomeworkMission = { show: showHomeworkMission, reset: resetHomeworkMissionSession };
}
