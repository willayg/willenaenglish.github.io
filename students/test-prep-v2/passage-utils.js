const DOT='\uE000';

const ABBREVIATIONS=[
  'dr.','mr.','mrs.','ms.','prof.','st.','jr.','sr.',
  'a.m.','p.m.','e.g.','i.e.','u.s.','u.k.'
];

function protectToken(text,token){
  const escaped=token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return text.replace(new RegExp(escaped,'gi'),m=>m.replace(/\./g,DOT));
}

export function protectSentenceDots(value){
  let text=String(value??'');
  for(const abbr of ABBREVIATIONS)text=protectToken(text,abbr);
  text=text.replace(/(?<=\d)\.(?=\d)/g,DOT);
  text=text.replace(/\b([A-Z])\.(?=\s+[A-Z][a-z])/g,(_,letter)=>`${letter}${DOT}`);
  return text;
}

export function restoreSentenceDots(value){
  return String(value??'').replaceAll(DOT,'.');
}

export function splitSentences(value){
  const protectedText=protectSentenceDots(value)
    .replace(/\s+/g,' ')
    .trim();
  if(!protectedText)return[];
  return protectedText
    .split(/(?<=[.!?])\s+(?=["“‘'([{]*[A-Z0-9])/)
    .map(restoreSentenceDots)
    .map(s=>s.trim())
    .filter(Boolean);
}

export const SENTENCE_ABBREVIATIONS=Object.freeze([...ABBREVIATIONS]);
