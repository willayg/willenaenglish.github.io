# Time Battle v2 – Design & Implementation Spec

Date: 2025-09-25
Owner: Word Arcade
Status: Draft (ready to implement)

## Overview
Upgrade Time Battle to be larger, more responsive, and more engaging. Each game lasts 35 seconds and cycles through a mix of question types:
- Korean → English (multiple choice)
- English → Korean (multiple choice)
- Korean Word (listen to audio, then answer)
- Listen and choose the right Korean translation (audio prompt → Korean choices)
- Spelling mode (type English word)

Additional requirements:
- Scoring: Spelling awards 1 in‑game point per correct letter typed.
- User name: Leaderboard should display the signed-in user’s real name, not "Player".
- Feedback: Green/red highlights and sound effects (correct/wrong) like other multi‑choice games.
- Replay: Allow players to replay at the end easily.

## Goals and Success Criteria
- UI scales up on large screens, remains comfortable on tablets/phones.
- A single 35s round mixes question types fairly across the available words.
- Score increments properly across modes, including per-letter scoring in Spelling.
- Leaderboard shows real display names for signed‑in users.
- Immediate, satisfying feedback (color + SFX) on each answer.
- End screen offers Replay and shows the live leaderboard for the session/round.

## Game Flow (single 35s round)
1. Start: Show big, legible header and timer (35s), score, and round info.
2. Question loop: Present one question at a time from a rotating mix of types. After user answers, instantly give visual + audio feedback and move to the next.
3. Timer end: Stop accepting input; submit score via `/.netlify/functions/timer_score`.
4. Leaderboard: Fetch and show current top scores for this session+round.
5. Replay: Offer "Play again" to start a new round (same session_id, incremented round number).

## Question Types
- K→E Multiple Choice: Prompt shows Korean; 4 English choices (1 correct + 3 distractors).
- E→K Multiple Choice: Prompt shows English; 4 Korean choices.
- Korean Word (Listening): Play audio for the English word; show Korean choices; user selects the correct Korean.
- Listen → Korean Translation: Same as above; treat as explicit Listen mode (alias of the above, shared implementation).
- Spelling (English): Play audio or show Korean prompt; user types the English word.

Distribution strategy (per round):
- Evenly rotate types: [K→E, E→K, Listening→K, Spelling] repeating.
- Skip types that lack prerequisites (e.g., listening modes skip words missing audio; filter ahead of time).
- Ensure each word can appear multiple times across rounds; shuffle the word list lightly once and cycle.

## Scoring
- Multiple Choice (K→E, E→K, Listening→K): +1 point per correct answer, 0 otherwise.
- Spelling: +1 point per correct letter typed, defined as:
  - Compare final submitted answer to the correct English word, case‑insensitive.
  - Score equals the count of positions where characters match up to the shorter length.
  - Optional bonus (deferred): +2 bonus for fully correct word. (Not enabled initially.)
- Sound effects: On correct → `playSFX('correct')`; on wrong → `playSFX('wrong')`.
- Visual feedback: Apply green/red highlight classes for the chosen option (and correct answer) consistent with other multi‑choice modes.

Notes:
- Scoring granularity is kept simple to fit 35s pacing.
- We retain the server’s "best score per user" upsert semantics.

## Timer & Rounds
- Duration: 35 seconds per game.
- Session & rounds:
  - `session_id`: remains tied to the live session created by the teacher.
  - `round`: increment per replay within the same session.
- Leaderboard: Rankings fetched per `(session_id, round)`.

## Replay UX
- After leaderboard appears, show 2 primary buttons:
  - "Replay this round" → starts the next round using the same session_id, `round+1`.
  - "Back to menu" → returns to mode selector or dismisses overlay (depending on entry point).

## Larger, Responsive UI
General style guidelines for Time Battle screens:
- Container: width up to 860–1024px on desktop, with generous padding and card styling.
- Typography: ~1.1–1.4rem headers; 1.0–1.2rem body and button text on desktop.
- Buttons: min height ~52–60px on desktop; touch targets ≥44px on mobile.
- Grid for choices: 2 columns on phones; 2–3 columns on tablets; up to 2 columns with larger cells on desktop for readability.
- Breakpoints:
  - ≤480px (mobile): compact spacing; font scaling 0.95x.
  - 481–768px (small tablet): medium spacing; 2-col grid; font 1.0x.
  - 769–1200px (large tablet/laptop): larger padding; font 1.1x.
  - ≥1201px (desktop/large): widest container; font 1.2–1.25x.
- CSS custom properties (examples):
  - `--tb-container-max: 980px;`
  - `--tb-choice-min-h: 64px;`
  - `--tb-font-scale: 1.15;`
- Visual feedback:
  - Correct: add `.is-correct` → green border/background.
  - Wrong: add `.is-wrong` → red border/background; also reveal correct choice.

## Name Resolution (Leaderboard)
Show the user’s real name instead of "Player". Server should resolve a good display name via Supabase using sb_access cookie.
Resolution order (recommended):
1. profiles.display_name
2. profiles.full_name
3. profiles.first_name + ' ' + profiles.last_name (if both exist)
4. profiles.username
5. auth user metadata: `user.user_metadata.full_name` or `user.email`
6. Fallback: "Player"

Server should store the resolved name with each upsert (still safe; not authoritative) to avoid heavy joins on reads.

## API Contracts
- Submit score
  - POST `/.netlify/functions/timer_score`
  - Body: `{ session_id: string, round: number, score: number }`
  - Auth: cookie (`sb_access`) required
  - Response: `{ success: true, entry: { session_id, round, user_id, name, score } }`

- Get leaderboard
  - GET `/.netlify/functions/timer_score?session_id=...&round=...&limit=10`
  - Response: `{ success: true, leaderboard: Array<{ user_id, name, score, created_at, updated_at }> }`

## Files to Update (Implementation Plan)
- `Games/Word Arcade/modes/time_battle.js`
  - Increase UI sizes and move to responsive container with CSS variables and breakpoints.
  - Implement question rotation and filtering per mode type.
  - Add SFX + green/red highlight classes; advance after brief delay.
  - Timer: 35 seconds. Round increments on replay.
  - Spelling: compute per-letter score on submit; add to total.
  - End: submit score, show leaderboard modal with Replay button.

- `Games/Word Arcade/sfx.js`
  - Reuse existing keys: `correct`, `wrong`, `end`, `begin-the-game`.

- `netlify/functions/timer_score.js`
  - Enhance display name resolution (use additional profile fields and user metadata email) before fallback to "Player".

- (Optional) Shared styles
  - Add a small `time_battle.css` or inline style block with CSS vars; keep idempotent injection.

## Edge Cases & Handling
- Missing audio: Listening modes skip words lacking audio; MCQ and Spelling continue.
- Very short words in Spelling: scoring still per-letter; no special-casing required.
- Authentication failure: show login prompt; skip score submission.
- Small word lists: ensure distractors do not duplicate the correct answer; if fewer than 4 unique words exist, reduce choices gracefully.

## Acceptance Tests
- On a large desktop screen, buttons and text are comfortably large; choices are easy to click.
- A 35-second timer runs and stops; no input accepted after 0.
- You encounter each of the four question types at least once in a typical round.
- Correct answers play the "correct" SFX and highlight green; wrong play "wrong" and show the correct option highlighted.
- Spelling adds the number of matching letters to the score; MCQ adds 1 per correct.
- Leaderboard shows your real name if your profile has display or full name; otherwise email; never shows "Player" for logged-in users with data.
- End screen has a working "Replay" that starts another round and posts scores to the next `round` number.

## Rollout
- Behind-the-scenes update; no new environment variables needed.
- Monitor error logs for `timer_score` name resolution.
- Once stable, enable Time Battle card broadly in the Create Game modal (already enabled).
