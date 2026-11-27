import {send} from '../public.js';
const form = document.querySelector('#application');
const submit = document.querySelector('#submit'), error = document.querySelector('#error');
let pending = false;

function finish(title,text) {
  document.querySelector('#entry').hidden = true;
  document.querySelector('#result').hidden = false;
  const heading = document.querySelector('#result-title');
  heading.textContent = title;
  document.querySelector('#result-text').textContent = text;
  heading.focus();
}
submit.disabled = false;
form.addEventListener('submit',async event => {
  event.preventDefault();
  if (pending) return;
  const data = Object.fromEntries(new FormData(form));
  if (!/^0\d{8,10}$/.test(data.phone.replace(/[\s()-]/g,''))) {
    error.textContent = '보호자 연락처를 확인해 주세요. 예) 010-1234-5678'; form.elements.phone.focus(); return;
  }
  pending = true; submit.disabled = true; submit.textContent = '보내는 중…'; error.textContent = '';
  try {
    await send('march',{...data,consent:form.elements.consent.checked});
    form.reset();
    finish('2027년도 3월 신규반 입학신청이 완료되었습니다.','신규반 입학신청이 완료되면 3월 신규반 오리엔테이션 안내가 있을 예정입니다. 감사합니다.');
  } catch (e) {
    error.textContent = e instanceof TypeError ? '연결 상태를 확인한 후 다시 보내 주세요. 작성한 내용은 이 화면에 남아 있습니다.' : e.message;
  } finally {
    pending = false; submit.disabled = false; submit.textContent = '신청하기';
  }
});
