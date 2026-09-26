// Speaking-only transcript matching.
// Keep this conservative: compensate for common browser STT slips without treating different words as generally equivalent.

const NUMBER_WORDS={
  '0':'zero','1':'one','2':'two','3':'three','4':'four','5':'five','6':'six','7':'seven','8':'eight','9':'nine','10':'ten',
  '11':'eleven','12':'twelve','13':'thirteen','14':'fourteen','15':'fifteen','16':'sixteen','17':'seventeen','18':'eighteen','19':'nineteen','20':'twenty'
};
const ORDINAL_WORDS={
  '1':'first','2':'second','3':'third','4':'fourth','5':'fifth','6':'sixth','7':'seventh','8':'eighth','9':'ninth','10':'tenth',
  '11':'eleventh','12':'twelfth','13':'thirteenth','14':'fourteenth','15':'fifteenth','16':'sixteenth','17':'seventeenth','18':'eighteenth','19':'nineteenth','20':'twentieth'
};
const HOMOPHONE_GROUPS=[
  ['new','knew'],
  ['one','won'],
  ['two','to','too'],
  ['four','for'],
  ['eight','ate'],
  ['see','sea'],
  ['sun','son'],
  ['no','know'],
  ['here','hear'],
  ['right','write','rite']
];

function normalizeNumberToken(token){
  const ordinal=token.match(/^(\d+)(?:st|nd|rd|th)$/);
  if(ordinal&&ORDINAL_WORDS[ordinal[1]])return ORDINAL_WORDS[ordinal[1]];
  if(NUMBER_WORDS[token])return NUMBER_WORDS[token];
  return token;
}

function normalize(value){
  return String(value??'').toLowerCase()
    .replace(/[’‘]/g,"'")
    .replace(/[-–—]/g,' ')
    .replace(/[^a-z0-9' ]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .split(' ')
    .map(normalizeNumberToken)
    .join(' ');
}

function homophoneVariant(a,b){
  const left=normalize(a),right=normalize(b);
  if(!left||!right)return false;
  const aw=left.split(' '),bw=right.split(' ');
  if(aw.length!==bw.length)return false;
  const equivalent=(x,y)=>x===y||HOMOPHONE_GROUPS.some(group=>group.includes(x)&&group.includes(y));
  return aw.every((word,index)=>equivalent(word,bw[index]));
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

  // Normalize common English spelling patterns before phonetic encoding.
  word=word
    .replace(/^(?:kn|gn|pn)/,'n')
    .replace(/^wr/,'r')
    .replace(/^wh/,'w')
    .replace(/mb$/,'m')
    .replace(/gh/g,'')
    .replace(/ph/g,'f')
    .replace(/ck/g,'k')
    .replace(/qu/g,'kw')
    .replace(/tch/g,'ch')
    .replace(/dge/g,'j');

  if(word.length>3)word=word.replace(/e$/,'');

  const first=word[0];
  const code=ch=>{
    if(/[bfpv]/.test(ch))return'1';
    if(/[cgjkqsxz]/.test(ch))return'2';
    if(/[dt]/.test(ch))return'3';
    if(ch==='l')return'4';
    if(/[mn]/.test(ch))return'5';
    if(ch==='r')return'6';
    return'';
  };

  let out=first;
  let previous=code(first);
  for(let i=1;i<word.length;i++){
    const current=code(word[i]);
    if(current&&current!==previous)out+=current;
    previous=current;
    if(out.length>=4)break;
  }
  return (out+'000').slice(0,4);
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

  const homophone=heard.find(item=>homophoneVariant(item.normalized,wanted));
  if(homophone)return{correct:true,matchedBy:'homophone',transcript:homophone.raw};

  const plural=heard.find(item=>pluralVariant(item.normalized,wanted));
  if(plural)return{correct:true,matchedBy:'singular_plural',transcript:plural.raw};

  const finalMN=heard.find(item=>finalMNVariant(item.normalized,wanted));
  if(finalMN)return{correct:true,matchedBy:'final_m_n',transcript:finalMN.raw};

  const phonetic=heard.find(item=>phoneticVariant(item.normalized,wanted));
  if(phonetic)return{correct:true,matchedBy:'phonetic',transcript:phonetic.raw};

  return{correct:false,matchedBy:null,transcript:heard[0].raw};
}

export {normalize as normalizeSpeakingText};
