// Free Talking-only shared character presentation.
// Restores the original ft-animal-stage / ft-animal-avatar / ft-animal-timer
// layout used before the Nov 13 SVG-stage experiment. No Speaking controls.
import {createFreeTalkingCharacters} from '/students/free-talking-genius/character-actor.js?v=20261114-mood-head-v2';

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
 function setPhase(phase){
  stage.dataset.phase=phase;
  anchor.dataset.phase=phase==='speaking'?'ai':phase==='listening'?'student':phase;
  anchor.dataset.listening=String(phase==='listening');
  actor.setSpeaking(phase==='speaking');
 }
 return {...actor,setPhase,stage,circle:anchor};
}
