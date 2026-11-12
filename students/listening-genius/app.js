import {studentIdentity,assignedBooks} from '/students/sentence-genius/content.js?v=sg-no-approval-v4.1';
const status=document.getElementById('status'),books=document.getElementById('books');
function oxford(book){
 const title=String(book.title||'').toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
 let match=title.match(/\b(?:oxford\s+)?buzz\s*(starter|[1-6])\b/i);
 if(match){const level=match[1].toLowerCase();return {label:'Buzz '+(level==='starter'?'Starter':level),url:'https://elt.oup.com/student/buzz/'+(level==='starter'?'':'level'+level.padStart(2,'0')+'/')+'?cc=kr&selLanguage=ko'};}
 match=title.match(/\b(?:everybody\s*up|eu)\s*(starter|[1-6])\b/i);
 if(match){const level=match[1].toLowerCase();return {label:'Everybody Up '+(level==='starter'?'Starter':level),url:'https://elt.oup.com/student/everybodyup/'+(level==='starter'?'':'level'+level+'/')+'?cc=kr&selLanguage=ko'};}
 return null;
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
   const link=document.createElement('a');link.className='book';link.href=entry.url;link.textContent=entry.label;
   // A normal same-tab hyperlink follows the verified Oxford book landing page.
   // Don't synthesize unverified audio or unit deep links.
   books.append(link);
  }
 }catch(error){status.classList.add('error');status.textContent=error.message||'교재를 불러오지 못했습니다. 다시 로그인해 주세요.';}
}
run();
