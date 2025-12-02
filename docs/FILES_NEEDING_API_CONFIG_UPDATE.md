# Files Needing API Config Migration

This document lists all files that contain direct `fetch('/.netlify/functions/...)` calls and need to be updated to use `WillenaAPI.fetch()` for cross-origin support (GitHub Pages → Netlify Functions).

## Migration Status

### ✅ Already Migrated
These files have been updated to use `WillenaAPI.fetch()`:
- `students/login.html`
- `students/dashboard.html`

### ⏳ Needs Migration (87 files)

#### Root Directory (7 files)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `debug-correct-count.html` | Yes | Low |
| `indexA.html` | Yes | Medium |
| `loginx.html` | Yes | High |
| `ocrtest.html` | Yes | Low |
| `playzone.html` | Yes | Medium |
| `profile-s.html` | Yes | Medium |
| `testpix.html` | Yes | Low |
| `test_student_verify.html` | Yes | Low |
| `test-pixabay_Version3.html` | Yes | Low |

#### Students Directory (3 files)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `students/components/student-header.js` | 9 calls | **Critical** |
| `students/profile.html` | 2 calls | High |
| `students/records.js` | 1 call | High |

#### JS Directory (2 files)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `js/highscores.js` | 2 calls | High |
| `js/testpix.html` | 1 call | Low |

#### Games Directory (19 files)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `Games/cutie_past_tense/cutie_past_tense.html` | 2 calls | Medium |
| `Games/cutie_past_tense/cutie_past_tense_old.html` | 2 calls | Low |
| `Games/Easy_word_game/Easy_word_game.html` | Yes | Medium |
| `Games/EB4/EB4.js` | Yes | Medium |
| `Games/english_arcade/index.html` | Yes | Medium |
| `Games/english_arcade/modes/sentence_mode.js` | Yes | Medium |
| `Games/english_arcade/modes/time_battle.js` | Yes | Medium |
| `Games/english_arcade/modes/word_sentence_mode.js` | Yes | Medium |
| `Games/english_arcade/play.html` | Yes | Medium |
| `Games/english_arcade/play-main.js` | Yes | Medium |
| `Games/ES6/ES6.js` | Yes | Medium |
| `Games/Fruti/Fruti.html` | Yes | Medium |
| `Games/game_templates/4_b_game.js` | Yes | Low |
| `Games/goblin_tag/goblin_tag.html` | 3 calls | Medium |
| `Games/JungleAnimalGame/JungleAnimalGame.html` | 2 calls | Medium |
| `Games/LG6/LG6.html` | 1 call | Medium |
| `Games/LG6/LG6.js` | 2 calls | Medium |
| `Games/Participles1/participles.js` | 2 calls | Medium |
| `Games/PastTenseGame/PastTenseGame.html` | 2 calls | Medium |
| `Games/PresentGame1/presentgame1.html` | 2 calls | Medium |
| `Games/SchoolStuffGame/SchoolStuffGame.html` | 3 calls | Medium |

#### Teachers Directory (38 files)

##### Teachers/Components (7 files)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `Teachers/Components/admin_teachers.html` | 3 calls | High |
| `Teachers/Components/admin-dashboard.html` | 3 calls | High |
| `Teachers/Components/admin-header.html` | 1 call | High |
| `Teachers/Components/feedback.js` | 1 call | Medium |
| `Teachers/Components/feedback_test.html` | 1 call | Low |
| `Teachers/Components/feedback-admin.html` | 4 calls | High |
| `Teachers/Components/feedback-admin.js` | 2 calls | High |

##### Teachers Root (2 files)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `Teachers/index.html` | 3 calls | High |
| `Teachers/worksheet_manager.html` | 8 calls | High |

##### Teachers/archive (2 files)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `Teachers/archive/wordtest.js` | 2 calls | Low |
| `Teachers/archive/wordtest2.js` | 1 call | Low |

##### Teachers/tools (27 files)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `Teachers/tools/flashcard/ai.js` | 1 call | Medium |
| `Teachers/tools/flashcard/flashcard.html` | 2 calls | Medium |
| `Teachers/tools/flashcard/flashcard-simple.js` | 1 call | Medium |
| `Teachers/tools/game-builder/create-game-modal.js` | 3 calls | High |
| `Teachers/tools/game-builder/main.js` | 7 calls | High |
| `Teachers/tools/game-builder/MintAi-list-builder.js` | 2 calls | Medium |
| `Teachers/tools/game-builder/services/ai-service.js` | 2 calls | Medium |
| `Teachers/tools/game-builder/services/file-service.js` | 4 calls | High |
| `Teachers/tools/game-builder/ui/file-list.js` | 3 calls | Medium |
| `Teachers/tools/Grammar/ai.js` | 2 calls | Medium |
| `Teachers/tools/Grammar/grammar2.html` | 5 calls | Medium |
| `Teachers/tools/grid_game/grid_game.html` | 3 calls | Medium |
| `Teachers/tools/manage_students.js` | 6 calls | **Critical** |
| `Teachers/tools/planner/planner.html` | 2 calls | Medium |
| `Teachers/tools/planner/planner.js` | 1 call | Medium |
| `Teachers/tools/planner/planner-standalone.js` | 3 calls | Medium |
| `Teachers/tools/puzzles/wordsearch.html` | 2 calls | Medium |
| `Teachers/tools/puzzles/wordsearch-standalone.js` | 1 call | Medium |
| `Teachers/tools/reading/ai.js` | 1 call | Medium |
| `Teachers/tools/reading/reading.html` | 5 calls | Medium |
| `Teachers/tools/student_tracker/homework-modal.js` | 1 call | High |
| `Teachers/tools/student_tracker/main.js` | 6 calls | High |
| `Teachers/tools/survey_builder/survey_ai.js` | 1 call | Medium |
| `Teachers/tools/survey_builder/survey_builder.html` | 5 calls | Medium |
| `Teachers/tools/survey_builder/survey_builder_drag_demo.html` | 2 calls | Low |
| `Teachers/tools/test_input/test_input.js` | 3 calls | High |
| `Teachers/tools/tests/ai.js` | 1 call | Low |
| `Teachers/tools/tests/images.js` | 1 call | Low |
| `Teachers/tools/vision_ai/vision.html` | 2 calls | Medium |
| `Teachers/tools/wordtest/ai.js` | 1 call | Medium |
| `Teachers/tools/wordtest/images.js` | 1 call | Medium |
| `Teachers/tools/wordtest/word_ops.js` | 1 call | Medium |
| `Teachers/tools/wordtest/wordtest2.html` | 2 calls | Medium |
| `Teachers/tools/worksheet-builder/src/WorksheetManager.jsx` | 2 calls | Medium |
| `Teachers/tools/worksheet-builder-vanilla/js/ai-integration.js` | 1 call | Medium |
| `Teachers/tools/worksheet-builder-vanilla/mint-ai/mint-ai-picture-modal.js` | 1 call | Medium |
| `Teachers/tools/worksheet-builder-vanilla/mint-ai/mint-ai-vocab-core.js` | 3 calls | Medium |
| `Teachers/tools/worksheet-builder-vanilla/mint-ai/mint-ai-vocab-layouts.js` | 2 calls | Medium |

#### Old Teachers Directory (2 files)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `old-teachers/Components/main.js` | 1 call | Low |
| `old-teachers/teacher_dashboard.js` | 2 calls | Low |

#### Netlify Functions (2 files - internal/test only)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `netlify/functions/b2test.html` | 2 calls | Low |
| `netlify/functions/submit_score.js` | 2 calls | Low |

#### Vision AI (1 file)
| File | Fetch Calls | Priority |
|------|-------------|----------|
| `vision_ai/index.html` | 2 calls | Medium |

---

## How to Migrate a File

1. Add the API config script to the HTML `<head>`:
   ```html
   <script src="/js/api-config.js"></script>
   ```

2. Replace all `fetch('/.netlify/functions/...')` calls with `WillenaAPI.fetch('/.netlify/functions/...')`:
   ```javascript
   // Before:
   const res = await fetch('/.netlify/functions/supabase_auth?action=whoami', { credentials: 'include' });
   
   // After:
   const res = await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=whoami');
   ```

3. Note: `WillenaAPI.fetch()` automatically adds `credentials: 'include'`, so you can remove that option.

---

## Priority Legend
- **Critical**: Core student/teacher functionality that's broken on custom domain
- **High**: Important user-facing features
- **Medium**: Frequently used tools and games
- **Low**: Test files, archives, or rarely used features

---

*Generated: December 2, 2025*
