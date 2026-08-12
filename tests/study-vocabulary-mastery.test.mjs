import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

function browserContext(fetchImpl) {
  const window = {};
  const context = vm.createContext({
    window,
    fetch: fetchImpl,
    URL,
    console,
    Math,
    Date,
    sessionStorage: { getItem: () => null, setItem: () => {} },
  });
  return { window, context };
}

test('authored vocabulary variants map to one canonical lexical mastery target', async () => {
  const source = await readFile(new URL('students/study/study-question-bank.js', root), 'utf8');
  const rows = [
    {
      id: 'question-a', book_id: 'book', unit_id: 'unit', level_id: 6,
      item_type: 'vocabulary', prompt_text: 'At the robotics club, students can ____.',
      correct_answer: 'build robots', choices: ['build robots', 'do yoga'], metadata: {},
      anchor_lexical_entry_id: 'word-build-robots',
    },
    {
      id: 'question-b', book_id: 'book', unit_id: 'unit', level_id: 6,
      item_type: 'vocabulary', prompt_text: 'They use motors and parts to make machines. They ____.',
      correct_answer: 'build robots', choices: ['build robots', 'knit gloves'], metadata: {},
      anchor_lexical_entry_id: 'word-build-robots',
    },
  ];
  const { window, context } = browserContext(async () => ({ ok: true, json: async () => rows }));

  vm.runInContext(source, context);
  const activities = await window.WillenaStudyQuestionBank.loadUnit(4, {
    bookId: 'book', unitId: 'unit', bookTitle: 'Come On Everyone 4', unitNumber: 1,
  });

  assert.equal(activities.length, 2);
  assert.notEqual(activities[0].sourceId, activities[1].sourceId);
  assert.deepEqual(
    Array.from(activities, activity => [activity.metadata.mastery_content_type, activity.metadata.mastery_content_id]),
    [['lexical_entry', 'word-build-robots'], ['lexical_entry', 'word-build-robots']],
  );
});

test('adaptive sessions choose at most one variant of a canonical vocabulary target', async () => {
  const source = await readFile(new URL('shared/learning-engine/adaptive-study.js', root), 'utf8');
  const { window, context } = browserContext(async () => ({ ok: true, json: async () => [] }));
  vm.runInContext(source, context);

  const activity = (id, lexicalId) => ({
    id,
    sourceType: 'assessment_item',
    sourceId: id,
    skill: 'vocabulary',
    metadata: {
      book_id: 'book', unit_id: 'unit', assessment_bank: true,
      mastery_content_type: 'lexical_entry', mastery_content_id: lexicalId,
    },
  });
  const pool = [
    activity('robots-a', 'robots'),
    activity('robots-b', 'robots'),
    activity('yoga-a', 'yoga'),
  ];

  const chosen = window.WillenaAdaptiveStudy.chooseSession(pool, { items: [] }, {
    target: 3, focusSkill: 'vocabulary', focusUnitId: 'unit', currentBookId: 'book', currentUnitId: 'unit',
  });

  assert.equal(chosen.length, 2);
  assert.equal(new Set(chosen.map(item => item.metadata.mastery_content_id)).size, 2);
});
