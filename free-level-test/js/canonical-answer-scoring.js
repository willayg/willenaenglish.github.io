(function (global) {
  'use strict';

  function shared() {
    return global.WillenaActivityScoring || null;
  }
  function cleanText(value) {
    var scoring = shared();
    return scoring ? scoring.cleanText(value) : String(value == null ? '' : value).normalize('NFKC').replace(/\s+/g, ' ').trim();
  }
  function sentenceText(value) {
    var scoring = shared();
    if (scoring) {
      var normalized = scoring.sentenceText(value);
      return String(normalized == null ? '' : normalized).toLocaleLowerCase('en-US').replace(/[.,!?;:。！？、，；：]+$/gu, '').trim();
    }
    return cleanText(Array.isArray(value) ? value.join(' ') : value).toLocaleLowerCase('en-US').replace(/[.,!?;:。！？、，；：]+$/gu, '').trim();
  }
  function isCorrect(type, selected, correct) {
    if (type === 'sentence_unscramble') return sentenceText(selected) === sentenceText(correct);
    var scoring = shared();
    return scoring ? scoring.isCorrect(type, selected, correct) : JSON.stringify(selected) === JSON.stringify(correct);
  }
  function firstDefined(row, keys) {
    for (var index = 0; index < keys.length; index += 1) {
      if (row[keys[index]] !== undefined && row[keys[index]] !== null) return row[keys[index]];
    }
    return undefined;
  }
  function repairResponse(row) {
    if (!row || typeof row !== 'object') return row;
    var type = firstDefined(row, ['question_type', 'item_type', 'type']);
    var selected = firstDefined(row, ['selected_answer', 'student_answer', 'selected', 'response']);
    var correct = firstDefined(row, ['correct_answer', 'answer', 'expected_answer']);
    if (type !== 'sentence_unscramble' || selected === undefined || correct === undefined) return row;
    var corrected = isCorrect(type, selected, correct);
    row.is_correct = corrected;
    if ('correct' in row) row.correct = corrected;
    if ('isCorrect' in row) row.isCorrect = corrected;
    return row;
  }
  function repairList(rows) { if (Array.isArray(rows)) rows.forEach(repairResponse); }
  function repairPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    repairList(payload.responses); repairList(payload.answers); repairList(payload.question_results);
    repairList(payload.attempt && payload.attempt.responses); repairList(payload.report && payload.report.responses);
    return payload;
  }
  global.WillenaLevelTestScoring = { cleanText: cleanText, sentenceText: sentenceText, isCorrect: isCorrect, repairResponse: repairResponse, repairPayload: repairPayload };

  if (typeof global.fetch === 'function' && !global.__willenaLevelTestScoringFetchInstalled) {
    global.__willenaLevelTestScoringFetchInstalled = true;
    var originalFetch = global.fetch.bind(global);
    global.fetch = function () {
      var args = arguments;
      return originalFetch.apply(null, args).then(function (response) {
        var requestUrl = String(response.url || (args[0] && args[0].url) || args[0] || '');
        if (requestUrl.indexOf('prospective-level-test') === -1) return response;
        var originalJson = response.json.bind(response);
        response.json = function () { return originalJson().then(repairPayload); };
        return response;
      });
    };
  }
})(window);
