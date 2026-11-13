// Visual-only bridge to the exact SVG animation assets from the Bunny Fox demo.
// No audio interception, app cloning, auth, recording, grading or progress logic.
import {BUNNY_FOX_ART,PIGFISH_ART} from './character-art.js?v=20261113-willy-wave3';
import {AI_WILLY_HEAD_SVG} from './willy-svg.js?v=20261114-mood-head-v2';
const ART={'bunny-v3':BUNNY_FOX_ART,pigfish:PIGFISH_ART,willy:AI_WILLY_HEAD_SVG};
const PORTRAITS={...ART};
/* Duplicate SVG gradient IDs resolve against the hidden selection portrait on
   some Android browsers, leaving Pigfish's in-game body transparent.
   Scope references per instance; artwork, colours and animations are unchanged. */
function scopedCharacterArt(markup,suffix){
 // The menu portrait and the talking actor both mount the exact same SVG.
 // Scope gradient IDs per instance so Android resolves fills against the
 // visible SVG rather than the hidden character-selection artwork.
 const ids=markup.includes('pf-svg')?['pigBody','pigBelly']:
  markup.includes('aw-svg')?['williShell','williFace']:[];
 for(const id of ids){
  markup=markup.replaceAll('id="'+id+'"','id="'+id+'-'+suffix+'"')
   .replaceAll('url(#'+id+')','url(#'+id+'-'+suffix+')');
 }
 return markup;
}

export function createFreeTalkingCharacters({circle,session,voiceHost,choices}){
 const actor=document.createElement('span');
 actor.className='bf-actor';
 actor.dataset.state='idle';
 actor.dataset.mood='neutral';
 actor.hidden=true;
 circle.appendChild(actor);
 for(const [id,character] of Object.entries(choices)){
  const slot=document.getElementById(id)?.querySelector('.ft-character-symbol');
  if(slot&&PORTRAITS[character])slot.innerHTML=scopedCharacterArt(PORTRAITS[character],'portrait');
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
  actor.innerHTML=ART[selected]?scopedCharacterArt(ART[selected],'stage'):'';
  // Drop any legacy smile markup if a stale source managed to enter the renderer.
  actor.querySelectorAll('.aw-idle-mouth').forEach(el=>el.remove());
  actor.dataset.state='idle';actor.dataset.mood='neutral';
  voiceSpeaking=false;
  update();
 }
 function setMood(mood){
  actor.dataset.mood=selected==='willy'&&['happy','surprised','sad','angry'].includes(mood)?mood:'neutral';
 }
 function setMoodFromText(text){
  if(selected!=='willy')return;
  const t=String(text||'').toLowerCase();
  // Use model-supplied ElevenLabs cues when present; otherwise classify gently.
  const mood=/\[(?:angry|frustrated|furious)\]|\b(?:angry|furious)\b/.test(t)?'angry':
   /\[(?:crying|sadly|sobbing)\]|\b(?:so sorry|that's sad|feel sad)\b/.test(t)?'sad':
   /\[(?:gasps|surprised|shocked)\]|\b(?:wow|no way|really\?|what\?!)\b/.test(t)?'surprised':
   /\[(?:laughs|laughing|chuckles|giggles|excited|cheerful)\]|\b(?:great job|well done|awesome|wonderful|haha)\b/.test(t)?'happy':'neutral';
  setMood(mood);
 }
 function setSpeaking(playing){voiceSpeaking=Boolean(playing);if(!voiceSpeaking){actor.dataset.mood='neutral';if(actor.dataset.state==='celebrating')actor.dataset.state='idle'}update()}
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
 return {select,celebrate,setSpeaking,setMood,setMoodFromText,actor};
}
