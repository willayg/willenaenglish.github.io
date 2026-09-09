// TEST HARNESS ONLY. Audits canonical questions with the real V2 renderer.
// Fail is deliberately narrow: genuinely unusable canonical/render output only.

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
const answersFor=q=>Array.isArray(q?.answer)?q.answer:
  Array.isArray(q?.correctAnswer)?q.correctAnswer:
  Array.isArray(q?.correct_answer)?q.correct_answer:
  q?.correctAnswer!=null?[q.correctAnswer]:q?.correct_answer!=null?[q.correct_answer]:[];

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

  const answers=answersFor(q);
  if(q.form!=='learn'&&q.form!=='unsupported'&&answers.filter(v=>text(v).trim()).length===0){
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
  if(/undefined|null|\[object Object\]/i.test(hay))add(findings,AUDIT_STATUS.WARNING,'SUSPICIOUS_STORED_VALUE','Stored question data contains placeholder-like text; inspect visually.');

  if(q.form==='multipart'&&answers.length<2){
    add(findings,AUDIT_STATUS.WARNING,'MULTIPART_SINGLE_ANSWER','Multipart form has fewer than two canonical answer parts.');
  }
  if((q.form==='order'||q.form==='chunks'||q.form==='blanks')&&(!Array.isArray(q.chips)||q.chips.length===0)){
    add(findings,AUDIT_STATUS.FAIL,'EMPTY_CHIPS',`${q.form} form has no chips to interact with.`);
  }
  return findings;
}

function requiredControlCheck(q,root){
  const count=selector=>root.querySelectorAll(selector).length;
  const expectedAnswers=answersFor(q).filter(v=>text(v).trim()).length;

  if(q.form==='choice'||q.form==='multi'){
    const actual=count('[data-choice]');
    return actual>0?null:`Expected choice buttons; found ${actual}.`;
  }
  if(q.form==='write'){
    const actual=count('[data-write]');
    return actual===1?null:`Expected one written-answer control; found ${actual}.`;
  }
  if(q.form==='multipart'){
    const actual=count('[data-part]');
    return actual>0&&actual===expectedAnswers?null:`Expected ${expectedAnswers} multipart field(s); found ${actual}.`;
  }
  if(q.form==='correction'){
    const wrong=count('[data-wrong]'),right=count('[data-right]');
    return wrong>0&&wrong===expectedAnswers&&right===expectedAnswers?null:`Expected ${expectedAnswers} correction row(s); found ${wrong} wrong / ${right} right fields.`;
  }
  if(q.form==='identified_correction'){
    const label=count('[data-correction-label]'),wrong=count('[data-wrong]'),right=count('[data-right]');
    return label>0&&label===expectedAnswers&&wrong===expectedAnswers&&right===expectedAnswers?null:`Expected ${expectedAnswers} identified-correction row(s); found ${label} labels / ${wrong} wrong / ${right} right fields.`;
  }
  if(q.form==='order'||q.form==='chunks'||q.form==='blanks'){
    const chips=count('[data-chip]'),build=count('[data-build]');
    return chips>0&&build===1?null:`Expected interactive chips/build area; found ${chips} chip(s), ${build} build area(s).`;
  }
  return null;
}

export function auditRenderedDom(q,root){
  const findings=[];
  if(!root)return [{severity:AUDIT_STATUS.FAIL,code:'NO_RENDER_ROOT',message:'Renderer did not receive a DOM root.'}];
  if(!root.children.length)add(findings,AUDIT_STATUS.FAIL,'EMPTY_RENDER','Renderer produced an empty container.');

  const domText=text(root.textContent);
  if(/undefined|null|\[object Object\]/i.test(domText))add(findings,AUDIT_STATUS.WARNING,'DOM_SUSPICIOUS_TEXT','Rendered UI exposes placeholder-like text; inspect visually.');

  if(q.form!=='learn'&&q.form!=='unsupported'){
    const problem=requiredControlCheck(q,root);
    if(problem)add(findings,AUDIT_STATUS.FAIL,'REQUIRED_CONTROL_MISSING',problem);
  }
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
