/* Shared, visual-only homework deep-link splash. No session/progress mutation. */
(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const active=!!(params.get('homework')||params.get('assignment_id'));
  if(!active)return;
  document.documentElement.classList.add('willena-homework-opening');
  const style=document.createElement('style');
  style.textContent=`
  html.willena-homework-opening #willenaHomeworkOpening{display:flex!important}
  #willenaHomeworkOpening{display:none;position:fixed;inset:0;z-index:2147483000;align-items:center;justify-content:center;padding:20px;background:rgba(247,253,253,.98);font-family:Poppins,system-ui,sans-serif}
  #willenaHomeworkOpening .wh-card{width:min(400px,95vw);padding:30px 20px;border:2px solid #b8e9ed;border-radius:24px;background:white;box-shadow:0 15px 40px rgba(34,112,122,.12);text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}
  #willenaHomeworkOpening .wh-mark{width:56px;height:56px;display:grid;place-items:center;border-radius:17px;background:#eafafa;color:#287d86}
  #willenaHomeworkOpening .wh-mark svg{width:29px;height:29px}
  #willenaHomeworkOpening strong{font-size:19px;color:#276f79}
  #willenaHomeworkOpening small{font-size:12px;font-weight:700;color:#779198}
  #willenaHomeworkOpening .wh-bar{width:125px;height:5px;border-radius:99px;background:linear-gradient(90deg,#b9e9eb,#2aa0aa,#e1a2c8,#b9e9eb);background-size:220% 100%;animation:whMove 1.4s linear infinite}
  @keyframes whMove{to{background-position:-220% 0}}
  @media(prefers-reduced-motion:reduce){#willenaHomeworkOpening .wh-bar{animation:none}}
  `;
  document.head.appendChild(style);
  const hide=()=>{document.documentElement.classList.remove('willena-homework-opening');document.getElementById('willenaHomeworkOpening')?.remove()};
  const fail=message=>{
    const overlay=document.getElementById('willenaHomeworkOpening');
    if(!overlay)return;
    overlay.querySelector('strong').textContent='숙제를 불러오지 못했어요';
    overlay.querySelector('small').textContent=message||'Please check your homework or try again.';
    let button=overlay.querySelector('button');
    if(!button){button=document.createElement('button');button.type='button';button.textContent='모든 숙제 보기 · View all';button.style.cssText='padding:11px 16px;border:1.5px solid #b8e9ed;border-radius:999px;background:white;color:#267e87;font-weight:800;cursor:pointer';button.onclick=()=>{const u=new URL(location.href);u.searchParams.delete('homework');u.searchParams.delete('assignment_id');location.assign(u.pathname+u.search)};overlay.querySelector('.wh-card').append(button)}
  };
  window.WillenaHomeworkDeepLinkSplash={active,hide,fail};
})();