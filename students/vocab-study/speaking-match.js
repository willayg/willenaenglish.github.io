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
  // Target-aware STT corrections for words and phrases actually in Word Genius.
  // These are only used for speaking recognition, never for spelling.
  ['by','bye','buy'],
  ['blue','blew'],
  ['flower','flour'],
  ['night','knight'],
  ['wear','where'],
  ['our','hour'],
  ['pear','pair'],
  ['plane','plain'],
  ['there','their',"they're"],
  ['be','bee','b'],
  ['break','brake'],
  ['new','knew'],
  ['one','won'],
  ['two','to','too'],
  ['four','for'],
  ['eight','ate'],
  ['see','sea'],
  ['sun','son'],
  // /soʊ/: AI transcription can choose 'so' for spoken 'sew'.
  // Deliberately exclude 'sow': as a noun it is also pronounced /saʊ/.
  ['sew','so'],
  ['no','know'],
  ['here','hear'],
  ['right','write','rite'],
  // Short isolated words are especially susceptible to STT spelling ambiguity.
  ['high','hi'],
  ['eye','i'],
  ['meat','meet'],
  ['week','weak'],
  ['peace','piece'],
  ['hole','whole'],
  ['way','weigh'],
  ['wait','weight'],
  ['tail','tale'],
  ['mail','male'],
  ['sail','sale'],
  ['dear','deer'],
  ['fair','fare'],
  ['stair','stare'],
  ['pain','pane'],
  ['rain','rein','reign'],
  ['road','rode','rowed'],
  ['threw','through'],
  ['allowed','aloud'],
  ['weather','whether'],
  ['would','wood'],
  ['some','sum'],
  ['cent','sent','scent'],
  ['steal','steel']
];

function normalizeNumberToken(token){
  const ordinal=token.match(/^(\d+)(?:st|nd|rd|th)$/);
  if(ordinal&&ORDINAL_WORDS[ordinal[1]])return ORDINAL_WORDS[ordinal[1]];
  if(NUMBER_WORDS[token])return NUMBER_WORDS[token];
  return token;
}

function normalize(value){
  return String(value??'').toLowerCase()
    // STT cannot reliably choose written apostrophes (Tim's / Tims).
    // Apply symmetrically to target and transcript; spelling stays strict.
    .replace(/['’‘ʼ＇]/g,'')
    .replace(/[-–—]/g,' ')
    .replace(/[^a-z0-9' ]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .split(' ')
    .map(normalizeNumberToken)
    .join(' ');
}

function compact(value){
  return normalize(value).replace(/\s+/g,'');
}

function homophoneVariant(a,b){
  const left=normalize(a),right=normalize(b);
  if(!left||!right)return false;
  const aw=left.split(' '),bw=right.split(' ');
  if(aw.length!==bw.length)return false;
  const equivalent=(x,y)=>x===y||HOMOPHONE_GROUPS.some(group=>group.some(word=>normalize(word)===x)&&group.some(word=>normalize(word)===y));
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


// Target-aware numeric recognition; never applied to spelling.
const SMALL='zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS='twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
const NUM=new Map([...SMALL.map((w,i)=>[w,i]),...TENS.map((w,i)=>[w,(i+2)*10])]);
const NUM_SOUND={oh:'zero',o:'zero',won:'one',too:'two',to:'two',for:'four',ate:'eight'};
const SCALE={thousand:1000,million:1000000,billion:1000000000,trillion:1000000000000};
const ORD=new Map(Object.entries(ORDINAL_WORDS).map(([n,w])=>[w,Number(n)]));
for(const [w,n] of [['thirtieth',30],['fortieth',40],['fiftieth',50],['sixtieth',60],['seventieth',70],['eightieth',80],['ninetieth',90],['hundredth',100],['thousandth',1000],['millionth',1000000]])ORD.set(w,n);
function numText(raw){
  return String(raw??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'")
    .replace(/\b([ap])\s*\.?\s*m\.?(?=\s|$)/g,'$1m')
    .replace(/(\d),(?=\d{3}(?:\D|$))/g,'$1').replace(/[-–—]/g,' ')
    .replace(/[!?,]+$/,'').replace(/\.(?=\s|$)/g,'').replace(/\s+/g,' ').trim();
}
function cardinal(raw,sounds=false){
  const s=numText(raw);
  if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);
  if(!s)return null;
  const words=s.split(' ').map(w=>sounds?(NUM_SOUND[w]||w):w);
  if(words.length===1&&words[0]==='hundred')return 100;
  if(words.length===1&&Object.hasOwn(SCALE,words[0]))return SCALE[words[0]];
  const dot=words.indexOf('point');
  if(dot>0){
    const head=cardinal(words.slice(0,dot).join(' ')),tail=words.slice(dot+1).map(w=>NUM.get(w)??(/^\d$/.test(w)?Number(w):NaN));
    return head!==null&&tail.length&&tail.every(n=>Number.isInteger(n)&&n>=0&&n<10)?Number(head+'.'+tail.join('')):null;
  }
  let total=0,part=0,last='start',scale=Infinity,seen=false;
  for(let i=0;i<words.length;i++){
    const w=words[i];
    if(w==='and'&&seen&&['hundred','scale'].includes(last)&&i<words.length-1)continue;
    const n=NUM.get(w);
    if(n!==undefined){
      if(last==='small'||(last==='tens'&&(n<1||n>9)))return null;
      part+=n;last=n>=20?'tens':'small';seen=true;continue;
    }
    if(w==='a'&&['hundred',...Object.keys(SCALE)].includes(words[i+1])&&last==='start'){part=1;last='small';seen=true;continue;}
    if(w==='hundred'&&last==='small'&&part>=1&&part<=9){part*=100;last='hundred';continue;}
    const f=Object.hasOwn(SCALE,w)?SCALE[w]:null;
    if(f&&part>0&&f<scale){total+=part*f;part=0;last='scale';scale=f;continue;}
    return null;
  }
  return seen&&Number.isSafeInteger(total+part)?total+part:null;
}
function ordinal(raw){
  const s=numText(raw),m=s.match(/^(\d+)(?:st|nd|rd|th)$/);
  if(m)return Number(m[1]);
  if(ORD.has(s))return ORD.get(s);
  const w=s.split(' '),n=ORD.get(w.pop());
  if(n===undefined||!w.length)return null;
  const p=cardinal(w.join(' '));
  if(n<10&&p!==null&&p>=20&&p%10===0)return p+n;
  if(n>=100&&p!==null)return p*n;
  return null;
}
function clock(raw,assisted=false){
  let s=numText(raw).replace(/^(?:it is|it's|its|at)\s+/,'').replace(/\s+(?:please|thanks)$/,'');
  let period=null;
  const suffix=s.match(/\s*(am|pm)$/);
  if(suffix){period=suffix[1];s=s.slice(0,suffix.index).trim();}
  const out=(h,m)=>Number.isInteger(h)&&Number.isInteger(m)&&h>=0&&h<=23&&m>=0&&m<=59&&(!period||(h>=1&&h<=12))?{h,m,period}:null;
  const num=v=>cardinal(v,assisted);
  let x=s.match(assisted?/^(\d{1,2})\s*[:.]\s*(\d{2})$/:/^(\d{1,2})\s*:\s*(\d{2})$/);
  if(x)return out(Number(x[1]),Number(x[2]));
  if(s==='noon'||s==='midday')return {h:12,m:0,period:'pm'};
  if(s==='midnight')return {h:12,m:0,period:'am'};
  x=s.match(/^(.+?)\s+(past|to)\s+(.+)$/);
  if(x){
    const p=x[1].replace(/^a\s+/,'').replace(/\s+minutes?$/,'');
    const m=p==='quarter'?15:p==='half'?30:num(p),h=num(x[3]);
    if(m!==null&&m>0&&m<60&&h!==null&&h>=1&&h<=12)return x[2]==='past'?out(h,m):out(h===1?12:h-1,60-m);
  }
  x=s.match(/^(.+?)\s+o\s*'?\s*clock$/);
  if(x)return out(num(x[1]),0);
  // A legitimate cardinal such as twenty one is not a clock target.
  if(!assisted&&!period&&num(s)!==null)return null;
  const w=s.split(' ');
  for(let i=1;i<w.length;i++){
    const h=num(w.slice(0,i).join(' '));
    if(h===null||h<1||h>(assisted?23:12))continue;
    let tail=w.slice(i).join(' ');
    if(/^(?:oh|o|zero|0)\s+/.test(tail))tail=tail.replace(/^(?:oh|o|zero|0)\s+/,'');
    let m=num(tail);
    if(m===null&&assisted){
      const digits=tail.split(' ').map(v=>num(v));
      if(digits.length===2&&digits.every(n=>n!==null&&n>=0&&n<=9))m=Number(digits.join(''));
    }
    if(m!==null&&m>=0&&m<60)return out(h,m);
  }
  if(assisted||period){
    if(/^\d{3,4}$/.test(s))return out(Number(s.slice(0,-2)),Number(s.slice(-2)));
    const digits=w.map(v=>num(v));
    if(digits.length>=3&&digits.length<=4&&digits.every(n=>n!==null&&n>=0&&n<=9)){
      const d=digits.join('');return out(Number(d.slice(0,-2)),Number(d.slice(-2)));
    }
    const h=num(s);if(h!==null&&h>=1&&h<=23)return out(h,0);
  }
  return null;
}
function clockEqual(a,b){
  if(!a||!b||a.m!==b.m)return false;
  const h=x=>x.h%12+(x.period==='pm'?12:x.period==='am'?0:x.h>=12?12:0);
  if(a.period&&b.period)return h(a)===h(b);
  if(a.period&&b.h>12)return h(a)===b.h;
  if(b.period&&a.h>12)return h(b)===a.h;
  if(a.h>12&&b.h>12)return a.h===b.h;
  return a.h%12===b.h%12;
}
function decade(raw){
  const s=numText(raw).replace(/^the\s+/,'');
  const d=s.match(/^(\d{3,4})'?s$/);if(d)return Number(d[1]);
  const p=s.match(/^(.+?)\s+hundreds$/);if(p){const n=cardinal(p[1]);if(n!==null)return n*100;}
  return null;
}
function signature(raw){
  const w=numText(raw).replace(/\b3d\b/g,'3 d').split(' '),parts=[],values=[];
  for(let i=0;i<w.length;){
    let found=null;
    for(let j=Math.min(w.length,i+12);j>i;j--){
      const p=w.slice(i,j).join(' '),o=ordinal(p),n=cardinal(p);
      if(o!==null||n!==null){found={end:j,key:(o!==null?'o:':'n:')+(o??n)};break;}
    }
    if(found){parts.push(found.key);values.push(found.key);i=found.end;}
    else{parts.push(w[i]);i++;}
  }
  return {parts,values};
}
// null = no numeric decision; false = different number; true = equivalent.
export function numericSpeakingMatch(target,transcript){
  const t=numText(target),r=numText(transcript);
  if(!t||!r)return null;
  const time=clock(t);
  if(time)return clockEqual(time,clock(r,true));
  const d=decade(t);if(d!==null)return decade(r)===d;
  const o=ordinal(t);if(o!==null)return ordinal(r)===o||(/^\d+$/.test(r)&&Number(r)===o);
  const n=cardinal(t);if(n!==null)return cardinal(r,true)===n;
  const a=signature(t),b=signature(r);
  if(!a.values.length)return null;
  if(a.parts.join('|')===b.parts.join('|'))return true;
  if(b.values.length&&a.values.join('|')!==b.values.join('|'))return false;
  return null;
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

  const numeric=heard.find(item=>numericSpeakingMatch(target,item.raw)===true);
  if(numeric)return{correct:true,matchedBy:'numeric_equivalent',transcript:numeric.raw};
  const eligible=heard.filter(item=>numericSpeakingMatch(target,item.raw)!==false);
  if(!eligible.length)return{correct:false,matchedBy:null,transcript:heard[0].raw};
  const exact=eligible.find(item=>item.normalized===wanted);
  if(exact)return{correct:true,matchedBy:'exact',transcript:exact.raw};

  const wantedCompact=compact(wanted);
  const spacing=eligible.find(item=>compact(item.normalized)===wantedCompact);
  if(spacing)return{correct:true,matchedBy:'spacing',transcript:spacing.raw};

  const homophone=eligible.find(item=>homophoneVariant(item.normalized,wanted));
  if(homophone)return{correct:true,matchedBy:'homophone',transcript:homophone.raw};

  // Word Genius accepts a clearly spoken target anywhere within a longer
  // sentence. Match full words (or consecutive words for a phrase), never
  // arbitrary substrings such as "bee" inside "beeline".
  const wantedWords=wanted.split(' ');
  const contained=eligible.find(item=>{
    const words=item.normalized.split(' ');
    return words.length>=wantedWords.length&&words.some((_,i)=>
      i+wantedWords.length<=words.length&&
      wantedWords.every((word,j)=>words[i+j]===word));
  });
  if(contained)return{correct:true,matchedBy:'in_sentence',transcript:contained.raw};

  const containedHomophone=eligible.find(item=>{
    const words=item.normalized.split(' ');
    return words.length>=wantedWords.length&&words.some((_,i)=>
      i+wantedWords.length<=words.length&&
      homophoneVariant(words.slice(i,i+wantedWords.length).join(' '),wanted));
  });
  if(containedHomophone)return{correct:true,matchedBy:'in_sentence_homophone',transcript:containedHomophone.raw};

  const plural=eligible.find(item=>pluralVariant(item.normalized,wanted));
  if(plural)return{correct:true,matchedBy:'singular_plural',transcript:plural.raw};

  const finalMN=eligible.find(item=>finalMNVariant(item.normalized,wanted));
  if(finalMN)return{correct:true,matchedBy:'final_m_n',transcript:finalMN.raw};

  const phonetic=eligible.find(item=>phoneticVariant(item.normalized,wanted));
  if(phonetic)return{correct:true,matchedBy:'phonetic',transcript:phonetic.raw};

  return{correct:false,matchedBy:null,transcript:heard[0].raw};
}

export {normalize as normalizeSpeakingText};
