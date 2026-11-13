// Guardrail for Free Talking AI Willy's single-source SVG asset.
// Run: node scripts/check-ai-willy-shared-asset.mjs
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const svg=read('students/free-talking-genius/willy-svg.js');
const actor=read('students/free-talking-genius/character-actor.js');
const live=read('students/free-talking-hybrid-lab/extension.js');
const stage=read('students/free-talking-hybrid-lab/shared-character-stage.js');
const animations=read('students/free-talking-genius/character-animations.css');
const studio=read('students/free-talking-genius/character-studio/index.html');
const checks=[
 ['canonical shared AI Willy head export',svg.includes('export const AI_WILLY_HEAD_SVG=createWillySvg({}, {headOnly:true})')],
 ['no separate idle smile path in the SVG',!/class="aw-idle-mouth"/.test(svg)],
 ['shared SVG used by the reusable actor',actor.includes('AI_WILLY_HEAD_SVG')&&!actor.includes('createWillySvg(')],
 ['shared SVG used by live/portrait/finish screens',live.includes('AI_WILLY_HEAD_SVG')&&!live.includes('createWillySvg(')],
 ['the same actor used in live Free Talking',stage.includes('createFreeTalkingCharacters(')],
 ['no idle mouth even from cached legacy SVG',animations.includes('.aw-svg .aw-idle-mouth{display:none!important}')],
 ['no studio-specific idle smile',!studio.includes('.aw-idle-mouth{opacity:1}')],
];
for(const [name,ok] of checks)console.log((ok?'PASS':'FAIL')+' '+name);
if(checks.some(([,ok])=>!ok))process.exitCode=1;
