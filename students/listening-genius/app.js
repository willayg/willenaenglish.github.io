import {studentIdentity,assignedBooks} from '/students/sentence-genius/content.js?v=sg-no-approval-v4.1';
const $=id=>document.getElementById(id),status=$('status'),books=$('books'),units=$('units'),panel=$('unitPanel'),bookTitle=$('bookTitle');
function oxford(book){
 const title=String(book.title||'').toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
 let match=title.match(/\b(?:oxford\s+)?buzz\s*(starter|[1-6])\b/i);
 if(match){const level=match[1].toLowerCase();return {label:'Buzz '+(level==='starter'?'Starter':level),url:'https://elt.oup.com/student/buzz/'+(level==='starter'?'':'level'+level.padStart(2,'0')+'/')+'?cc=kr&selLanguage=ko',units:8};}
 match=title.match(/\b(?:everybody\s*up|eu)\s*(starter|[1-6])\b/i);
 if(match){const level=match[1].toLowerCase();return {label:'Everybody Up '+(level==='starter'?'Starter':level),url:'https://elt.oup.com/student/everybodyup/'+(level==='starter'?'':'level'+level+'/')+'?cc=kr&selLanguage=ko',units:8};}
 return null;
}
function choose(book,info,button){
 [...books.children].forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 panel.classList.remove('hide');bookTitle.textContent=info.label;units.replaceChildren();
 for(let n=1;n<=info.units;n++){
  const b=document.createElement('button');b.className='unit';b.type='button';b.innerHTML='Unit '+n+'<small>Oxford ↗</small>';b.addEventListener('click',()=>{
   // Oxford does not expose verifiable unit-specific links publicly.
   // Navigate to the exact assigned level; do not invent an anchor or audio URL.
   window.open(info.url,'_blank','noopener,noreferrer');
  });units.append(b);
 }
}
async function run(){
 try{
  const identity=await studentIdentity();
  if(!identity.className)throw Error('학급 정보를 찾을 수 없습니다. 선생님께 문의하세요.');
  const assigned=await assignedBooks(identity.className);
  const options=assigned.map(book=>({book,info:oxford(book)})).filter(x=>x.info);
  if(!options.length){status.textContent='현재 학급에 연결된 Buzz 또는 Everybody Up 교재가 없습니다.';return;}
  status.hidden=true;
  for(const entry of options){const b=document.createElement('button');b.type='button';b.className='book';b.setAttribute('aria-pressed','false');b.textContent=entry.info.label;b.onclick=()=>choose(entry.book,entry.info,b);books.append(b);}
  if(options.length===1)books.firstChild.click();
 }catch(e){status.classList.add('error');status.textContent=e.message||'교재를 불러오지 못했습니다. 다시 로그인해 주세요.';}
}
run();