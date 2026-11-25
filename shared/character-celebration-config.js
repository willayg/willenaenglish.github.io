// P4 canonical fixed celebration lines and theme identities.
// Imported by student UI and Pages audio endpoint. No student data.
export const CELEBRATIONS=Object.freeze({
 bunny:Object.freeze({theme:'moon',line:'Bunny Fox is ready for your next space adventure!',version:'moon-v1'}),
 pigfish:Object.freeze({theme:'ocean',line:'Splash! Pigfish is here to practise English with you!',version:'ocean-v1'}),
 dusk:Object.freeze({theme:'night',line:'Well, well... Five thousand points. You found me. Welcome to the shadows!',version:'night-v1'}),
 steve:Object.freeze({theme:'camo',line:'[surprised] WHAT?! EIGHT THOUSAND POINTS?! YOU HAVE EARNED MY RESPECT, RECRUIT!',version:'camo-v1'}),
 willy:Object.freeze({theme:'tech',line:'Hello, friend! I am AI Willi 2!',version:'tech-v1'}),
 willi:Object.freeze({theme:'airy',line:'Hello! I am Willo. Let us practise English!',version:'airy-v1'})
});
export function celebrationFor(id){return CELEBRATIONS[String(id||'').toLowerCase()]||null}
export function visibleCelebrationLine(id){return String(celebrationFor(id)?.line||'').replace(/\[[^\]]+\]\s*/g,'')}
export function celebrationAudioKey(id,voiceId){
 const config=celebrationFor(id);
 if(!config||!voiceId)return null;
 const safe=String(voiceId).replace(/[^a-zA-Z0-9_-]/g,'');
 return 'characters/celebrations/v1/'+id+'/'+config.version+'/'+safe+'.mp3';
}
