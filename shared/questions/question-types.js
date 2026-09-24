// Universal Willena question form definitions.
// Extracted from Test Prep without changing behavior.
export const FORMS={choice:'choice',multi:'multi',write:'write',multipart:'multipart',correction:'correction',identifiedCorrection:'identified_correction',order:'order',chunks:'chunks',blanks:'blanks',learn:'learn',spellingCoach:'spelling_coach',unsupported:'unsupported'};

export function parseCorrection(value){
  const raw=String(value||'').trim(),m=raw.match(/^(.+?)\s*→\s*(.+)$/);
  if(!m)return null;
  let left=m[1].trim(),right=m[2].trim(),prefix='',label='';
  const pm=left.match(/^([①-⑳ⓐ-ⓩ]|\d+\s*:?)\s*(.+)$/u);
  if(pm&&pm[2]){prefix=pm[1].trim();left=pm[2].trim();label=prefix.replace(/:$/,'')}
  return{raw,wrong:left,right,prefix,label};
}
