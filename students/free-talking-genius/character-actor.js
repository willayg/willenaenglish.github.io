// Visual-only bridge to the exact SVG animation assets from the Bunny Fox demo.
// No audio interception, app cloning, auth, recording, grading or progress logic.
import {BUNNY_FOX_ART,PIGFISH_ART} from './character-art.js?v=20261113-willy-wave3';
import {AI_WILLY_HEAD_SVG} from './willy-svg.js?v=20261114-electric-cat-v3';
import {DUSK_ART} from './dusk-character.js?v=20261114-unlock1';
// Willo has no animal SVG: his original artwork is the voice-circle stored
// in the canonical shared character menu. Reuse that exact SVG in the live
// activity rather than inventing a different icon or leaving an empty ring.
function originalWilloArt(){
 const menu=window.WillenaFTSharedMenu?.makeMenu?.();
 const svg=menu?.querySelector('#ftChooseWilli .ft-willi-portrait svg');
 if(svg){
  const clone=svg.cloneNode(true);
  clone.classList.add('ft-willo-svg');
  return '<span class="ft-willo-actor">'+clone.outerHTML+'</span>';
 }
 // Fallback only if the shared menu script failed to initialize. This is
 // the same vector geometry/colours as the canonical menu's Willo portrait.
 return '<span class="ft-willo-actor"><svg class="ft-willo-svg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#69d7df" stroke-width="7"/><circle cx="50" cy="50" r="19" fill="none" stroke="#d6f2f4" stroke-width="8"/><path d="M50 31 A19 19 0 0 1 67 42" fill="none" stroke="#69c1cc" stroke-width="7" stroke-linecap="round"/><path d="M33 57 A19 19 0 0 0 47 69" fill="none" stroke="#efadce" stroke-width="7" stroke-linecap="round"/></svg></span>';
}
const ART={'bunny-v3':BUNNY_FOX_ART,pigfish:PIGFISH_ART,willy:AI_WILLY_HEAD_SVG,marin:originalWilloArt(),dusk:DUSK_ART};
const PORTRAITS={...ART};
// One animation-state vocabulary for the Speaking and live conversation workspaces.
// This is visual-only: it never starts recording, audio playback, or grading.
export function resolveFreeTalkingActorPhase({speaking=false,listening=false,thinking=false,phase='ready'}={}){
 if(speaking||phase==='speaking'||phase==='ai')return 'speaking';
 if(listening||phase==='listening'||phase==='student')return 'listening';
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
 // Dusk's SVG is reused in both the character menu and the activity.
 // Scope gradient and clipPath IDs independently so Android never resolves
 // a live stage fill against a hidden menu SVG.
 if(markup.includes('ft-dusk-svg')){
  for(const match of markup.matchAll(/<(?:linearGradient|clipPath)\b[^>]*\bid="([^"]+)"/g)){
   const id=match[1],scoped=id+'-'+suffix;
   markup=markup.replace(match[0],match[0].replace('id="'+id+'"','id="'+scoped+'"'));
   markup=markup.replaceAll('url(#'+id+')','url(#'+scoped+')');
  }
 }
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
  if(selected==='dusk'){
   const t=String(text||'').toLowerCase();
   const body=actor.querySelector('.ft-dusk-actor');
   if(!body)return;
   // Rare, context-triggered expressions; no random repetitive effects.
   const effect=/\b(?:wow|surprise|amazing|no way|unbelievable)\b/.test(t)?'surprised':
    /\b(?:suspicious|secret|hmm|interesting|strange)\b/.test(t)?'squint':
    /\b(?:look over there|over there|where is)\b/.test(t)?'glance':'';
   if(effect){
    body.dataset.duskEffect=effect;
    clearTimeout(body._effectTimer);
    body._effectTimer=setTimeout(()=>{if(body.dataset.duskEffect===effect)delete body.dataset.duskEffect},effect==='squint'?1100:750);
   }
   return;
  }
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
