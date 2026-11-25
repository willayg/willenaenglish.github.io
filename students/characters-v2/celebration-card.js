// P4: one visual celebration component for student header, Free Talking,
// dashboard replays and staff preview. Audio/DB behavior stays in the caller.
import {getCharacter} from '/shared/free-talking-character-catalog.js?v=20261115-p2-b';
import {celebrationFor,visibleCelebrationLine} from '/shared/character-celebration-config.js?v=20261116-p4-1';
import {characterThumbnailMarkup} from './character-runtime.js?v=20261115-unique-svg-resources1';

// Self-contained theme scenery: the global dashboard and shadow-root popups
// must display their themes even when an external CSS link is delayed/missing.
// No fetched images, no emoji, no extra SVGs, no changes to character animation.
const THEMES={
 moon:{back:'radial-gradient(ellipse at 70% 10%,#524b89,#17173c 57%,#090e2b)',paper:'linear-gradient(155deg,#262357,#352763 66%,#1b1e4b)',border:'#d6b2f4',ink:'#fff8ff',accent:'#b47ce4'},
 ocean:{back:'radial-gradient(ellipse at 30% 4%,#116a94,#042b52 60%,#03162e)',paper:'radial-gradient(ellipse at 14% 1%,#177eab,#0b456f 55%,#042848)',border:'#7fe1f5',ink:'#ecfeff',accent:'#0f8cbb'},
 camo:{back:'linear-gradient(150deg,#17271c,#3a4430 60%,#16251a)',paper:'repeating-linear-gradient(121deg,#526744 0 33px,#67734b 34px 64px,#344a37 65px 99px,#7a7953 100px 134px)',border:'#d5c98e',ink:'#fffce4',accent:'#405b37'},
 night:{back:'linear-gradient(145deg,#081523,#15253e)',paper:'linear-gradient(155deg,#1b2540,#101c32)',border:'#62d4ce',ink:'#f3f7ff',accent:'#58c9d1'},
 tech:{back:'linear-gradient(135deg,#c3f8ff,#53b7ca)',paper:'linear-gradient(155deg,#f9ffff,#d3f4fd)',border:'#42bdcf',ink:'#28535c',accent:'#42bdcf'},
 airy:{back:'linear-gradient(135deg,#dbeefb,#e9e1fb)',paper:'linear-gradient(155deg,#fffefe,#eff3fc)',border:'#98cadc',ink:'#2c5563',accent:'#84bcca'}
};
const createSceneryNode=(el,style)=>{Object.assign(el.style,{position:'absolute',pointerEvents:'none',...style});return el};
function applyVisualTheme(root,card,theme){
 const palette=THEMES[theme]||THEMES.airy;
 root.style.setProperty('background',palette.back,'important');
 card.style.setProperty('background',palette.paper,'important');
 card.style.setProperty('border-color',palette.border,'important');
 card.style.setProperty('color',palette.ink,'important');
 card.style.setProperty('position','relative','important');
 card.style.setProperty('isolation','isolate');
 const scenery=createSceneryNode(document.createElement('div'),{inset:'0',overflow:'hidden',borderRadius:'22px',zIndex:'0'});
 scenery.className='ft-milestone-scenery';
 scenery.setAttribute('aria-hidden','true');
 const place=(text,x,y,size,color,glow='none')=>{
  const star=createSceneryNode(document.createElement('span'),{left:x+'%',top:y+'%',fontSize:size+'px',lineHeight:'1',color,textShadow:glow,fontFamily:'Georgia,serif'});
  star.textContent=text;scenery.append(star);
 };
 if(theme==='moon'){
  // A distinct illuminated crescent and readable stars, not background specks.
  const moon=createSceneryNode(document.createElement('span'),{width:'66px',height:'66px',right:'14px',top:'48px',borderRadius:'50%',background:'#fff0c5',boxShadow:'0 0 18px 6px #fff3bb88,0 0 48px 14px #d2b8ff55'});
  const shade=createSceneryNode(document.createElement('span'),{width:'60px',height:'60px',right:'-13px',top:'-13px',borderRadius:'50%',background:'#30235a'});
  moon.append(shade);scenery.append(moon);
  for(const [x,y,size] of [[10,9,23],[28,16,11],[62,8,18],[83,32,11],[8,36,14],[93,49,16],[14,61,19],[77,67,11],[10,87,17],[85,91,20],[35,79,9],[68,93,10]]){
   place('✦',x,y,size,'#ffe9ad','0 0 8px #fff5c5,0 0 14px #f2cdff');
  }
 }else if(theme==='ocean'){
  for(const [x,y,d] of [[11,12,15],[87,16,25],[16,41,10],[91,42,16],[8,74,21],[83,69,13],[71,91,27],[25,92,9],[38,6,8]]){
   scenery.append(createSceneryNode(document.createElement('span'),{left:x+'%',top:y+'%',width:d+'px',height:d+'px',borderRadius:'50%',border:'2px solid #b5effb99',background:'#adf4ff22',boxShadow:'inset -2px -2px 6px #1c6da555,0 0 8px #9cffff55'}));
  }
  const rays=createSceneryNode(document.createElement('span'),{width:'100%',height:'190px',left:'0',top:'0',background:'repeating-linear-gradient(113deg,transparent 0 44px,#d5fcff15 45px 70px,transparent 71px 120px)',opacity:'.8'});
  scenery.prepend(rays);
 }else if(theme==='camo'){
  for(const [x,y,w,h,rotation,color] of [[-8,6,110,49,-24,'#24392788'],[67,11,120,59,24,'#a4a2766b'],[11,42,85,39,41,'#233a2d77'],[77,58,85,64,-31,'#2f483c90'],[6,83,138,41,-19,'#8b966266'],[58,88,100,37,35,'#26392d75']]){
   scenery.append(createSceneryNode(document.createElement('span'),{left:x+'%',top:y+'%',width:w+'px',height:h+'px',transform:'rotate('+rotation+'deg)',borderRadius:'52% 25% 48% 21%',background:color}));
  }
 }
 card.prepend(scenery);
 for(const node of card.children)if(node!==scenery){
  node.style.setProperty('position','relative');
  node.style.setProperty('z-index','1');
 }
 const portrait=card.querySelector('.ft-milestone-art');
 if(portrait){portrait.style.setProperty('border-color',palette.border,'important');portrait.style.setProperty('background',theme==='ocean'?'#c8f7fb':theme==='moon'?'#f6f1ff':theme==='camo'?'#d9dbbf':theme==='night'?'#122c45':'#fff','important')}
 const next=card.querySelector('.ft-milestone-continue');
 if(next){next.style.setProperty('background',palette.accent,'important');next.style.setProperty('border-color',palette.border,'important')}
 const eyebrow=card.querySelector('.ft-milestone-eyebrow');
 if(eyebrow&&['moon','ocean','camo','night'].includes(theme))eyebrow.style.setProperty('color',theme==='moon'?'#ffd6fa':theme==='ocean'?'#c7faff':theme==='camo'?'#f7e8a8':'#b7edee','important');
}
let serial=0;
export function createCharacterCelebration(characterId,{replay=false,preview=false}={}){
 const character=getCharacter(characterId),theme=celebrationFor(characterId);
 if(!character||!theme)throw Error('Unknown celebration character');
 const root=document.createElement('section');
 root.className='ft-character-unlock-celebration is-'+character.id+(replay?' collection-replay':'')+(preview?' manager-preview':'');
 root.setAttribute('role','dialog');root.setAttribute('aria-modal',String(!preview));
 root.setAttribute('aria-label',character.name+(replay?' celebration':' unlocked'));
 const confetti=document.createElement('div');confetti.className='ft-milestone-confetti';confetti.setAttribute('aria-hidden','true');
 for(let i=0;i<9;i++)confetti.append(document.createElement('i'));
 const card=document.createElement('div');card.className='ft-milestone-card';
 const eyebrow=document.createElement('div');eyebrow.className='ft-milestone-eyebrow';eyebrow.textContent=replay?'CHARACTER CELEBRATION!':'NEW CHARACTER UNLOCKED!';
 const portrait=document.createElement('div');portrait.className='ft-milestone-art';
 const art=document.createElement('span');art.className='ft-milestone-dusk';
 art.innerHTML=characterThumbnailMarkup(character.id,'p4-celeb-'+character.id+'-'+(++serial));portrait.append(art);
 const name=document.createElement('h2');name.textContent=character.name.toUpperCase();
 const points=document.createElement('p');points.className='ft-milestone-points';points.textContent=character.unlockPoints?character.unlockPoints.toLocaleString('en-US')+' POINTS':'FREE CHARACTER';
 const quote=document.createElement('p');quote.className='ft-milestone-quote';quote.textContent=visibleCelebrationLine(character.id);
 const translated=document.createElement('p');translated.className='ft-milestone-korean';translated.textContent=replay?'캐릭터 축하 애니메이션':'새로운 대화 친구가 열렸어요!';
 const buttons=document.createElement('div');buttons.className='ft-milestone-actions';
 const listen=document.createElement('button');listen.type='button';listen.className='ft-milestone-listen';listen.textContent='목소리 듣기';
 const next=document.createElement('button');next.type='button';next.className='ft-milestone-continue';next.textContent=replay||preview?'닫기 · Close':'친구 만나기';
 buttons.append(listen,next);
 const status=document.createElement('p');status.className='ft-milestone-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 card.append(eyebrow,portrait,name,points,quote,translated,buttons,status);root.append(confetti,card);
 applyVisualTheme(root,card,theme.theme);
 return {root,card,listen,next,status,character,theme,voiceLine:theme.line};
}
