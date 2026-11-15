// P4: one visual celebration component for student header, Free Talking,
// dashboard replays and staff preview. Audio/DB behavior stays in the caller.
import {getCharacter} from '/shared/free-talking-character-catalog.js?v=20261115-p2-b';
import {celebrationFor,visibleCelebrationLine} from '/shared/character-celebration-config.js?v=20261116-p4-1';
import {characterThumbnailMarkup} from './character-runtime.js?v=20261115-unique-svg-resources1';
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
 return {root,card,listen,next,status,character,theme,voiceLine:theme.line};
}
