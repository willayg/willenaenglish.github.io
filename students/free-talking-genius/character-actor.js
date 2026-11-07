// Visual-only bridge to the exact SVG animation assets from the Bunny Fox demo.
// No audio interception, app cloning, auth, recording, grading or progress logic.
import {BUNNY_FOX_ART,PIGFISH_ART} from './character-art.js';
const ART={'bunny-v3':BUNNY_FOX_ART,pigfish:PIGFISH_ART};
export function createFreeTalkingCharacters({circle,session,voiceHost,choices}){
 const actor=document.createElement('span');
 actor.className='bf-actor';
 actor.dataset.state='idle';
 actor.hidden=true;
 circle.appendChild(actor);
 for(const [id,character] of Object.entries(choices)){
  const slot=document.getElementById(id)?.querySelector('.ft-character-symbol');
  if(slot&&ART[character])slot.innerHTML=ART[character];
 }
 let selected='marin',voiceSpeaking=false,celebrateTimer=null;
 function update(){
  if(!ART[selected]||session.hidden)return;
  const recording=circle.dataset.aiRecording==='true'||circle.dataset.listening==='true';
  const thinking=circle.dataset.transcribing==='true'||circle.dataset.phase==='thinking';
  const phase=circle.dataset.phase;
  const state=voiceSpeaking?'speaking':recording?'listening':thinking?'thinking':phase==='feedback'?'idle':'idle';
  if(actor.dataset.state!=='celebrating')actor.dataset.state=state;
 }
 function select(character){
  selected=ART[character]?character:'marin';
  session.dataset.character=selected;
  actor.hidden=!ART[selected];
  actor.innerHTML=ART[selected]||'';
  actor.dataset.state='idle';
  voiceSpeaking=false;
  update();
 }
 function celebrate(){
  if(!ART[selected])return;
  clearTimeout(celebrateTimer);
  actor.dataset.state='celebrating';
  celebrateTimer=setTimeout(()=>{actor.dataset.state='idle';update()},1150);
 }
 const observer=new MutationObserver(update);
 observer.observe(circle,{attributes:true,attributeFilter:['data-ai-recording','data-listening','data-transcribing','data-phase']});
 voiceHost.addEventListener('ft:voice-playing',event=>{
  voiceSpeaking=!!event.detail?.playing;
  update();
 });
 select('marin');
 return {select,celebrate,actor};
}
