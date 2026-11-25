// Shared, non-interrupting inbox for teacher feedback and claimable bonuses.
const API='https://fiieuiktlsivwfgyivai.supabase.co/rest/v1/rpc/';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const audioUrl='/students/shared/assets/audio/sfx/';
async function call(name,data={}){
 const getToken=()=>window.WillenaAPI?.getLocalAccessToken?.()||localStorage.getItem('sb_access_token')||'';
 const invoke=t=>fetch(API+name,{method:'POST',cache:'no-store',headers:{apikey:KEY,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(data)});
 let response=await invoke(getToken());
 if(response.status===401){
  try{const refresh=await window.WillenaAPI?.fetch?.('/.netlify/functions/supabase_auth?action=refresh');const json=await refresh?.json();if(json?.access_token)window.WillenaAPI?.setLocalTokens?.(json.access_token,json.refresh_token||'')}catch{}
  response=await invoke(getToken());
 }
 if(!response.ok)throw Error('Inbox unavailable');
 return response.json();
}
const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
function play(name){try{const a=new Audio(audioUrl+name+'.wav');a.volume=.6;void a.play().catch(()=>{})}catch{}}
export function mountStudentInbox(header){
 if(header.shadowRoot?.querySelector('.inbox-cover'))return;
 clearInterval(header._inboxTimer);header._studentInboxMounted=true;
 const menu=header.shadowRoot?.getElementById('avatarMenu');if(!menu)return;
 const button=make('button','dd-item','✉ 선생님 메시지');button.type='button';button.setAttribute('role','menuitem');
 menu.prepend(button);
 button.classList.add('inbox-prominent');
 button.innerHTML='<span aria-hidden="true" class="inbox-envelope">✉</span><strong>선생님 메시지</strong><span class="inbox-menu-count" hidden></span>';
 const avatar=header.shadowRoot.getElementById('avatarBtn');
 const badge=make('button','inbox-header-badge');badge.type='button';badge.hidden=true;badge.setAttribute('aria-label','Unread teacher messages');
 avatar?.parentElement?.append(badge);
 badge.onclick=e=>{e.preventDefault();e.stopPropagation();void refresh(true)};
 const style=make('style');style.textContent=`
 .inbox-prominent{background:#fff0f7!important;border:2px solid #efabd1!important;color:#ac3270!important;padding:13px 12px!important;align-items:center!important;font-size:1rem!important;font-weight:900!important;box-shadow:0 2px 8px #d983ac25}
 .inbox-envelope{font-size:1.35rem;line-height:1}.inbox-menu-count{margin-left:auto;background:#e9529c;color:white;border-radius:99px;padding:3px 9px;font-weight:900}.inbox-menu-count[hidden]{display:none}
 .inbox-header-badge[hidden]{display:none!important}.inbox-header-badge{position:absolute;right:-7px;top:-9px;z-index:5;display:grid;place-items:center;min-width:25px;height:25px;padding:0 5px;border-radius:50%;border:2px solid #fff;background:#e9529c;color:#fff;font:900 12px Poppins,system-ui;box-shadow:0 2px 8px #ca3b8266;cursor:pointer;animation:inbox-badge-bounce 1s ease-out 2}
 .avatar-btn.has-inbox-alert{box-shadow:0 0 0 3px #f6b6db!important}
 @keyframes inbox-badge-bounce{50%{transform:translateY(-5px) scale(1.1)}}
 .inbox-cover[hidden]{display:none}.inbox-cover{position:fixed;inset:0;z-index:100000;background:#16353bb3;display:grid;place-items:center;padding:12px;font-family:Poppins,system-ui,sans-serif}
 .inbox-panel{position:relative;background:white;width:min(520px,100%);max-height:88dvh;overflow-y:auto;border:3px solid #bfe8ed;border-radius:20px;padding:22px;box-sizing:border-box;color:#315961;box-shadow:0 22px 70px #1235}
 .inbox-panel h2{color:#dc5898;margin:2px 45px 14px 0;font-size:1.35rem}.inbox-close{position:absolute;right:12px;top:12px;background:#fff;border:1px solid #c5e6ea;border-radius:12px;font-size:22px;width:42px;height:42px}
 .inbox-item{border:1px solid #c9e5eb;border-radius:13px;padding:14px;margin:10px 0;background:#fbfefe}.inbox-item.unread{border-color:#e8a4cc;background:#fff9fc}
 .inbox-item strong{display:block;margin-bottom:7px}.inbox-item p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}
 .inbox-action{border:0;border-radius:11px;background:#39b7c4;color:white;padding:11px 14px;font:800 .9rem Poppins,system-ui;min-height:42px;cursor:pointer;margin:5px 8px 5px 0}
 .inbox-claim{background:#d69e1e}.inbox-reveal{font-size:2rem;font-weight:900;color:#d69e1e;animation:inbox-pop .7s cubic-bezier(.2,1.5,.4,1)}
 @keyframes inbox-pop{from{transform:scale(.25);opacity:0}to{transform:scale(1);opacity:1}}
 @media(prefers-reduced-motion:reduce){.inbox-reveal{animation:none}}
 `;
 header.shadowRoot.append(style);
 const cover=make('div','inbox-cover');cover.hidden=true;
 const panel=make('section','inbox-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Teacher messages');
 const close=make('button','inbox-close','×');close.type='button';close.onclick=()=>{cover.hidden=true};const title=make('h2','','선생님 메시지');const body=make('div','inbox-body');
 panel.append(close,title,body);cover.append(panel);header.shadowRoot.append(cover);
 cover.addEventListener('click',e=>{if(e.target===cover)cover.hidden=true});
 async function refresh(open=false,initial=false){
  if(open){cover.hidden=false;body.replaceChildren(make('p','','메시지를 확인하고 있어요…'))}
  try{
   const data=await call('student_inbox_v1');
   const messages=Array.isArray(data.messages)?data.messages:[];
   const pendingMessages=messages.filter(x=>!x.is_read||Number(x.bonus_points)>Number(x.claimed_points));
   const unread=pendingMessages.length;
   badge.hidden=!unread;badge.textContent=String(Math.min(unread,99));avatar?.classList.toggle('has-inbox-alert',!!unread);
   const menuCount=button.querySelector('.inbox-menu-count');if(menuCount){menuCount.hidden=!unread;menuCount.textContent=String(unread)}
   if(!open){
    if(initial&&pendingMessages.length&&document.visibilityState==='visible'){
     const unseen=pendingMessages.filter(item=>{
      const key='willena:inbox:intro:'+item.entry_id+':'+item.updated_at;
      try{return localStorage.getItem(key)!=='1'}catch{return false}
     });
     if(unseen.length){
      unseen.forEach(item=>{try{localStorage.setItem('willena:inbox:intro:'+item.entry_id+':'+item.updated_at,'1')}catch{}});
      // Show once after login or app arrival, not during subsequent background checks.
      await refresh(true);
     }
    }
    return;
   }
   body.replaceChildren();
   if(!messages.length){body.append(make('p','','새로운 메시지가 없어요.'));return}
   for(const item of messages){
    const card=make('article','inbox-item'+(!item.is_read?' unread':''));
    card.append(make('strong','',item.title||'Teacher feedback'));
    if(item.feedback_text){
     const msg=make('p','',item.feedback_text);
     if(!item.is_read){
      msg.hidden=true;
      const view=make('button','inbox-action','메시지 보기');
      view.onclick=async()=>{msg.hidden=false;view.remove();card.classList.remove('unread');await call('student_inbox_v1',{p_read_entry:item.entry_id}).catch(()=>{});void refresh(false)};
      card.append(view);
     }
     card.append(msg);
    }
    const pending=Math.max(0,Number(item.bonus_points||0)-Number(item.claimed_points||0));
    if(pending){
     const claim=make('button','inbox-action inbox-claim','★ +'+pending+'점 받기');card.append(claim);
     claim.onclick=async()=>{claim.disabled=true;try{const result=await call('writing_genius_claim_bonus_v1',{p_entry_id:item.entry_id});claim.remove();const reveal=make('div','inbox-reveal','+'+result.awarded+' POINTS!');card.append(reveal);play('complete');setTimeout(()=>play('star-tick'),220);window.dispatchEvent(new CustomEvent('stars:refresh',{detail:{earned:0}}));try{localStorage.setItem('stars:refresh',String(Date.now()))}catch{}void refresh(false)}catch{claim.disabled=false;card.append(make('p','','다시 시도해 주세요.'))}};
    }
    body.append(card);
   }
  }catch{if(open)body.replaceChildren(make('p','','메시지를 불러오지 못했어요. 다시 열어 주세요.'))}
 }
 button.onclick=()=>{header.shadowRoot.getElementById('avatarBtn')?.click();void refresh(true)};
 setTimeout(()=>void refresh(false,true),2000);
 header._inboxTimer=setInterval(()=>{if(document.visibilityState==='visible')void refresh(false)},90000);
}
