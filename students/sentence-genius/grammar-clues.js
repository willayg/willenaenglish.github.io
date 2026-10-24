// Sentence Genius sentence-level grammar clues.
// Show only genuinely useful structural information before the first attempt.
// Don't guess a target from shared pattern links or expose the whole sentence.
export const GRAMMAR_CLUE_REVISION='1.0.0';

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
  return null;
}
