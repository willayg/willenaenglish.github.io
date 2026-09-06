# STOP — TEST PREP V2 SINGLE-SOURCE RULE

Read the repository-root `AGENTS.md` before changing Test Prep v2 or the renderer lab.

For these paths:

- `students/test-prep-v2/`
- `students/question-render-lab/`

there is exactly ONE question renderer implementation:

`students/test-prep-v2/question-renderer.js`

`students/question-render-lab/` MUST import that exact module. It must never contain, copy, fork, inline, or reimplement question rendering code.

If rendering is wrong, fix the canonical renderer. If normalization is wrong, fix the canonical model/source adapter. Do not add a patch renderer.

Do not create another renderer file for vocab, 서술형, 본문, 수행평가, 오답, grammar, communication, or reading.
