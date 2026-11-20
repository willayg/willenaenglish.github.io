(() => {
  const cutoff = Date.parse('2026-11-27T00:00:00+09:00');
  if (Date.now() >= cutoff) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'renewal-invitation';
  dialog.setAttribute('aria-labelledby','renewal-invitation-title');
  dialog.innerHTML = `<div class="inv-card">
    <img src="/admissions/renew-2027/invitation.webp" width="1050" height="1498" alt="">
    <strong class="academy-name">윌레나원어민영어학원</strong>
    <h2 class="inv-sr" id="renewal-invitation-title">2027 대기 연장 신청</h2>
    <p class="inv-sr">2026년 기존 대기 가정 중 2027년에도 대기를 희망하시는 분은 11월 26일까지 신청해 주세요.</p>
    <a class="inv-apply" href="/admissions/renew-2027/"><span class="inv-sr">대기 연장 신청하기</span></a>
    <button class="inv-close" type="button" aria-label="팝업 닫기"></button></div>`;
  document.body.append(dialog);
  dialog.querySelector('.inv-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.inv-apply').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.showModal();
  // A tab may remain open overnight, including while the device is asleep.
  const expire = () => { if (Date.now() >= cutoff && dialog.open) dialog.close(); };
  setTimeout(expire, Math.min(cutoff - Date.now(),2147483647));
  window.addEventListener('pageshow', expire);
  document.addEventListener('visibilitychange',expire);
})();
