import {contentDbGet} from '/students/shared/content-db.js?v=1.0.0';
const host=document.getElementById('questions'),status=document.getElementById('status');
const models=[['eleven_v3','Eleven v3'],['eleven_multilingual_v2','Multilingual v2']];
const cache=new Map();
async function token(refresh=false){
 const existing=window.WillenaAPI?.getLocalAccessToken?.();
 if(existing&&!refresh)return existing;
 const fn=window.WillenaAPI?.fetch?window.WillenaAPI.fetch.bind(window.WillenaAPI):fetch;
 const r=await fn('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{credentials:'include',cache:'no-store'});
 const d=await r.json().catch(()=>null);
 if(!r.ok||!d?.access_token)throw Error('Student sign-in required');
 window.WillenaAPI?.setLocalTokens?.(d.access_token,d.refresh_token||'');
 return d.access_token;
}
async function audioFor(questionId,model){
 const key=questionId+'|'+model;if(cache.has(key))return cache.get(key);
 async function call(access){return fetch('/api/free-talking-audio',{method:'POST',credentials:'include',cache:'no-store',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},
  body:JSON.stringify({question_id:questionId,voice:'bunny',compare_model:model})})}
 let r=await call(await token());
 if(r.status===401)r=await call(await token(true));
 const d=await r.json().catch(()=>null);
 if(!r.ok||!d?.success)throw Error(d?.error||'Audio generation failed ('+r.status+')');
 if(d.model!==model||d.voice!=='bunny')throw Error('Backend returned a different voice or model');
 let url=d.audio_url;
 if(!url){
  if(!d.audio)throw Error('No audio returned');
  const binary=atob(d.audio),buf=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)buf[i]=binary.charCodeAt(i);
  url=URL.createObjectURL(new Blob([buf],{type:'audio/mpeg'}));
 }
 const result={url,source:d.source||'generated',model:d.model};cache.set(key,result);return result;
}
function addQuestion(q,i){
 const card=document.createElement('section');card.className='card';
 const title=document.createElement('h2');title.textContent='Question '+(i+1);
 const prompt=document.createElement('p');prompt.textContent=q.question_en;card.append(title,prompt);
 const pair=document.createElement('div');pair.className='pair';
 for(const [id,label] of models){
  const area=document.createElement('div'),name=document.createElement('div'),btn=document.createElement('button'),msg=document.createElement('div'),player=document.createElement('audio');
  name.className='model';name.textContent=label+' · '+id;
  btn.textContent='Generate & listen';msg.className='state';msg.setAttribute('role','status');
  player.controls=true;player.hidden=true;player.preload='none';
  btn.addEventListener('click',async()=>{
   btn.disabled=true;msg.textContent='Preparing '+label+'…';
   try{const file=await audioFor(q.id,id);player.src=file.url;player.hidden=false;
    msg.textContent=file.source.startsWith('r2')?'Loaded from R2':'Generated / saved if R2 is available';
    await player.play().catch(()=>{msg.textContent='Ready — press Play below';});
    btn.textContent='Play again';
   }catch(e){msg.textContent=e.message||'Could not generate audio';}
   finally{btn.disabled=false;}
  });
  area.append(name,btn,msg,player);pair.append(area);
 }
 card.append(pair);host.append(card);
}
async function init(){
 try{
  const rows=await contentDbGet('/rest/v1/free_talking_questions?select=id,question_en,question_number,unit_number,book_id&is_published=eq.true&order=unit_number.asc,question_number.asc&limit=100');
  const samples=[];const used=new Set();
  for(const q of rows){
   if(!q.id||!q.question_en||used.has(q.question_en))continue;
   used.add(q.question_en);samples.push(q);
   if(samples.length===3)break;
  }
  if(!samples.length)throw Error('No published Free Talking questions were found');
  samples.forEach(addQuestion);
  status.textContent='Three real questions ready. Choose either model to generate audio.';
 }catch(e){status.textContent=e.message||'Could not load comparison questions';}
}
init();
