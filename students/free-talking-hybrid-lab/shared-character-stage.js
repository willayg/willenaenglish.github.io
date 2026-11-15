// Free Talking-only shared character presentation.
// Restores the original ft-animal-stage / ft-animal-avatar / ft-animal-timer
// layout used before the Nov 13 SVG-stage experiment. No Speaking controls.
import {createFreeTalkingCharacters,resolveFreeTalkingActorPhase,scopedCharacterArt} from '/students/free-talking-genius/character-actor.js?v=20261115-steve-sleeves2';
import {STEVE_ART} from '/students/free-talking-genius/steve-character.js?v=20261115-steve-sleeves2';

export function createHybridCharacterStage(host,character='bunny-v3'){
 host.replaceChildren();
 const stage=document.createElement('div');
 stage.className='ft-animal-stage ft-original-character-stage';
 stage.dataset.phase='ready';
 const anchor=document.createElement('div');
 anchor.className='ft-animal-avatar';
 anchor.dataset.phase='ready';
 const timer=document.createElement('div');
 timer.className='ft-animal-timer';
 timer.setAttribute('aria-hidden','true');
 // Original 240x240 / r110 timer, used by all three characters.
 timer.innerHTML='<svg viewBox="0 0 240 240" aria-hidden="true"><circle class="ft-animal-track" cx="120" cy="120" r="110" pathLength="100"/><circle class="ft-animal-progress" cx="120" cy="120" r="110" pathLength="100"/></svg>';
 const speechRing=document.createElement('div');
 speechRing.id='ftSpeechTimeRing';
 speechRing.hidden=true;
 speechRing.setAttribute('aria-hidden','true');
 speechRing.style.setProperty('--ft-record-remaining','1');
 // Recording halo uses the same fixed stage centre as the original timer.
 stage.append(anchor,timer,speechRing);
 const transcript=document.createElement('div');
 transcript.id='ftLiveSpeechPreview';
 transcript.setAttribute('aria-hidden','true');
 host.append(stage,transcript);
 const session=document.createElement('div');
 const actor=createFreeTalkingCharacters({circle:anchor,session,voiceHost:stage,choices:{}});
 actor.select(character);
 // Character choice is authoritative here, not the actor factory's default
 // Willo selected while the actor component initializes.
 stage.dataset.character=character;
 if(character==='steve'){
  const live=actor.actor;
  // Render the exact shared vector directly into the chosen actor. This
  // avoids a stale Willo fallback surviving the component's initialization.
  if(live){
   actor.select('steve');
   live.innerHTML='<span class="ft-steve-actor">'+scopedCharacterArt(STEVE_ART,'steve-live-stage')+'</span>';
  }
  if(live){
   live.hidden=false;
   live.style.setProperty('display','block','important');
   live.style.setProperty('visibility','visible','important');
   live.style.setProperty('opacity','1','important');
   live.style.setProperty('z-index','5','important');
  }
 }
 function setPhase(phase){
  const visualPhase=resolveFreeTalkingActorPhase({phase});
  stage.dataset.phase=phase;
  actor.setPhase(visualPhase);
 }
 return {...actor,setPhase,stage,circle:anchor};
}
