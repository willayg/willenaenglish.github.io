import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

test('both browser level tests exclude study-only assessment questions', async () => {
  const source = await readFile(new URL('free-level-test/js/assessment-loader-classic.js', root), 'utf8');
  const rows = [
    { id: 'included', metadata: {} },
    { id: 'excluded', metadata: { exclude_level_test: true } },
    { id: 'excluded-string', metadata: { exclude_level_test: 'true' } },
    { id: 'legacy-excluded', metadata: { exclude_from_level_test: true } },
  ];
  const window = {
    WillenaAssessmentAdapter: {
      fromAssessmentItem(row) {
        return { id: row.id, level: 1 };
      },
    },
  };
  const context = vm.createContext({
    window,
    fetch: async () => ({ ok: true, json: async () => rows }),
    URL,
    console,
    Math,
  });

  vm.runInContext(source, context);
  const bank = await window.loadQuestionBank();

  assert.deepEqual(Array.from(bank, item => item.id), ['included']);
});

test('public and internal tests load the same eligibility-aware bank', async () => {
  const [publicHtml, studentHtml] = await Promise.all([
    readFile(new URL('free-level-test/index.html', root), 'utf8'),
    readFile(new URL('students/level-test/index.html', root), 'utf8'),
  ]);

  assert.match(publicHtml, /assessment-loader-classic\.js\?v=20260812-eligibility2/);
  assert.match(studentHtml, /assessment-loader-classic\.js\?v=20260812-eligibility2/);
});

test('study question bank keeps assessment questions regardless of level-test eligibility', async () => {
  const studySource = await readFile(new URL('students/study/study-question-bank.js', root), 'utf8');

  assert.doesNotMatch(studySource, /exclude_(?:from_)?level_test/);
  assert.match(studySource, /assessment_items/);
});
