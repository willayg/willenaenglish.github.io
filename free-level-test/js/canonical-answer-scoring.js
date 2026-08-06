(function (global) {
  'use strict';

  function cleanText(value) {
    return String(value == null ? '' : value)
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sentenceText(value) {
    var text = Array.isArray(value) ? value.map(cleanText).join(' ') : cleanText(value);
    return text
      .toLocaleLowerCase('en-US')
      .replace(/[.,!?;:。！？、，；：]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function exactComparable(value) {
    if (Array.isArray(value)) return value.map(cleanText);
    return cleanText(value);
  }

  function isCorrect(type, selected, correct) {
    if (type === 'sentence_unscramble') {
      return sentenceText(selected) === sentenceText(correct);
    }
    return JSON.stringify(exactComparable(selected)) === JSON.stringify(exactComparable(correct));
  }

  function repairResponse(row) {
    if (!row || typeof row !== 'object') return row;
    var type = row.question_type || row.item_type || row.type;
    var selected = row.selected_answer !== undefined ? row.selected_answer : row.selected;
    var correct = row.correct_answer !== undefined ? row.correct_answer : row.answer;
    if (selected === undefined || correct === undefined) return row;
    row.is_correct = isCorrect(type, selected, correct);
    if ('correct' in row) row.correct = row.is_correct;
    return row;
  }

  function repairPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    if (Array.isArray(payload.responses)) payload.responses.forEach(repairResponse);
    if (Array.isArray(payload.answers)) payload.answers.forEach(repairResponse);
    if (payload.attempt && Array.isArray(payload.attempt.responses)) payload.attempt.responses.forEach(repairResponse);
    return payload;
  }

  global.WillenaLevelTestScoring = {
    cleanText: cleanText,
    sentenceText: sentenceText,
    isCorrect: isCorrect,
    repairResponse: repairResponse,
    repairPayload: repairPayload
  };

  if (typeof global.fetch === 'function' && !global.__willenaLevelTestScoringFetchInstalled) {
    global.__willenaLevelTestScoringFetchInstalled = true;
    var originalFetch = global.fetch.bind(global);
    global.fetch = function () {
      var args = arguments;
      return originalFetch.apply(null, args).then(function (response) {
        var requestUrl = String(response.url || (args[0] && args[0].url) || args[0] || '');
        if (requestUrl.indexOf('prospective-level-test') === -1) return response;
        var originalJson = response.json.bind(response);
        response.json = function () {
          return originalJson().then(repairPayload);
        };
        return response;
      });
    };
  }
})(window);
