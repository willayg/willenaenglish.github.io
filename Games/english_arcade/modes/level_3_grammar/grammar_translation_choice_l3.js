// Level 3 - Grammar Translation Choice (KO → EN) - simplified for Level 3 lists
// Stripped of Level-2 specific heuristics. Uses generic distractors + pool-based meaning distractor.

import { startSession, logAttempt, endSession } from '../../../../students/records.js';
import { openNowLoadingSplash } from '../unscramble_splash.js';
const StudentLang = (typeof window !== 'undefined' && window.StudentLang) ? window.StudentLang : { applyTranslations(){}, translate(k){ return k; } };
import { playSFX } from '../../sfx.js';
import { renderGrammarSummary } from '../grammar_summary.js';

const MODE = 'grammar_translation_choice';

export async function runGrammarTranslationChoiceL3Mode({ grammarFile, grammarName, grammarConfig = {} }) {
  const container = document.getElementById('gameArea');
  if (!container) return;

  injectTranslationResponsiveStyles();

  container.innerHTML = '<div style="padding:20px;text-align:center;"><p style="font-size:18px;color:#555;">Loading...</p></div>';

  let splash = null;
  try { splash = openNowLoadingSplash(document.body, { text: (grammarName ? `${grammarName} — now loading` : 'now loading') }); if (splash && splash.readyPromise) await splash.readyPromise; } catch (e) { console.debug('[TranslationChoiceL3] splash failed', e?.message); }

  let data = [];
  try {
    const r = await fetch(grammarFile);
    if (!r.ok) throw new Error('Failed to load ' + grammarFile);
    data = await r.json();
  } catch (err) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:#d32f2f;"><p>Error loading grammar data.</p></div>`;
    console.error(err);
    if (splash && typeof splash.hide === 'function') try { splash.hide(); } catch {}
    return;
  }

  const validItems = Array.isArray(data) ? data.filter(it => it && it.en && it.ko) : [];
  if (!validItems.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:#d32f2f;"><p>No translation items available.</p></div>`;
    return;
  }

  const items = validItems.sort(() => Math.random() - 0.5).slice(0, Math.min(15, validItems.length));

  const sessionId = startSession({ mode: MODE, listName: grammarName, wordList: items.map(it => it.word || it.id), meta: { grammarFile, grammarName, direction: 'KO→EN', input_type: 'mc', level: 3 } });

  let idx = 0, correct = 0, wrong = 0;

  function renderQuestion() {
    if (idx >= items.length) return finish();
    const item = items[idx];
    const correctSentence = deriveCorrectSentence(item);
    const { wrongGrammar, wrongSubject } = buildWrongSentences(item, correctSentence);
    const options = shuffle([correctSentence, wrongGrammar, wrongSubject]);

    container.innerHTML = '';
    container.classList.add('translation-mode-root');

    const header = document.createElement('div');
    header.className = 'translation-header';
    header.innerHTML = `
      <div class="progress">Question ${idx + 1} of ${items.length}</div>
      <button id="translationExitBtn" type="button" aria-label="Exit" title="Exit" style="margin-left:auto;margin-right:0;padding:8px 14px;border-radius:12px;border:2px solid #21b5c0;background:#fff;color:#21b5c0;font-weight:800;cursor:pointer;">Exit</button>`;
    container.appendChild(header);
    const exitBtn = header.querySelector('#translationExitBtn');
    if (exitBtn) exitBtn.addEventListener('click', () => {
      try { if (window.WordArcade?.startGrammarModeSelector) window.WordArcade.startGrammarModeSelector(); else if (window.WordArcade?.quitToOpening) window.WordArcade.quitToOpening(true); else history.back(); } catch { location.reload(); }
    });

    // Korean sentence (cyan Poppins) shown above instructions
    const koSentence = item.exampleSentenceKo || item.ko || '';
    if (koSentence) {
      const koEl = document.createElement('div');
      koEl.className = 'translation-ko-sentence';
      koEl.textContent = koSentence;
      container.appendChild(koEl);
    }

    const instructions = document.createElement('div');
    instructions.className = 'translation-instructions';
    instructions.textContent = 'Find the correct sentence:';
    container.appendChild(instructions);

    const optionsGrid = document.createElement('div');
    optionsGrid.className = 'translation-options';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('mouseenter', () => { if (!btn.disabled) { btn.style.borderColor = '#40D4DE'; btn.style.boxShadow = '0 4px 12px rgba(64,212,222,0.2)'; btn.style.transform = 'translateY(-2px)'; } });
      btn.addEventListener('mouseleave', () => { if (!btn.disabled) { btn.style.borderColor = '#ddd'; btn.style.boxShadow = 'none'; btn.style.transform = 'translateY(0)'; } });
      btn.addEventListener('click', () => handleAnswer(opt, correctSentence, btn, optionsGrid));
      optionsGrid.appendChild(btn);
    });
    container.appendChild(optionsGrid);
  }

  function handleAnswer(selected, correctSentence, btn, grid) {
    const isCorrect = selected === correctSentence;
    Array.from(grid.children).forEach(b => b.disabled = true);
    if (isCorrect) { btn.style.borderColor = '#4caf50'; btn.style.background = '#e8f5e9'; correct++; playSFX('correct'); }
    else {
      btn.style.borderColor = '#f44336'; btn.style.background = '#ffebee'; wrong++; playSFX('wrong');
      Array.from(grid.children).forEach(b => { if (b.textContent === correctSentence) { b.style.borderColor = '#4caf50'; b.style.background = '#e8f5e9'; } });
    }
    const item = items[idx];
    logAttempt({ session_id: sessionId, mode: MODE, word: item.word || item.id, is_correct: isCorrect, answer: selected, correct_answer: correctSentence, points: isCorrect ? 1 : 0, extra: { variant: 'l3_triple', level: 3, category: 'grammar', grammarFile } });
    setTimeout(() => {
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button'; nextBtn.className = 'translation-next-btn';
      nextBtn.textContent = idx < items.length - 1 ? 'Next' : 'Finish';
      nextBtn.addEventListener('click', () => { idx++; renderQuestion(); });
      const footer = document.getElementById('gm-footer');
      if (footer) { footer.replaceChildren(nextBtn); } else { container.appendChild(nextBtn); }
    }, 420);
  }

  function finish() {
    const total = correct + wrong;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    endSession(sessionId, { mode: MODE, summary: { score: correct, total: items.length, correct, wrong, points: correct, accuracy: pct, category: 'grammar', grammarName, grammarFile, level: 3 }, listName: grammarName, wordList: items.map(it => it.word || it.id), meta: { grammarFile, grammarName, direction: 'KO→EN', level: 3 } });
    try { playSFX('end'); } catch {}
    renderGrammarSummary({ gameArea: container, score: correct, total: items.length, ctx: {} });
  }

  renderQuestion();
  try { if (splash && typeof splash.hide === 'function') setTimeout(()=>{ try{ splash.hide(); }catch{} }, 520); } catch {}
}

// ---- helpers ----
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function shuffle(arr){ return Array.isArray(arr)? arr.sort(()=>Math.random()-0.5):[]; }

function deriveCorrectSentence(item){
  return (item.exampleSentence || item.en || '').trim();
}

function buildWrongSentences(item, correct) {
  const past = (item.past || '').trim();
  const base = (item.base || '').trim();
  // Wrong grammar: regularize irregular verb if present
  let wrongGrammar = correct;
  if (past && base && new RegExp(`\b${escapeRegExp(past)}\b`, 'i').test(correct)) {
    const regular = makeRegularPast(base, past);
    if (regular && regular.toLowerCase() !== past.toLowerCase()) {
      wrongGrammar = correct.replace(new RegExp(`\b${escapeRegExp(past)}\b`, 'i'), regular);
    }
  } else if (base && new RegExp(`\b${escapeRegExp(base)}\b`, 'i').test(correct)) {
    // If base form used, replace with a naive -ed past even if wrong
    const regular = makeRegularPast(base, base);
    if (regular && regular.toLowerCase() !== base.toLowerCase()) {
      wrongGrammar = correct.replace(new RegExp(`\b${escapeRegExp(base)}\b`, 'i'), regular);
    }
  }
  if (wrongGrammar === correct) {
    // Fallback: duplicate verb and add 'ed'
    wrongGrammar = correct.replace(/\b([A-Za-z]{3,})\b/, (m)=> makeRegularPast(m, m) || (m + 'ed'));
    if (wrongGrammar === correct) wrongGrammar = correct + '!!';
  }

  // Wrong subject: swap leading pronoun or first proper-noun/pronoun token
  let wrongSubject = correct;
  const pronRx = /^\s*(He|She|They|We|I|It)\b/i;
  const m = correct.match(pronRx);
  if (m) {
    const current = m[1];
    const choices = ['He','She','They','We','I','It'].filter(p=>p.toLowerCase()!==current.toLowerCase());
    const replacement = choices[Math.floor(Math.random()*choices.length)];
    wrongSubject = correct.replace(pronRx, replacement);
  } else {
    // fallback: prepend wrong subject
    wrongSubject = 'He ' + correct.charAt(0).toLowerCase() + correct.slice(1);
  }
  if (wrongSubject === correct || wrongSubject === wrongGrammar) {
    wrongSubject = 'She ' + correct.charAt(0).toLowerCase() + correct.slice(1);
  }
  return { wrongGrammar, wrongSubject };
}

function makeRegularPast(base, originalPast){
  let b = base.toLowerCase();
  if (!b) return null;
  if (/e$/.test(b)) return b + 'd';
  if (/y$/.test(b) && !/[aeiou]y$/.test(b)) return b.replace(/y$/,'ied');
  if (/([bcdfghjklmnpqrstvwxyz])\1$/.test(b)) return b + 'ed';
  return b + 'ed';
}

function escapeRegExp(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

// Reuse responsive styles injector from original translation mode
function injectTranslationResponsiveStyles(){
  if (typeof document === 'undefined') return;
  if (document.getElementById('translation-mode-responsive-styles')) return;
  const style = document.createElement('style');
  style.id = 'translation-mode-responsive-styles';
  style.textContent = `
    .translation-mode-root{display:flex;flex-direction:column;min-height:100vh;padding:clamp(12px,3vh,24px) clamp(12px,4vw,28px);box-sizing:border-box;}
    .translation-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:clamp(12px,4vh,24px);font-family:Poppins,Arial,sans-serif;}
    .translation-header .score{font-size:clamp(14px,2.4vw,18px);font-weight:600;color:#555;}
    .translation-header .progress{font-size:clamp(12px,2.2vw,16px);color:#888;}
    .translation-prompt{background:#fff;border:3px solid #40D4DE;border-radius:20px;padding:clamp(18px,5vh,32px) clamp(16px,4vw,24px);text-align:center;margin-bottom:clamp(16px,4.5vh,28px);box-shadow:0 4px 12px rgba(64,212,222,0.15);}    
    .translation-prompt .emoji{font-size:clamp(36px,9vw,56px);margin-bottom:clamp(8px,1.8vh,14px);}    
    .translation-prompt .ko-text{font-size:clamp(20px,5.5vw,28px);font-weight:600;color:#333;line-height:1.3;word-wrap:break-word;overflow-wrap:anywhere;}
    .translation-ko-sentence{font-family:Poppins,Arial,sans-serif;font-weight:700;color:#21b5c0;font-size:clamp(18px,5vw,28px);margin-bottom:clamp(10px,2vh,16px);line-height:1.3;word-wrap:break-word;overflow-wrap:anywhere;text-align:center;}
    .translation-instructions{text-align:center;font-size:clamp(13px,2.6vw,16px);color:#666;margin-bottom:clamp(12px,2.8vh,20px);font-weight:500;}
    .translation-options{display:flex;flex-direction:column;gap:clamp(10px,2.4vh,14px);margin-bottom:clamp(14px,3.2vh,20px);}    
    .translation-options .option-btn{background:#fff;border:3px solid #ddd;border-radius:16px;padding:clamp(10px,2.2vh,18px) clamp(14px,4vw,20px);font-size:clamp(15px,3.8vw,19px);font-weight:600;color:#333;cursor:pointer;transition:all 0.2s ease;text-align:left;font-family:inherit;line-height:1.3;min-height:clamp(44px,8vh,72px);}    
    .translation-next-btn{width:100%;padding:clamp(12px,2.8vh,16px);background:#21b5c0;color:#fff;border:none;border-radius:14px;font-size:clamp(16px,4.2vw,18px);font-weight:700;cursor:pointer;margin-top:clamp(6px,1.6vh,10px);font-family:inherit;transition:background .2s ease;}    
    @media (max-height:700px){ .translation-prompt{margin-bottom:clamp(12px,3vh,20px);} .translation-options{gap:clamp(8px,2vh,12px);} .translation-options .option-btn{min-height:clamp(40px,7.5vh,64px);} }
  `;
  document.head.appendChild(style);
}

export default { start: runGrammarTranslationChoiceL3Mode };
