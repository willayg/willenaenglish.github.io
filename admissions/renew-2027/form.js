import {send} from '../public.js';
const form = document.querySelector('#application');
const submit = document.querySelector('#submit'), error = document.querySelector('#error');
const cutoff = Date.parse('2026-11-27T00:00:00+09:00');
let pending = false;

function finish(title,text) {
  document.querySelector('#entry').hidden = true;
  document.querySelector('#result').hidden = false;
  const heading = document.querySelector('#result-title');
  heading.textContent = title;
  document.querySelector('#result-text').textContent = text;
  heading.focus();
}
function closed() {
  if (Date.now() < cutoff) return false;
  finish('신청이 마감되었습니다.','2027년 입학 문의는 학원으로 연락해 주세요.');
  return true;
}
if (!closed()) submit.disabled = false;
window.addEventListener('pageshow', () => { if (!document.querySelector('#entry').hidden) closed(); });
form.addEventListener('submit',async event => {
  event.preventDefault();
  if (pending || closed()) return;
  const data = Object.fromEntries(new FormData(form));
  if (!/^0\d{8,10}$/.test(data.phone.replace(/[\s()-]/g,''))) {
    error.textContent = '보호자 연락처를 확인해 주세요. 예) 010-1234-5678'; form.elements.phone.focus(); return;
  }
  pending = true; submit.disabled = true; submit.textContent = '보내는 중…'; error.textContent = '';
  try {
    await send('renew',{...data,consent:form.elements.consent.checked});
    form.reset();
    finish('대기 연장 신청이 접수되었습니다.','학원에서 기존 대기 정보를 확인한 뒤 개별 안내 드리겠습니다. 같은 학생을 다시 신청하신 경우 최초 접수가 유지됩니다. 수정이 필요하시면 031-8042-2203으로 연락해 주세요.');
  } catch (e) {
    error.textContent = e instanceof TypeError ? '연결 상태를 확인한 후 다시 보내 주세요. 작성한 내용은 이 화면에 남아 있습니다.' : e.message;
  } finally {
    pending = false; submit.disabled = false; submit.textContent = '작성 내용 보내기';
  }
});
