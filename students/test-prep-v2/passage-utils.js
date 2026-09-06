const DOT='\uE000';

export function protectSentenceDots(value){
  let s=String(value||'');
  s=s.replace(/\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr)\./gi,(_,a)=>`${a}${DOT}`);
  s=s.replace(/\b(e\.g|i\.e|a\.m|p\.m|U\.S|U\.K)\./gi,m=>m.replace(/\./g,DOT));
  s=s.replace(/(\d)\.(\d)/g,`$1${DOT}$2`);
  s=s.replace(/\b([A-Z])\.(?=\s+[A-Z][a-z])/g,(_,a)=>`${a}${DOT}`);
  return s;
}

export function restoreSentenceDots(value){
  return String(value||'').split(DOT).join('.');
}

export function splitSentences(value){
  const safe=protectSentenceDots(value),parts=safe.match(/[^.!?]+[.!?]+(?:["'”’])?|[^.!?]+$/g)||[];
  return parts.map(x=>restoreSentenceDots(x.trim())).filter(Boolean);
}

export function splitPassageSentences(body,title='',passageId='',translations=[]){
  const out=[];let sentenceIndex=0;
  for(let line of String(body||'').split(/\n+/).map(x=>x.trim()).filter(Boolean)){
    if(/^(Situation\s+\d+|D-?\d+|D-Day)$/i.test(line)||/^What will happen next\?/i.test(line)||/^(Dear\s+.+,|Hi\s+.+,|Love,?|Best,?|Your friend,?|Uncle Jay|Amy|Minji)$/i.test(line))continue;
    line=line.replace(/^(D-?\d+|D-Day)\s+/i,'');
    let speaker='';const m=line.match(/^([A-Za-z][A-Za-z .'-]{0,24}):\s*(.+)$/);if(m){speaker=m[1];line=m[2]}
    const parts=splitSentences(line);
    parts.filter(x=>x&&/[A-Za-z]/.test(x)).forEach((text,partIndex)=>{
      out.push({text,ko:String(translations[sentenceIndex]||''),speaker,passageTitle:title,passageId,partIndex,sentenceIndex});sentenceIndex++;
    });
  }
  return out;
}

export const SENTENCE_ABBREVIATIONS=Object.freeze(['Mr.','Mrs.','Ms.','Dr.','Prof.','St.','Jr.','Sr.','e.g.','i.e.','a.m.','p.m.','U.S.','U.K.']);
