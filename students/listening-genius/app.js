import {studentIdentity,assignedBooks} from '/students/sentence-genius/content.js?v=sg-no-approval-v4.1';
const status=document.getElementById('status'),books=document.getElementById('books'),notice=document.getElementById('browserNotice');
const ua=navigator.userAgent||'';
const android=/Android/i.test(ua);
const ios=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const naver=/NAVER|NaverApp|Naver\//i.test(ua);
const chrome=/Chrome|CriOS|Chromium/i.test(ua)&&!naver;
const safari=ios&&/Safari/i.test(ua)&&!/CriOS|FxiOS|EdgiOS|OPiOS|NAVER|NaverApp|Naver\//i.test(ua);
function intentUrl(address){
 const url=new URL(address);
 return 'intent://'+url.host+url.pathname+url.search+'#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';
}
if(android&&naver){notice.hidden=false;notice.textContent='네이버 브라우저에서는 Oxford 사이트가 차단될 수 있습니다. Chrome에서 열기를 사용하세요.';}
else if(android&&!chrome){notice.hidden=false;notice.textContent='Oxford 사이트가 열리지 않으면 Chrome에서 열거나 링크를 복사하세요.';}
else if(ios&&!safari){notice.hidden=false;notice.textContent='Oxford 사이트는 Safari에서 열어주세요. 링크 복사 후 Safari에 붙여넣을 수 있습니다.';}

function oxford(book){
 const title=String(book.title||'').toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
 let match=title.match(/\b(?:oxford\s+)?buzz\s*(starter|[1-6])\b/i);
 if(match){const level=match[1].toLowerCase();return {label:'Buzz '+(level==='starter'?'Starter':level),url:'https://elt.oup.com/student/buzz/'+(level==='starter'?'':'level'+level.padStart(2,'0')+'/'+(level==='6'?'audio':''))+'?cc=kr&selLanguage=ko'};}
 match=title.match(/\b(?:everybody\s*up|eu)\s*(starter|[1-6])\b/i);
 if(match){const level=match[1].toLowerCase();return {label:'Everybody Up '+(level==='starter'?'Starter':level),url:'https://elt.oup.com/student/everybodyup/'+(level==='starter'?'':'level'+level+'/')+'?cc=kr&selLanguage=ko'};}
 return null;
}
function addChromeAndCopy(container,url,label){
 if(android&&!chrome){
  const open=document.createElement('a');open.className='chrome-link';open.href=intentUrl(url);open.textContent='Chrome에서 열기';
  open.setAttribute('aria-label',label+' Chrome에서 열기');container.append(open);
 }
 if((android&&!chrome)||(ios&&!safari)){
  const copy=document.createElement('button');copy.className='copy-link';copy.type='button';copy.textContent='링크 복사';
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(url);copy.textContent='복사됨';}catch{copy.textContent='복사할 수 없습니다';}};
  container.append(copy);
 }
}
async function run(){
 try{
  const identity=await studentIdentity();
  if(!identity.className)throw Error('학급 정보를 찾을 수 없습니다. 선생님께 문의하세요.');
  const assigned=await assignedBooks(identity.className);
  const options=assigned.map(oxford).filter(Boolean);
  if(!options.length){status.textContent='현재 학급에 연결된 Buzz 또는 Everybody Up 교재가 없습니다.';return;}
  status.hidden=true;
  for(const entry of options){
   const card=document.createElement('div');card.className='book-card';
   const link=document.createElement('a');link.className='book';link.href=entry.url;link.referrerPolicy='no-referrer';link.rel='noreferrer';link.textContent=entry.label;card.append(link);
   addChromeAndCopy(card,entry.url,entry.label);
   books.append(card);
  }
 }catch(error){status.classList.add('error');status.textContent=error.message||'교재를 불러오지 못했습니다. 다시 로그인해 주세요.';}
}
run();
