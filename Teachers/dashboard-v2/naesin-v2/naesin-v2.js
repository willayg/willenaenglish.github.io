(function(){
'use strict';

const VIEW='naesin-v2';
const ICON='./naesin-v2/naesin-v2-icon.svg';

function q(s,r=document){return r.querySelector(s)}
function qa(s,r=document){return [...r.querySelectorAll(s)]}

function show(){
  qa('.workspace>.view').forEach(v=>v.classList.toggle('active',v.id===`view-${VIEW}`));
  qa('.nav,.mobile-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===VIEW));
}

function mountDesktopNav(){
  const rail=q('.rail');
  if(!rail||rail.querySelector(`[data-view="${VIEW}"]`))return;
  const spacer=q('.rail-spacer',rail);
  const btn=document.createElement('button');
  btn.className='nav';
  btn.dataset.view=VIEW;
  btn.innerHTML=`<span class="nav-icon na2-nav-icon"><img src="${ICON}" alt=""></span><span>내신 V2</span>`;
  btn.addEventListener('click',show);
  rail.insertBefore(btn,spacer||null);
}

function mountMobileNav(){
  const tabs=q('.mobile-tabs');
  if(!tabs||tabs.querySelector(`[data-view="${VIEW}"]`))return;
  const btn=document.createElement('button');
  btn.className='mobile-tab';
  btn.dataset.view=VIEW;
  btn.innerHTML=`<img class="na2-mobile-icon" src="${ICON}" alt="">내신 V2`;
  btn.addEventListener('click',show);
  const apps=q('[data-view="apps"]',tabs);
  tabs.insertBefore(btn,apps||null);
}

function mountView(){
  const ws=q('.workspace');
  if(!ws||q(`#view-${VIEW}`))return;
  const sec=document.createElement('section');
  sec.className='view na2-view';
  sec.id=`view-${VIEW}`;
  sec.innerHTML=`
    <div class="na2-shell">
      <div class="na2-head">
        <div>
          <h1>내신 V2</h1>
          <p>새 내신 모듈 — 기존 내신과 완전히 분리된 병렬 빌드</p>
        </div>
        <button class="na2-add" id="na2Add" type="button">+ 시험 대비 추가</button>
      </div>

      <div class="na2-grid">
        <div class="na2-card">
          <div class="na2-badge">SKELETON</div>
          <h3>시험 목록</h3>
          <p>다음 단계에서 실제 그룹 API를 연결하고 V19 UX 가이드의 시험 매트릭스를 이 영역에 구현합니다.</p>
        </div>
        <div class="na2-card">
          <div class="na2-badge">ISOLATED</div>
          <h3>학생 상세</h3>
          <p>고정 크기 학생 모달과 요약 · 오답 · 활동 · 레슨 진도 · 문법 패턴 탭이 이 모듈 안에서만 동작합니다.</p>
        </div>
        <div class="na2-card">
          <div class="na2-badge">SAFE</div>
          <h3>기존 내신 유지</h3>
          <p>기존 naesin.js와 패치 파일에는 의존하지 않으며 지금 단계에서는 기존 내신을 변경하지 않습니다.</p>
        </div>
      </div>

      <div class="na2-placeholder">
        <div>
          <strong>Naesin V2 mount is live.</strong>
          <span>여기가 V2의 독립 렌더 루트입니다. 다음부터 UX_UI_GUIDE.html을 기준으로 실제 기능을 하나씩 연결합니다.</span>
        </div>
      </div>
    </div>`;
  ws.appendChild(sec);

  q('#na2Add',sec)?.addEventListener('click',()=>{
    window.alert('Naesin V2 editor skeleton — next build step.');
  });
}

function mount(){
  mountDesktopNav();
  mountMobileNav();
  mountView();
  window.NaesinV2={show,mount,version:'skeleton-1'};
  console.info('[Naesin V2] isolated skeleton mounted');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})();
