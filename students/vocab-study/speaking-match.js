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

function phoneticWordKey(value){
  let word=normalize(value);
  if(!word||word.includes(' ')||word.length<3)return'';

  // Common silent initials / endings and stable English sound groups.
  word=word
    .replace(/^(?:kn|gn|pn)/,'n')
    .replace(/^wr/,'r')
    .replace(/mb$/,'m')
    .replace(/(?:ight)/g,'It')
    .replace(/(?:igh)/g,'I')
    .replace(/gh/g,'')
    .replace(/ph/g,'f')
    .replace(/ck/g,'k')
    .replace(/qu/g,'kw')
    .replace(/tch/g,'ch')
    .replace(/dge/g,'j')
    .replace(/tion/g,'shun')
    .replace(/sion/g,'zhun')
    .replace(/ower/g,'Aur')
    .replace(/our/g,'Aur')
    .replace(/ou(?=r)/g,'O')
    .replace(/ee|ea/g,'E')
    .replace(/oa/g,'O')
    .replace(/oo/g,'U')
    .replace(/ai|ay/g,'A')
    .replace(/oi|oy/g,'Y')
    .replace(/au|aw/g,'W');

  // A final silent e should not distinguish otherwise matching pronunciations.
  if(word.length>3)word=word.replace(/e$/,'');

  // Preserve a coarse vowel sound class instead of deleting all vowels.
  word=word
    .replace(/[a]/g,'A')
    .replace(/[e]/g,'E')
    .replace(/[i]/g,'I')
    .replace(/[o]/g,'O')
    .replace(/[u]/g,'U')
    .replace(/c(?=[EIY])/g,'s')
    .replace(/c/g,'k')
    .replace(/x/g,'ks')
    .replace(/q/g,'k')
    .replace(/(.)\1+/g,'$1');

  return word.toLowerCase();
}

function phoneticVariant(a,b){
  const left=normalize(a),right=normalize(b);
  if(!left||!right)return false;
  const leftWords=left.split(' '),rightWords=right.split(' ');
  if(leftWords.length!==rightWords.length)return false;
  return leftWords.every((word,index)=>{
    const other=rightWords[index];
    const aKey=phoneticWordKey(word),bKey=phoneticWordKey(other);
    return !!aKey&&aKey===bKey;
  });
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

  const phonetic=heard.find(item=>phoneticVariant(item.normalized,wanted));
  if(phonetic)return{correct:true,matchedBy:'phonetic',transcript:phonetic.raw};

  return{correct:false,matchedBy:null,transcript:heard[0].raw};
}

export {normalize as normalizeSpeakingText};
