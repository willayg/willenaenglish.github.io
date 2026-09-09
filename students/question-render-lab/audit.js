// TEST HARNESS ONLY. Audits canonical questions with the real V2 renderer.
// This module deliberately does not judge pedagogy; it only reports structural/render risks.

export const AUDIT_STATUS={PASS:'pass',WARNING:'warning',FAIL:'fail'};

const text=v=>String(v??'');
const treeText=value=>{
  if(value==null)return'';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
  if(Array.isArray(value))return value.map(treeText).join(' ');
  if(typeof value==='object')return Object.values(value).map(treeText).join(' ');
  return'';
};
const add=(out,severity,code,message)=>out.push({severity,code,message});

export function auditStructure(q){
  const findings=[];
  if(!q||typeof q!=='object'){
    add(findings,AUDIT_STATUS.FAIL,'INVALID_QUESTION','Question model did not produce an object.');
    return findings;
  }
  if(!q.form)add(findings,AUDIT_STATUS.FAIL,'MISSING_FORM','Canonical question has no form.');
  if(q.form==='unsupported')add(findings,AUDIT_STATUS.FAIL,'UNSUPPORTED_FORM','Question model marked this shape unsupported.');

  const prompt=text(q.prompt||q.prompt_text).trim();
  if(q.form!=='learn'&&!prompt)add(findings,AUDIT_STATUS.WARNING,'EMPTY_PROMPT','Interactive question has no visible prompt.');

  const answers=Array.isArray(q.correctAnswer)?q.correctAnswer:
    Array.isArray(q.correct_answer)?q.correct_answer:
    q.correctAnswer!=null?[q.correctAnswer]:q.correct_answer!=null?[q.correct_answer]:[];
  if(q.form!=='learn'&&answers.filter(v=>text(v).trim()).length===0){
    add(findings,AUDIT_STATUS.FAIL,'MISSING_ANSWER','Interactive question has no canonical answer.');
  }

  const choices=Array.isArray(q.choices)?q.choices:[];
  if((q.form==='choice'||q.form==='multi')&&choices.length<2){
    add(findings,AUDIT_STATUS.FAIL,'MALFORMED_CHOICES',`Choice form has ${choices.length} option(s).`);
  }
  if(choices.length){
    const normalized=choices.map(v=>text(v).trim().toLowerCase()).filter(Boolean);
    if(new Set(normalized).size!==normalized.length)add(findings,AUDIT_STATUS.WARNING,'DUPLICATE_CHOICES','Choice list contains duplicate visible options.');
    if(choices.some(v=>!text(v).trim()))add(findings,AUDIT_STATUS.WARNING,'EMPTY_CHOICE','Choice list contains an empty option.');
  }

  const hay=treeText({prompt:q.prompt||q.prompt_text,context:q.context,answers,choices});
  if(/[~]/.test(hay))add(findings,AUDIT_STATUS.WARNING,'TILDE_MARKUP','Contains ~ markup; inspect token/answer normalization.');
  if(/\s\/\s|\/\s|\s\//.test(hay))add(findings,AUDIT_STATUS.WARNING,'SLASH_MARKUP','Contains slash-delimited text; inspect answer-slot behavior.');
  if(/_{2,}/.test(hay))add(findings,AUDIT_STATUS.WARNING,'UNDERSCORE_BLANKS','Contains underscore blanks; inspect blank rendering.');
  if(/<[^>]+>/.test(hay))add(findings,AUDIT_STATUS.WARNING,'HTML_MARKUP','Contains HTML-like markup.');
  if(/undefined|null|\[object Object\]/i.test(hay))add(findings,AUDIT_STATUS.FAIL,'LEAKED_VALUE','Question data contains undefined/null/object placeholder text.');

  if(q.form==='multipart'){
    const parts=Array.isArray(q.parts)?q.parts:Array.isArray(q.context?.parts)?q.context.parts:[];
    if(parts.length<2)add(findings,AUDIT_STATUS.WARNING,'MULTIPART_WITHOUT_PARTS','Multipart form exposes fewer than two structured parts.');
  }
  if((q.form==='order'||q.form==='chunks'||q.form==='blanks')&&Array.isArray(q.chips)&&q.chips.length===0){
    add(findings,AUDIT_STATUS.FAIL,'EMPTY_CHIPS',`${q.form} form has an empty chip list.`);
  }
  return findings;
}

function interactiveCount(root){
  return root.querySelectorAll('input, textarea, select, button[data-answer], [contenteditable="true"], .choice-option, .answer-choice, .chip, .word-chip').length;
}

export function auditRenderedDom(q,root){
  const findings=[];
  const domText=text(root?.textContent);
  if(!root) return [{severity:AUDIT_STATUS.FAIL,code:'NO_RENDER_ROOT',message:'Renderer did not receive a DOM root.'}];
  if(/undefined|null|\[object Object\]/i.test(domText))add(findings,AUDIT_STATUS.FAIL,'DOM_LEAKED_VALUE','Rendered UI exposes undefined/null/object placeholder text.');
  if(q.form!=='learn'&&q.form!=='unsupported'&&interactiveCount(root)===0){
    add(findings,AUDIT_STATUS.FAIL,'NO_ANSWER_CONTROL','Renderer produced no detectable answer control.');
  }
  if(!root.children.length)add(findings,AUDIT_STATUS.FAIL,'EMPTY_RENDER','Renderer produced an empty container.');
  return findings;
}

export function summarizeAudit(findings){
  if(findings.some(f=>f.severity===AUDIT_STATUS.FAIL))return AUDIT_STATUS.FAIL;
  if(findings.some(f=>f.severity===AUDIT_STATUS.WARNING))return AUDIT_STATUS.WARNING;
  return AUDIT_STATUS.PASS;
}

export async function auditQuestion(q,QuestionRenderer){
  const findings=auditStructure(q);
  const host=document.createElement('div');
  host.style.cssText='position:fixed;left:-100000px;top:-100000px;width:900px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(host);
  try{
    const renderer=new QuestionRenderer(host).render(q,{});
    findings.push(...auditRenderedDom(q,host));
    if(renderer&&typeof renderer.destroy==='function')renderer.destroy();
  }catch(error){
    add(findings,AUDIT_STATUS.FAIL,'RENDER_EXCEPTION',text(error?.message||error||'Renderer threw an exception.'));
  }finally{
    host.remove();
  }
  return {status:summarizeAudit(findings),findings};
}

export async function auditQuestions(questions,QuestionRenderer,{onProgress,yieldEvery=25}={}){
  const results=new Map();
  for(let i=0;i<questions.length;i++){
    const q=questions[i];
    results.set(String(q.id),await auditQuestion(q,QuestionRenderer));
    if(onProgress)onProgress(i+1,questions.length,results.get(String(q.id)),q);
    if(yieldEvery&&(i+1)%yieldEvery===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return results;
}
