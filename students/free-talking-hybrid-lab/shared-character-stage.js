// Free Talking-only SVG character stage. No Speaking UI, buttons, or mic handlers.
// Add future characters to character-actor.js's ART registry, then call select(key).
import {createFreeTalkingCharacters} from '/students/free-talking-genius/character-actor.js?v=20261113-face-gradient2';

export function createHybridCharacterStage(host, character='bunny-v3') {
  host.replaceChildren();
  const stage=document.createElement('div');
  stage.className='ft-hybrid-character-stage';
  stage.setAttribute('aria-label','Conversation character');
  const circle=document.createElement('div');
  circle.className='ft-hybrid-character-circle';
  circle.id='ftHybridCharacter';
  circle.dataset.phase='ready';
  circle.dataset.listening='false';
  const backdrop=document.createElement('div');
  backdrop.className='ft-hybrid-character-backdrop';
  backdrop.setAttribute('aria-hidden','true');
  const timer=document.createElementNS('http://www.w3.org/2000/svg','svg');
  timer.setAttribute('viewBox','0 0 240 240');
  timer.setAttribute('class','ft-hybrid-character-timer');
  timer.setAttribute('aria-hidden','true');
  for(const cl of ['ft-hybrid-timer-track','ft-hybrid-timer-progress']){
    const ring=document.createElementNS('http://www.w3.org/2000/svg','circle');
    ring.setAttribute('cx','120');ring.setAttribute('cy','120');ring.setAttribute('r','110');
    ring.setAttribute('pathLength','100');ring.setAttribute('class',cl);timer.append(ring);
  }
  // Keep the recorder's existing ID and CSS variable contract.
  const speechRing=document.createElement('div');
  speechRing.id='ftSpeechTimeRing';
  speechRing.setAttribute('aria-hidden','true');
  speechRing.hidden=true;
  speechRing.style.setProperty('--ft-record-remaining','1');
  const visual=document.createElement('div');
  visual.className='ft-hybrid-character-art';
  circle.append(backdrop,timer,speechRing,visual);
  stage.append(circle);
  const transcript=document.createElement('div');
  transcript.id='ftLiveSpeechPreview';
  transcript.setAttribute('aria-hidden','true');
  host.append(stage,transcript);
  // The existing SVG actor is visual only; no Speaking app DOM is mounted.
  const session=document.createElement('div');
  session.hidden=false;
  const actor=createFreeTalkingCharacters({circle:visual,session,voiceHost:stage,choices:{}});
  actor.select(character);
  function setPhase(phase){
    stage.dataset.phase=phase;
    visual.dataset.phase=phase==='speaking'?'ai':phase==='listening'?'student':phase;
    visual.dataset.listening=String(phase==='listening');
    actor.setSpeaking(phase==='speaking');
  }
  return {...actor,setPhase,stage,circle};
}
