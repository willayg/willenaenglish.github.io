// Spelling-only target cleanup.
// Keep lexical entries unchanged; these rules only decide what students type in spelling activities.

const tidy=value=>String(value??'').replace(/\s+/g,' ').trim();

export function getSpellingTarget(raw){
  let text=tidy(raw);
  if(!text)return null;

  // A blank standing in for a possessive/name is not a useful standalone spelling target.
  // Example: "_____s house"
  if(/^_{2,}\s*['’]?s\b/i.test(text))return null;

  // Remove worksheet/grammar placeholders such as "__ing", "___ed", or a bare blank.
  text=text.replace(/_{2,}\s*(?:ing|ed|s)?\b/gi,' ');
  text=text.replace(/_{2,}/g,' ');

  // Tildes are worksheet notation, not part of the English spelling target.
  text=text.replace(/[~～]+/g,'');

  text=tidy(text);

  // If placeholder notation survived, skip rather than guess.
  if(!text||text.includes('_'))return null;

  return text;
}
