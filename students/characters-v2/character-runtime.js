// Free Talking Characters V2 — shared stage adapter.
// No conversation, voice, database or scoring side effects.
// Future characters require only a registry entry + one asset registration.
import {getCharacter} from './character-registry.js?v=20261115-character-v2-1';
import {BUNNY_FOX_ART,PIGFISH_ART} from '/students/free-talking-genius/character-art.js?v=20261113-willy-wave3';
import {AI_WILLY_HEAD_SVG} from '/students/free-talking-genius/willy-svg.js?v=20261114-electric-cat-v3';
import {DUSK_ART} from '/students/free-talking-genius/dusk-character.js?v=20261114-no-legacy-card1';
import {STEVE_ART} from '/students/free-talking-genius/steve-character.js?v=20261115-steve-sleeve2';
const ASSETS=Object.freeze({
 bunny:BUNNY_FOX_ART,pigfish:PIGFISH_ART,willy:AI_WILLY_HEAD_SVG,
 dusk:'<span class="ft-dusk-actor">'+DUSK_ART+'</span>',
 steve:'<span class="ft-steve-actor">'+STEVE_ART+'</span>',
 'voice-ring':'<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="39" fill="none" stroke="#6bd6dc" stroke-width="8"/><circle cx="50" cy="50" r="20" fill="none" stroke="#c8eef1" stroke-width="7"/><path d="M50 30A20 20 0 0167 41" fill="none" stroke="#69bfc9" stroke-width="7"/></svg>'
});
const VALID_PHASES=new Set(['idle','listening','thinking','speaking','surprised','shouting']);
export function characterMarkup(characterId){
 const config=getCharacter(characterId);
 if(!config)throw Error('Unregistered character: '+characterId);
 const artwork=ASSETS[config.asset];
 if(!artwork)throw Error('No SVG asset for character '+characterId);
 return artwork;
}
function scopeIds(markup,suffix){
 // Only SVG resource IDs are scoped. Animation target IDs must remain
 // stable so the original student CSS can reach eye/mouth/body controls.
 const ids=new Map();
 markup=markup.replace(/<(linearGradient|radialGradient|clipPath|mask|pattern|filter)\b[^>]*\bid="([^"]+)"/g,(match,tag,id)=>{
  const scoped=id+'-'+suffix;ids.set(id,scoped);
  return match.replace('id="'+id+'"','id="'+scoped+'"');
 });
 for(const [id,scoped]of ids)markup=markup.replaceAll('url(#'+id+')','url(#'+scoped+')');
 return markup;
}
export function characterThumbnailMarkup(characterId,suffix='thumbnail'){
 return scopeIds(characterMarkup(characterId),String(suffix).replace(/[^a-z0-9-]/gi,'-'));
}
let instanceSerial=0;
export function mountCharacter(host,characterId,{thumbnail=false}={}){
 if(!(host instanceof Element))throw Error('Character host element required');
 const config=getCharacter(characterId);
 if(!config)throw Error('Unknown character: '+characterId);
 const suffix='v2-'+(++instanceSerial);
 const markup=characterMarkup(characterId);
 host.replaceChildren();
 const actor=document.createElement('span');
 actor.className='bf-actor';
 actor.dataset.state='idle';
 actor.dataset.mood='neutral';
 actor.dataset.steveMood='stern';
 actor.dataset.audioSpeaking='false';
 actor.innerHTML=thumbnail?scopeIds(markup,suffix):markup;
 host.append(actor);
 host.dataset.character=characterId;
 host.dataset.state='idle';
 return {
  character:config,host,actor,
  setPhase(phase){
   if(!VALID_PHASES.has(phase)||!config.states.includes(phase))return false;
   host.dataset.state=phase;
   const speaking=['speaking','surprised','shouting'].includes(phase);
   actor.dataset.state=speaking?'speaking':phase;
   actor.dataset.audioSpeaking=String(speaking);
   actor.dataset.mood=characterId==='willy'&&phase==='surprised'?'surprised':'neutral';
   if(characterId==='steve')actor.dataset.steveMood=phase==='surprised'?'surprised':phase==='shouting'?'shouting':'stern';
   if(characterId==='dusk'){
     const body=actor.querySelector('.ft-dusk-actor');
     if(body){if(phase==='surprised')body.dataset.duskEffect='surprised';else delete body.dataset.duskEffect}
   }
   return true;
  },
  setSpeaking(playing){actor.dataset.audioSpeaking=String(Boolean(playing));actor.dataset.state=playing?'speaking':'idle';host.dataset.audioSpeaking=String(Boolean(playing));return true},
  destroy(){if(host.dataset.character===characterId){host.replaceChildren();delete host.dataset.character;delete host.dataset.state}}
 };
}
export function validateCharacterAssets(){
 const issues=[];
 for(const c of ['willi','bunny','pigfish','willy','dusk','steve']){
  try{const art=characterMarkup(c.id||c);if(!art.includes('<svg'))issues.push(c+': artwork is not SVG')}
  catch(error){issues.push(String(error.message))}
 }
 return issues;
}
