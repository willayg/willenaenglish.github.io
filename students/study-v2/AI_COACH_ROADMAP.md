# AI Coach V1 Roadmap

This is the locked build order for completing AI Coach V1 before starting the Teacher Tracker and Parent Tracker.

## Working rule

Work one numbered step at a time. Do not move to another step for polish or interesting extras unless a bug blocks the current step. Record side issues for later.

## Status

- [x] **1. Coach cleanup** — remove generic fallback behavior, duplicate capability ownership, legacy Coach prompt injection, duplicate level sources, and startup races. One controller owns Coach UI; one bootstrap owns first render; Coach recommendations use Study context for level.
- [ ] **2. Stable recommendation engine** — combine level, current unit, mastery and available capabilities; rank every genuinely useful option without padding with generic fallback choices.
- [ ] **3. Student-history layer** — use recent attempts, recurring mistakes, morphology mastery, grammar mastery and skill mastery as Coach evidence.
- [ ] **4. Study-section navigation** — allow Coach actions to open/scroll to the correct Study section, book, unit or concept so a student can study before practicing.
- [ ] **5. English Arcade recommendations** — map Coach concepts/levels to specific English Arcade activities and deep-link directly to the appropriate game (for example, some/any).
- [ ] **6. Smart mistake diagnosis** — classify the actual rule behind errors such as -s, -es, y→ies, does + base verb, irregular past and participles.
- [ ] **7. Complete remediation loop** — mistake → explanation → small rule check when useful → retry only missed questions → explain persistent misses → success/reward.
- [ ] **8. Vocabulary Coach** — weak-word detection, meaning/form confusion, targeted study/practice and remediation.
- [ ] **9. Spelling Coach** — repeated spelling-pattern detection, targeted study/practice and remediation.
- [ ] **10. Listening Coach** — listening-history recommendations, targeted listening sets and useful remediation.
- [ ] **11. Grammar + sentence-building Coach** — concept-level targeting across grammar and sentence-building, including Study, Practice and Arcade destinations.
- [ ] **12. Reading + conversation Coach** — reading-comprehension targeting and question-response/conversation practice.
- [ ] **13. Progress + points rules** — deliberately define what Coach study, practice, retries and Arcade play affect; prevent duplicate points or bogus unit/mastery progress.
- [ ] **14. Conversation/navigation UX** — smooth Coach → Study, Coach → Practice, Coach → Arcade and return flows; clear button/action types; rewards and mobile behavior.
- [ ] **15. Full QA pass** — test levels 1–8+, new and experienced students, first login, refresh, no-history cases, mistakes, perfect scores, retries, Korean/English, phone/tablet and navigation destinations.
- [ ] **16. Freeze Coach V1** — document capability, event, mastery, recommendation and navigation contracts so Teacher/Parent trackers can safely build on them.

## Coach action types

The architecture should support these destinations without assuming every action is a multiple-choice quiz:

- **Study** — open the relevant Study content on the page.
- **Practice** — launch targeted practice through the shared activity engine.
- **Arcade** — open the exact recommended English Arcade activity.
- **Speak** — reserved for the upcoming Speaking system.

## Speaking-ready requirement

Do not build Speaking during Coach V1, but keep the architecture ready for it:

- capability/action types must not assume text or multiple-choice;
- history can later store pronunciation, fluency, completeness, confidence and teacher-review data;
- diagnosis is extensible to pronunciation and spoken-response quality;
- progress rules can distinguish speaking attempts from ordinary question attempts;
- Teacher Tracker should have room for speaking performance/review status;
- Parent Tracker should receive simplified speaking progress rather than raw analysis.

## After Coach V1

1. **Teacher Tracker** — student/class overview, units, skill mastery, recurring weaknesses, Coach interventions, recent activity, grammar/morphology concepts, students needing attention and progress over time.
2. **Parent Tracker** — simplified view of study activity, progress, strengths, current focus, streak/points, books/units and achievements.
