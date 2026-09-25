// Speaking-only transcript matching.
// Keep this conservative: compensate for common browser STT slips without treating different words as generally equivalent.

function normalize(value){
  return String(value??'').toLowerCase()
    .replace(/[’‘]/g,"'")
    .replace(/[-–—]/g,' ')
    .replace(/[^a-z0-9' ]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function pluralVariant(a,b){
  if(a.includes(' ')||b.includes(' '))return false;
  if(a.length<3||b.length<3)return false;
  return a===b+'s'||b===a+'s';
}

function finalMNVariant(a,b){
  if(a.includes(' ')||b.includes(' ')||a.length<3||a.length!==b.length)return false;
  if(a.slice(0,-1)!==b.slice(0,-1))return false;
  const pair=a.slice(-1)+b.slice(-1);
  return pair==='mn'||pair==='nm';
}

export function isSpeakableTarget(target){
  const value=normalize(target);
  if(!value)return false;

  // Grammar fragments such as possessive "s" / "'s" are poor STT targets.
  if(/^(?:s|'s)$/.test(value))return false;

  // A single letter is too ambiguous for reliable browser speech recognition.
  if(/^[a-z]$/.test(value))return false;

  return true;
}

export function matchSpeakingTarget(target,transcripts){
  const wanted=normalize(target);
  const heard=(Array.isArray(transcripts)?transcripts:[transcripts])
    .map(value=>({raw:String(value??'').trim(),normalized:normalize(value)}))
    .filter(item=>item.normalized);

  if(!wanted||!heard.length)return{correct:false,matchedBy:null,transcript:heard[0]?.raw||''};

  const exact=heard.find(item=>item.normalized===wanted);
  if(exact)return{correct:true,matchedBy:'exact',transcript:exact.raw};

  const plural=heard.find(item=>pluralVariant(item.normalized,wanted));
  if(plural)return{correct:true,matchedBy:'singular_plural',transcript:plural.raw};

  const finalMN=heard.find(item=>finalMNVariant(item.normalized,wanted));
  if(finalMN)return{correct:true,matchedBy:'final_m_n',transcript:finalMN.raw};

  return{correct:false,matchedBy:null,transcript:heard[0].raw};
}

export {normalize as normalizeSpeakingText};
