import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);

test('internal level-test worker paginates the complete assessment bank', async () => {
  const source = await readFile(new URL('cloudflare-workers/student-level-test/src/index.js', root), 'utf8');

  assert.match(source, /const BANK_PAGE_SIZE = 1000/);
  assert.match(source, /for \(let start = 0; ; start \+= BANK_PAGE_SIZE\)/);
  assert.match(source, /\.range\(start, start \+ BANK_PAGE_SIZE - 1\)/);
  assert.match(source, /\.order\('source_key', \{ ascending: true \}\)/);
  assert.match(source, /\.order\('id', \{ ascending: true \}\)/);
});

test('sentence unscrambles are recorded as sentence building, never writing', async () => {
  const source = await readFile(new URL('cloudflare-workers/student-level-test/src/index.js', root), 'utf8');

  assert.match(source, /type\.includes\('unscramble'\).*return 'sentence_building'/);
  assert.doesNotMatch(source, /type\.includes\('writ'\) \|\| type\.includes\('unscramble'\)/);
  assert.match(source, /if \(inferred === 'sentence_building'\) return inferred/);
});

test('both browser level-test loaders paginate beyond Supabase row 1000', async () => {
  const [classic, module] = await Promise.all([
    readFile(new URL('free-level-test/js/assessment-loader-classic.js', root), 'utf8'),
    readFile(new URL('free-level-test/js/assessment-loader.js', root), 'utf8'),
  ]);

  assert.match(classic, /limit="\+PAGE_SIZE\+"&offset="\+offset/);
  assert.match(classic, /if\(rows\.length===PAGE_SIZE\)return next\(offset\+PAGE_SIZE\)/);
  assert.match(classic, /source_key\.asc,id\.asc/);
  assert.match(module, /Range:`\$\{start\}-\$\{start\+pageSize-1\}`/);
  assert.match(module, /if\(page\.length<pageSize\)break/);
});

test('drawer and PDF calculator recognize legacy sentence-making type names', async () => {
  const source = await readFile(new URL('free-level-test/js/report-calculation.js', root), 'utf8');
  const context = vm.createContext({ globalThis: {} });
  vm.runInContext(source, context);
  const calculation = context.globalThis.WillenaLevelReportCalculation.create({
    attempt: { recommended_level: 4 },
    responses: [
      { question_level: 3, question_type: 'sentence_unscramble', is_correct: true },
      { question_level: 4, question_type: 'sentence_building', is_correct: true },
      { question_level: 4, question_type: 'sentence_making', is_correct: false },
    ],
  });

  assert.equal(calculation.estimate('sentence_building').assessed, true);
  assert.equal(calculation.estimate('writing').assessed, false);
});

test('admin detail payload repairs legacy stored sentence skill metadata', async () => {
  const source = await readFile(new URL('cloudflare-workers/admin-classes/src/index.js', root), 'utf8');

  assert.match(source, /responseSkill\(row\.item_type, row\.metadata\)/);
  assert.match(source, /stored\.includes\('sentence_build'\)/);
});
