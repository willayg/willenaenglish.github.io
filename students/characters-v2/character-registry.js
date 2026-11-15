// Character System V2 · shared character metadata.
// Metadata is shared by Free Talking and the future student character collection.
// Never trust this public registry for authorization or award decisions.
// Early Bunny/Pigfish thresholds are staged metadata only; do not enforce until phase 4.
export const CHARACTER_SCHEMA_VERSION=2;
export const CHARACTER_REGISTRY=Object.freeze([
 {id:'willi',name:'Willo',menuId:'ftChooseWilli',actorKey:'marin',voiceProvider:'openai',voiceId:'marin',unlockPoints:0,order:0,personality:'patient English-learning helper',asset:'voice-ring',states:['idle','listening','thinking','speaking'],status:'published'},
 {id:'bunny',name:'Bunny Fox',menuId:'ftChooseLili',actorKey:'bunny-v3',voiceProvider:'elevenlabs',voiceId:'M7zl2TS7ORAIGUejDfoy',unlockPoints:100,order:1,personality:'playful space explorer',asset:'bunny',states:['idle','listening','thinking','speaking'],status:'published'},
 {id:'pigfish',name:'Pigfish',menuId:'ftChoosePigfish',actorKey:'pigfish',voiceProvider:'elevenlabs',voiceId:'W7UbuMY4ypluqgZS2UzT',unlockPoints:300,order:2,personality:'water-loving fish with a pig face',asset:'pigfish',states:['idle','listening','thinking','speaking'],status:'published'},
 {id:'willy',name:'AI Willi 2',menuId:'ftChooseWilly',actorKey:'willy',voiceProvider:'elevenlabs',voiceId:'GSGMGjgDtwaXe25hDMNI',unlockPoints:0,order:3,personality:'bright and friendly robot',asset:'willy',states:['idle','listening','thinking','speaking','surprised'],status:'published'},
 {id:'dusk',name:'Dusk',menuId:'ftChooseDusk',actorKey:'dusk',voiceProvider:'elevenlabs',voiceId:'OBZs1sGUHfHnTlpkyXwC',unlockPoints:5000,order:4,personality:'mysterious but playful',asset:'dusk',states:['idle','listening','thinking','speaking','surprised'],status:'published'},
 {id:'steve',name:'Sergeant Steve',menuId:'ftChooseSteve',actorKey:'steve',voiceProvider:'elevenlabs',voiceId:'8j74BTqU7XqD2faIlSD4',unlockPoints:8000,order:5,personality:'grumpy and comically bombastic drill sergeant',asset:'steve',states:['idle','listening','thinking','speaking','surprised','shouting'],status:'published'}
]);
const idPattern=/^[a-z][a-z0-9-]{1,39}$/;
export function validateCharacter(entry){
 const errors=[];
 if(!idPattern.test(String(entry?.id||'')))errors.push('Character ID must be lowercase and URL-safe');
 if(!String(entry?.name||'').trim())errors.push('Character name is required');
 if(!Number.isSafeInteger(entry?.unlockPoints)||entry.unlockPoints<0)errors.push('Invalid unlock threshold');
 if(!['openai','elevenlabs'].includes(entry?.voiceProvider))errors.push('Unsupported voice provider');
 if(!String(entry?.voiceId||'').trim())errors.push('Voice ID missing');
 if(!['published','draft','retired'].includes(entry?.status))errors.push('Invalid publishing status');
 if(!Array.isArray(entry?.states)||!entry.states.includes('idle')||!entry.states.includes('speaking'))errors.push('Essential animation states missing');
 return errors;
}
export function getCharacter(id){return CHARACTER_REGISTRY.find(c=>c.id===String(id||'').toLowerCase())||null}
export function charactersInMenu(){return CHARACTER_REGISTRY.filter(c=>c.status==='published').slice().sort((a,b)=>a.order-b.order)}
export function isCharacterEligible(id,totalPoints){const c=getCharacter(id);return Boolean(c&&c.status==='published'&&Number.isFinite(totalPoints)&&totalPoints>=c.unlockPoints)}
export function characterCollection(totalPoints){return charactersInMenu().map(c=>({...c,unlocked:isCharacterEligible(c.id,totalPoints)}))}
export function registryDiagnostics(entries=CHARACTER_REGISTRY){
 const issues=[],ids=new Set(),menuIds=new Set();
 for(const c of entries){
  for(const msg of validateCharacter(c))issues.push(c.id+': '+msg);
  if(ids.has(c.id))issues.push('Duplicate ID: '+c.id);ids.add(c.id);
  if(c.menuId&&menuIds.has(c.menuId))issues.push('Duplicate menu ID: '+c.menuId);menuIds.add(c.menuId);
 }
 return issues;
}
