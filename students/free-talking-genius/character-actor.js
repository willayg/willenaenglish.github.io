// Visual-only bridge to the exact SVG animation assets from the Bunny Fox demo.
// No audio interception, app cloning, auth, recording, grading or progress logic.
import {BUNNY_FOX_ART,PIGFISH_ART} from './character-art.js?v=20261113-willy-wave3';
import {AI_WILLY_HEAD_SVG} from './willy-svg.js?v=20261114-electric-cat-v3';
const ART={'bunny-v3':BUNNY_FOX_ART,pigfish:PIGFISH_ART,willy:AI_WILLY_HEAD_SVG};
const PORTRAITS={...ART};
// One animation-state vocabulary for the Speaking and live conversation workspaces.
// This is visual-only: it never starts recording, audio playback, or grading.
export function resolveFreeTalkingActorPhase({speaking=false,listening=false,thinking=false,phase='ready'}={}){
 if(speaking)return 'speaking';
 if(listening||phase==='student')return 'listening';
 if(thinking||phase==='thinking')return 'thinking';
 return 'idle';
}

/* Duplicate SVG gradient IDs resolve against the hidden selection portrait on
   some Android browsers, leaving Pigfish's in-game body transparent.
   Scope references per instance; artwork, colours and animations are unchanged. */
export function scopedCharacterArt(markup,suffix){
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
  const state=resolveFreeTalkingActorPhase({speaking:voiceSpeaking,listening:recording,thinking,phase});
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
  actor.dataset.mood=selected==='willy'&&['happy','surprised','sad','angry','cat'].includes(mood)?mood:'neutral';
 }
 function setMoodFromText(text){
  if(selected!=='willy')return;
  const t=String(text||'').toLowerCase();
  // Use model-supplied ElevenLabs cues when present; otherwise classify gently.
  // Match explicit speech context, not a timer. Rare special effects stay meaningful.
  const mood=/\[(?:angry|frustrated|furious)\]|\b(?:furious|so angry|really mad)\b/.test(t)?'angry':
   /\[(?:crying|sadly|sobbing)\]|\b(?:so sorry|that's sad|feel sad)\b/.test(t)?'sad':
   /\[(?:gasps|surprised|shocked)\]|\b(?:wow|no way|what a surprise|unbelievable|i can't believe it)\b/.test(t)?'surprised':
   /\[(?:giggles|giggling|chuckles|chuckling|laughing)\]|\b(?:so cute|how cute|adorable|cute little|funny joke|that's hilarious|so funny|meow|kitty|kitten)\b/.test(t)?'cat':
   /\[(?:excited|cheerful)\]|\b(?:great job|well done|awesome|wonderful)\b/.test(t)?'happy':'neutral';
  setMood(mood);
 }
 function setPhase(phase){
  // Set the same visual state used by live Free Talking, without owning audio state.
  const normalized=resolveFreeTalkingActorPhase({phase});
  circle.dataset.phase=normalized==='speaking'?'ai':normalized==='listening'?'student':normalized;
  circle.dataset.listening=String(normalized==='listening');
  setSpeaking(normalized==='speaking');
 }
 function setSpeaking(playing){
  voiceSpeaking=Boolean(playing);
  // Keep the mood inferred from THIS spoken line, never cycle through moods.
  // All expression and spark effects are CSS-gated to the speaking state.
  if(!voiceSpeaking){
   actor.dataset.mood='neutral';
   if(actor.dataset.state==='celebrating')actor.dataset.state='idle';
  }
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
  setSpeaking(!!event.detail?.playing);
 });
 select('marin');
 return {select,celebrate,setPhase,setSpeaking,setMood,setMoodFromText,actor};
}
