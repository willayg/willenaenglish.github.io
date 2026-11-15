import {CHARACTER_REGISTRY,CHARACTER_PERSONAS,registryDiagnostics,charactersInMenu,isCharacterEligible} from '/shared/free-talking-character-catalog.js?v=20261115-p2-b';
import {characterMarkup,mountCharacter} from './character-runtime.js?v=20261115-modular-p2-2';
import {CELEBRATIONS,celebrationAudioKey,visibleCelebrationLine} from '/shared/character-celebration-config.js?v=20261116-p4-1';
import {createCharacterCelebration} from './celebration-card.js?v=20261116-p4-visible-scenery2';
const checks=document.getElementById('checks'),tests=document.getElementById('tests'),summary=document.getElementById('summary');
function run(){
 checks.replaceChildren();tests.replaceChildren();
 let passed=0,failed=0;
 const check=(name,condition,details='')=>{
  const div=document.createElement('div');div.className=condition?'pass':'fail';
  div.textContent=(condition?'✓ ':'✕ ')+name+(details?' — '+details:'');checks.append(div);
  if(condition)passed++;else failed++;
 };
 const issues=registryDiagnostics();
 check('Catalog validates',issues.length===0,issues.join('; '));
 check('All six original characters registered',CHARACTER_REGISTRY.length===6);
 check('Requested character menu ordering',charactersInMenu().map(c=>c.id).join(',')==='bunny,willy,pigfish,willi,dusk,steve');
 // P3: canonical thresholds must match every client selector and backend.
 for(const [id,threshold] of [['bunny',100],['pigfish',300],['dusk',5000],['steve',8000]]){
  check(id+' unlocks at '+threshold+' points',!isCharacterEligible(id,threshold-1)&&isCharacterEligible(id,threshold));
 }
 check('Free characters start unlocked',isCharacterEligible('willi',0)&&isCharacterEligible('willy',0));
 check('Unknown points never unlock earned characters',!isCharacterEligible('bunny',NaN)&&!isCharacterEligible('pigfish',NaN));
 // P4 shared component and fixed-audio cache identity regression checks.
 for(const c of charactersInMenu()){
  const config=CELEBRATIONS[c.id];
  check(c.name+' has a themed celebration',Boolean(config?.theme&&config?.line));
  check(c.name+' fixed audio key is stable',Boolean(celebrationAudioKey(c.id,c.voiceId)?.startsWith('characters/celebrations/v1/'+c.id+'/')));
  check(c.name+' visible line strips speech tags',!visibleCelebrationLine(c.id).includes('['));
  try{
   const {root:dialog,listen,next,voiceLine}=createCharacterCelebration(c.id,{preview:true});
   check(c.name+' shared celebration renders correctly',dialog.classList.contains('is-'+c.id)&&Boolean(dialog.querySelector('svg'))&&Boolean(listen)&&Boolean(next)&&voiceLine===config.line);
  }catch(error){check(c.name+' shared celebration renders correctly',false,String(error.message||error))}
 }


 for(const c of charactersInMenu()){
  const card=document.createElement('div');card.className='test-card';
  const label=document.createElement('strong');label.textContent=c.name;card.append(label);
  const avatar=document.createElement('div');avatar.className='avatar';card.append(avatar);
  let stage=null;
  try{stage=mountCharacter(avatar,c.id);const svg=avatar.querySelector('svg');
   check(c.name+' loads SVG',Boolean(svg));check(c.name+' has voice config',Boolean(c.voiceId&&c.voiceProvider));
   check(c.name+' has personality',typeof CHARACTER_PERSONAS[c.id]==='string'&&CHARACTER_PERSONAS[c.id].length>30);
   const phases=['idle','listening','thinking','speaking'];const stateOk=phases.every(p=>stage.setPhase(p));check(c.name+' actor phases',stateOk);
   stage.setPhase('speaking');check(c.name+' speaking state',avatar.querySelector('.bf-actor')?.dataset.state==='speaking');
  }catch(err){check(c.name+' loads without error',false,String(err.message||err))}
  const note=document.createElement('small');note.textContent='Speech state simulated · no API request';card.append(note);tests.append(card);
 }
 summary.textContent=passed+' passed · '+failed+' failed';summary.className=failed?'fail':'pass';
}
document.getElementById('rerun').addEventListener('click',run);
run();
