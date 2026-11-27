(() => {
  if(new URLSearchParams(location.search).get('admission')==='complete') return;
  const dialog=document.createElement('dialog');
  dialog.id='march-invitation';
  dialog.setAttribute('aria-labelledby','march-title');
  dialog.innerHTML=`<div class="march-envelope"><div class="march-card">
  <button type="button" class="march-close" aria-label="팝업 닫기">×</button>
  <div class="march-kicker">WILLENA · 2027 ADMISSION</div>
  <h2 id="march-title" tabindex="-1" autofocus>2027년 3월<br>신규반 입학 신청 안내</h2>
  <p>오랜 시간 윌레나를 기다려 주셔서 진심으로 감사드립니다.</p>
  <p>2027년 3월 신규반 입학을 희망하시는 기존 대기 가정에서는 아래 버튼을 통해 입학 신청을 해주시기 바랍니다.</p>
  <p class="march-deadline"><span>신청 기한</span> 12월 2일(수)까지</p>
  <a class="march-apply" href="/admissions/march-2027/">2027년 3월 신입생반 입학 신청 <span aria-hidden="true">›</span></a>
  <p class="march-note">입학 신청 후 오리엔테이션에 대한 안내를 드릴 예정입니다.</p>
  <p class="march-waitlist-note">이번 입학 신청은 윌레나에 기존 대기 중인 학생을 대상으로 진행됩니다. 신규 입학을 희망하시는 가정은 학원으로 문의해 주시면 정성껏 안내해 드리겠습니다.</p>
  </div><div class="march-fold" aria-hidden="true"></div><div class="march-seal" aria-hidden="true">W</div></div>`;
  document.body.append(dialog);
  dialog.querySelector('.march-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  dialog.showModal();
})();