import {send} from '../public.js';
const key = window.location.hash.slice(1);
const status = document.querySelector('#status'), apply = document.querySelector('#apply'), retry = document.querySelector('#retry');
const details = document.querySelector('#details');
async function show(action) {
  apply.hidden = true; retry.hidden = true;
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(key)) {
    status.textContent = '학원에서 개별 안내드린 초대 링크로 접속해 주세요.'; return;
  }
  status.textContent = action === 'apply' ? '신청을 접수하고 있습니다.' : '초대 링크를 확인하고 있습니다.';
  try {
    const {state} = await send(action,{key});
    const booked = state === 'booked';
    details.hidden = false;
    status.textContent = booked ? '설명회 신청이 완료되었습니다. 설명회에서 뵙겠습니다.' : '대기 연장이 확정된 가정을 초대합니다. 참석을 희망하시면 아래 버튼을 눌러 주세요.';
    apply.hidden = booked;
  } catch (e) {
    status.textContent = e instanceof TypeError ? '연결 상태를 확인한 후 다시 시도해 주세요.' : e.message;
    retry.hidden = false;
  }
}
apply.addEventListener('click',() => show('apply'));
retry.addEventListener('click',() => show('invitation'));
show('invitation');
