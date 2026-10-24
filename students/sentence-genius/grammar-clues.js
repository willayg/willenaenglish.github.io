// Sentence Genius sentence-level grammar clues.
// Show only genuinely useful structural information before the first attempt.
// Don't guess a target from shared pattern links or expose the whole sentence.
export const GRAMMAR_CLUE_REVISION='1.1.0';

const koShortReply=/^(?:네|예|응|아니요|아뇨|아니)(?=[\s,，.!?]|$)/;
const auxiliaries=new Set(['is','are','am','was','were','do','does','did',
  'can','could','will','would','have','has','had','should','may','might','must']);
const expandedNegatives={
  "isn't":'is',"aren't":'are',"wasn't":'was',"weren't":'were',
  "don't":'do',"doesn't":'does',"didn't":'did',
  "can't":'can',"couldn't":'could',"won't":'will',
  "wouldn't":'would',"haven't":'have',"hasn't":'has',
  "hadn't":'had',"shouldn't":'should'
};

const numberInfo={is:'단수 · singular',was:'단수 · singular',
  are:'복수 · plural',were:'복수 · plural'};
const grammarInfo={am:'be동사',do:'현재형',does:'3인칭 단수',
  did:'과거형',can:'능력 / 가능',could:'가능 / 요청',will:'미래',
  would:'조동사',have:'현재완료 / have',has:'3인칭 단수',
  had:'과거 / had',should:'조언',may:'허가 / 가능',might:'가능성',must:'의무'};

export function grammarClueFor(item){
  const english=String(item?.en||'').replace(/[’‘]/g,"'").trim();
  const korean=String(item?.ko||'').trim();
  if(!english||!korean)return null;

  // Uncontextualized Korean yes/no replies often don't specify singular/
  // plural or an English auxiliary, so a student cannot infer the target.
  if(koShortReply.test(korean)){
    const reply=english.match(/^(?:yes|no)\s*,?\s+(there|i|you|he|she|it|we|they)\s+([a-z']+)(?:\s+not)?[.!?]?$/i);
    if(reply){
      const word=reply[2].toLowerCase();
      const auxiliary=expandedNegatives[word]||word;
      if(auxiliaries.has(auxiliary)){
        return {word:auxiliary,detail:numberInfo[auxiliary]||grammarInfo[auxiliary]||'조동사',
          source:'short_reply'};
      }
    }
  }

  // There-is/are translations frequently omit explicit English agreement.
  // Only show the be-verb form; never show the rest of the model answer.
  const existential=english.match(/^there\s+(is|are|was|were)\b/i);
  if(existential){
    const word=existential[1].toLowerCase();
    return {word,detail:numberInfo[word],source:'there_be'};
  }
  // Korean naturally drops a first-person subject. When no first-person
  // subject is supplied, speaking an "I" or "we" textbook line is a guess.
  // Supply only that word, not the rest of the answer. Do not run for short
  // yes/no answers, which already have their auxiliary hint above.
  const firstPerson=english.match(/^(I|We)\s+(?:am|have|had|will|can|could|do|don't|like|love|want|need|go|went|play|played|eat|ate|study|studied|read|saw|see|live|work|enjoy|think|know|feel|should|would)\b/i);
  const explicitFirstPerson=/(?:저희|우리|우린|우리가|우리는|저는|제가|저도|나도|나는|내가|난|전|나는요)/.test(korean);
  if(firstPerson&&!explicitFirstPerson){
    return {word:firstPerson[1].toLowerCase(),detail:'주어가 생략된 문장',label:'주어 · Subject',source:'omitted_first_person_subject'};
  }
  // Korean naturally omits subjects. For a first-person textbook target,
  // show the REQUIRED subject when the Korean line does not specify one.
  // Do not treat "I" and "we" as synonymous: they change meaning.
  const firstPerson=english.match(/^(I|We)\b(?=\s|[’']|$)/i);
  const koreanHasSubject=/(?:저는|제가|저희|우리는|우리가|우리|나는|내가|나의|저의)/.test(korean);
  if(firstPerson&&!koreanHasSubject){
    return {word:firstPerson[1].toLowerCase(),detail:'주어 · subject',
      label:'주어 힌트 · Use',source:'omitted_subject'};
  }
  return null;
}
