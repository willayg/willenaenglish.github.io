const n=v=>Number.isFinite(Number(v))?Number(v):0;
const pct=v=>Math.max(0,Math.min(100,Math.round(n(v))));

function rawPractice(plan,practice){return plan?.summary?.by_practice?.[practice]||{}}
function rawLessonPractice(plan,lesson,practice){return plan?.summary?.by_lesson_practice?.[`${lesson}||${practice}`]||{}}
function normalized(raw={}){
  return {
    attempts:n(raw.attempts??raw.total_attempts),
    unique:n(raw.unique??raw.unique_questions),
    correct:n(raw.correct??raw.correct_count),
    accuracy:pct(raw.accuracy),
    firstAttemptAccuracy:pct(raw.first_attempt_accuracy),
    correctionRate:pct(raw.correction_rate),
    activeTimeMs:n(raw.active_time_ms),
    unresolved:n(raw.unresolved_wrong_count??raw.unresolved)
  };
}
export function planStats(plan){
  const s=plan?.summary||{};
  return {...normalized(s),sessions:n(s.sessions),wrongNow:n(s.wrong_now??s.review_now),wrongLater:n(s.wrong_later??s.review_later),cleared:n(s.cleared_wrong??s.review_cleared)};
}
export function practiceStats(plan,practice){return normalized(rawPractice(plan,practice))}
export function lessonPracticeStats(plan,lesson,practice){return normalized(rawLessonPractice(plan,lesson,practice))}
export function lessonStats(plan,lesson){
  const practices=['vocabulary','vocab_test','communication','grammar','reading','constructed_response','sentences','performance'];
  return Object.fromEntries(practices.map(p=>[p,lessonPracticeStats(plan,lesson,p)]));
}
export function formatMetric(stat){return stat.unique?`${stat.unique}문제 · ${stat.accuracy}%`:'아직 시작하지 않음'}

// v2 rule: UI code does not calculate Test Prep metrics itself.
// When the dedicated stats endpoint lands, only this module should change.
