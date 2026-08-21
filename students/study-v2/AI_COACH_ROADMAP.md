# AI Coach V1 Roadmap

This is the locked build order for completing AI Coach V1 before starting the Teacher Tracker and Parent Tracker.

## Working rule

Work one numbered step at a time. Do not move to another step for polish or interesting extras unless a bug blocks the current step. Record side issues for later.

## Status

- [x] **1. Coach cleanup** — remove generic fallback behavior, duplicate capability ownership, legacy Coach prompt injection, duplicate level sources, and startup races. One controller owns Coach UI; one bootstrap owns first render; Coach recommendations use Study context for level.
- [x] **2. Stable recommendation engine** — combine global level, selected book/unit context, unit mastery and registered capabilities; rank every genuinely useful option without generic fallback padding. Weakness evidence comes from Study data rather than rendered DOM, so the same Study snapshot produces the same recommendation set/order.
- [x] **3. Student-history layer** — one `WillenaCoachHistory` service loads current-unit skill mastery, recent attempts, recurring misses, all content mastery, grammar concept mastery, morphology mastery/attempts, due/weak/secure signals and short-term accuracy trends. It reads only the signed-in student's RLS-protected rows, refreshes after new study/morphology/progress events, and is loaded before Coach recommendations. Existing weakness recommendations now consume this shared history instead of maintaining a separate progress fetch.
- [ ] **4. Study-section navigation** — implementation is now functionally complete and awaiting one final student tap-test before the checkbox is closed. `WillenaStudyNavigator` drives the existing book/unit/Book Study controls, maps skills to Vocabulary/Sentences/Grammar, waits for the destination unit to load, scrolls to the Study container top, and shows the Coach study-tip overlay. Generic Study actions no longer silently default to the open unit: routing now prefers specific grammar-concept links, real weak book/unit history, recent mistake location, then a current assigned unit only when that skill genuinely exists there. If no defensible destination exists, the Coach does not fabricate one.
- [ ] **5. Smart mistake diagnosis** — classify the actual rule behind errors such as -s, -es, y→ies, does + base verb, irregular past and participles.
- [ ] **6. Complete remediation loop** — mistake → explanation → small rule check when useful → retry only missed questions → explain persistent misses → success/reward.
- [ ] **7. Vocabulary Coach** — weak-word detection, meaning/form confusion, targeted study/practice and remediation.
- [ ] **8. Spelling Coach** — repeated spelling-pattern detection, targeted study/practice and remediation.
- [ ] **9. Listening Coach** — listening-history recommendations, targeted listening sets and useful remediation.
- [ ] **10. Grammar + sentence-building Coach** — concept-level targeting across grammar and sentence-building, including Study and Practice destinations.
- [ ] **11. Reading + conversation Coach** — reading-comprehension targeting and question-response/conversation practice.
- [ ] **12. English Arcade recommendations** — after the core skill Coaches are built, map their concepts/weaknesses to specific English Arcade activities and deep-link directly to the appropriate game (for example, some/any). Arcade should consume Coach intelligence rather than drive it.
- [ ] **13. Progress + points rules** — deliberately define what Coach study, practice, retries and Arcade play affect; prevent duplicate points or bogus unit/mastery progress.
- [ ] **14. Conversation/navigation UX** — smooth Coach → Study, Coach → Practice, Coach → Arcade and return flows; clear button/action types; rewards and mobile behavior.
- [ ] **15. Full QA pass** — test levels 1–8+, new and experienced students, first login, refresh, no-history cases, mistakes, perfect scores, retries, Korean/English, phone/tablet and navigation destinations.
- [ ] **16. Freeze Coach V1** — document capability, event, mastery, recommendation and navigation contracts so Teacher/Parent trackers can safely build on them.

## Stage 4 final QA checkpoint

What now works:

- Coach Study actions can switch assigned book/unit, enter Book Study, open the appropriate Vocabulary/Sentences/Grammar section, and scroll to the top of the Study container.
- Weak-area evidence retains real `book_id` + `unit_id`, so weak recommendations can name and open the actual source unit.
- Generic Study routing is evidence-based instead of context-bound. Routing order is: specific linked grammar concept when available → weakest real book/unit location → recent mistake location → currently assigned unit only if that skill exists there.
- Generic grammar Study can consume any specific `grammar_concepts` code that has `pattern_concepts` occurrences in the student's assigned books. An audit confirmed the useful specific concepts (third person, do/does, past, present perfect, comparatives, conditionals, passive, etc.) are linked; zero-link rows are mostly broad/duplicate umbrella concepts and are not given invented links.
- If no defensible Study location exists, no fake current-unit destination is created.
- Fresh wrong Coach answers now retain `book_id` + `unit_id` when their activity has that context, allowing recent mistakes to become Study-routing evidence immediately.
- Study landing guidance is a prominent Coach overlay with skill-specific instructions, Coach SVG, tap-to-dismiss behavior, ~8.5 second lifetime, and the temporary 8-bit visual treatment.
- Study V2 language preference persists across reloads.

Final Stage 4 test before checking complete:

- Open a generic weak-area Study action while a **different book/unit is currently selected**. Confirm the Coach changes to the evidence-backed destination rather than staying in the open unit.
- Test one grammar weakness with a specific concept and confirm it opens the linked grammar unit/pattern when available.
- Test one non-grammar weakness (vocabulary, sentence building or listening) and confirm it opens the evidence-backed book/unit and correct Study section.

Cross-unit Practice remains deliberately separate. Study navigation may change book/unit from evidence; the existing Practice provider still uses its current-unit contract. Do not imply cross-unit Practice works until it is deliberately implemented in a later Coach step.

## Coach action types

The architecture should support these destinations without assuming every action is a multiple-choice quiz:

- **Study** — open the relevant Study content on the page.
- **Practice** — launch targeted practice through the shared activity engine.
- **Arcade** — open the exact recommended English Arcade activity.
- **Speak** — reserved for the upcoming Speaking system.

## Visual teaching cards — planned, not a Stage 4 detour

Coach responses should eventually support reusable visual teaching cards alongside text and actions instead of relying on text-only explanations. Keep the response/action architecture open to a future `cards` array, but do not build the full card system during Stage 4.

Planned reusable card types:

- **Rule / contrast table** — e.g. `I/you/we/they play` vs `he/she/it plays`, `do` vs `does`, `some` vs `any`.
- **Mistake / correction card** — e.g. `Does he plays?` → `Does he play?`.
- **Study-path card** — concise Study → Practice → Arcade guidance where useful.

Likely build points:

- Stage 4 may use only a simple Study-path presentation if navigation needs it.
- Stages 5–6 add mistake/correction and remediation cards.
- Stage 10 adds the broader grammar/sentence-building rule and contrast card library.
- Stage 14 polishes the common visual-card renderer and mobile behavior.

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
