// Grammar Find-the-Mistake Mode (Level 3 variant)
// Copies the core O/X experience and lives alongside the other Level 3 grammar modes.

import { startSession, logAttempt, endSession } from '../../../../students/records.js';
import { playSFX } from '../../sfx.js';
import { renderGrammarSummary } from '../grammar_summary.js';
import { openNowLoadingSplash } from '../unscramble_splash.js';

const MODE = 'grammar_find_mistake';

export async function runGrammarFindMistakeL3Mode({ grammarFile, grammarName, grammarConfig = {} }) {
  const container = document.getElementById('gameArea');
  if (!container) return;
  container.innerHTML = '<div style="padding:20px;text-align:center;">Loading…</div>';

  let splashController = null;
  try {
    splashController = openNowLoadingSplash(document.body, { text: (grammarName ? `${grammarName} — now loading` : 'now loading') });
    if (splashController && splashController.readyPromise) await splashController.readyPromise;
  } catch (e) {
    console.debug('[FindMistakeL3] splash failed', e?.message);
  }

  let data = [];
  try {
    const r = await fetch(grammarFile);
    if (!r.ok) throw new Error('load failed');
    data = await r.json();
  } catch (e) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#c00">Failed to load list.</div>';
    if (splashController && typeof splashController.hide === 'function') try { splashController.hide(); } catch {}
    return;
  }

  const base = (Array.isArray(data) ? data : []).filter(it => (it && (it.en || it.exampleSentence)));
  if (!base.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;">No sentences.</div>';
    return;
  }

  const makeSentence = (it) => (it.en || it.exampleSentence || '').trim();

  function escapeRegExp(s){
    return String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function corruptSentence(en, item) {
    // Level 3: prefer swapping the correct verb with a detractor (e.g., broke -> broken)
    const hasDetractors = item && Array.isArray(item.detractors) && item.detractors.length > 0;
    if (hasDetractors) {
      const past = (item.past || item.word || '').trim();
      const base = (item.base || '').trim();
      const wrong = (item.detractors.find(d => d && String(d).trim()) || '').trim();
      if (wrong) {
        let tokenToReplace = '';
        if (past && new RegExp(`\\b${escapeRegExp(past)}\\b`, 'i').test(en)) tokenToReplace = past;
        else if (base && new RegExp(`\\b${escapeRegExp(base)}\\b`, 'i').test(en)) tokenToReplace = base;
        if (tokenToReplace) {
          const bad = en.replace(new RegExp(`\\b${escapeRegExp(tokenToReplace)}\\b`, 'i'), wrong);
          return { bad, wrongToken: wrong, correctToken: tokenToReplace };
        }
      }
    }
    const parts = en.split(/\s+/);
    if (parts.length >= 2) {
      const subjIdx = 0;
      const origSubj = parts[subjIdx];
      const lowSubj = origSubj.toLowerCase().replace(/[.,!?;:]+$/g, '');
      const thirdSingular = ['he', 'she', 'it'];
      if (thirdSingular.includes(lowSubj)) {
        const replacements = ['they', 'we', 'you'];
        const replacement = replacements[Math.floor(Math.random() * replacements.length)];
        const bad = parts.slice();
        bad[subjIdx] = replacement.charAt(0) === replacement.charAt(0).toLowerCase()
          ? (/[A-Z]/.test(origSubj[0]) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement)
          : replacement;
        return { bad: bad.join(' '), wrongToken: bad[subjIdx], correctToken: origSubj };
      }
      if (parts.length >= 3) {
        const verbIdx = 2;
        const orig = parts[verbIdx];
        const low = orig.toLowerCase().replace(/[.,!?;:]+$/g, '');
        const banned = ['always','never','often','sometimes','usually','really','very','now','today',
          'in','on','at','to','for','with','of','a','an','the','and','but','or'];
        if (!banned.includes(low)) {
          const changed = /s$/i.test(orig) ? orig.replace(/s$/i, '') : `${orig}s`;
          const bad = parts.slice();
          bad[verbIdx] = changed;
          return { bad: bad.join(' '), wrongToken: changed, correctToken: orig };
        }
      }
    }
    return { bad: en + '!', wrongToken: '!', correctToken: '' };
  }

  const total = Math.min(14, base.length);
  const half = Math.floor(total / 2);
  const shuffled = base.sort(() => Math.random() - 0.5).slice(0, total);
  const good = shuffled.slice(0, half).map(it => ({ type: 'good', en: makeSentence(it), src: it }));
  const bad = shuffled.slice(half).map(it => {
    const en = makeSentence(it);
    const c = corruptSentence(en, it);
    return { type: 'bad', enBad: c.bad, enCorrect: en, wrongToken: c.wrongToken, correctToken: c.correctToken, src: it };
  });
  const rounds = [...good, ...bad].sort(() => Math.random() - 0.5);

  const sessionId = startSession({ mode: MODE, listName: grammarName, wordList: rounds.map((r, i) => r.src?.word || `s${i}`), meta: { grammarFile, grammarName, level: 3 } });
  let idx = 0, correct = 0, wrong = 0;

  function addExitButton() {
    if (document.getElementById('grammarQuitBtn')) return;
    const quitBtn = document.createElement('button');
    quitBtn.id = 'grammarQuitBtn';
    quitBtn.className = 'wa-quit-btn';
    quitBtn.type = 'button';
    quitBtn.setAttribute('aria-label', 'Quit game');
    quitBtn.innerHTML = `
      <span class="wa-sr-only">Quit Game</span>
      <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
    `;
    quitBtn.onclick = () => {
      // End partial session and navigate like Level 2
      try {
        endSession(sessionId, {
          mode: MODE,
          summary: { score: correct, total: rounds.length, correct, wrong, points: correct, category: 'grammar', grammarFile, grammarName, level: 3 },
          listName: grammarName,
          wordList: rounds.map((r, i) => r.src?.word || `s${i}`),
          meta: { grammarFile, grammarName, level: 3, quit: true }
        });
      } catch {}
      try {
        if (window.WordArcade?.startGrammarModeSelector) {
          window.WordArcade.startGrammarModeSelector();
        } else if (window.WordArcade?.showGrammarLevelsMenu) {
          window.WordArcade.showGrammarLevelsMenu();
        } else if (window.WordArcade?.quitToOpening) {
          window.WordArcade.quitToOpening(true);
        } else if (history.length > 1) {
          history.back();
        } else {
          location.reload();
        }
      } catch { location.reload(); }
    };
    document.body.appendChild(quitBtn);
  }

  function render() {
    if (idx >= rounds.length) return end();
    const r = rounds[idx];
    container.innerHTML = '';
    container.style.cssText = 'padding:20px;max-width:760px;margin:0 auto;font-family:Poppins,Arial,sans-serif;min-height:100dvh;display:flex;flex-direction:column;';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;color:#666';
    head.innerHTML = `<div><b>${grammarName || 'Grammar'}</b></div><div>Q ${idx + 1}/${rounds.length}</div>`;
    container.appendChild(head);
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border:3px solid #40D4DE;border-radius:18px;padding:28px;box-shadow:0 6px 14px rgba(64,212,222,.18);margin-bottom:18px;';
    const sentence = (r.type === 'good' ? r.en : r.enBad);
    let cardHtml = `<div style="font-size:24px;line-height:1.5;color:#333;text-align:center">${sentence}</div>`;
    card.innerHTML = cardHtml;
    container.appendChild(card);
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'O'; okBtn.setAttribute('aria-label', 'Correct sentence');
    okBtn.style.cssText = baseBtn('#21b5c0');
    const xBtn = document.createElement('button');
    xBtn.textContent = 'X'; xBtn.setAttribute('aria-label', 'Wrong sentence');
    xBtn.style.cssText = baseBtn('#ff6b6b');
    btnRow.appendChild(okBtn);
    btnRow.appendChild(xBtn);
    container.appendChild(btnRow);

    // Sticky footer for Next/Finish button so it's always visible on small screens
    const footer = document.createElement('div');
    footer.id = 'gm-footer';
    footer.style.cssText = 'position:sticky;bottom:0;left:0;right:0;padding:12px 12px calc(16px + env(safe-area-inset-bottom,0px));background:linear-gradient(to top, rgba(251,255,255,0.98), rgba(251,255,255,0.82), rgba(251,255,255,0));display:flex;justify-content:center;z-index:1;';
    container.appendChild(footer);
    const decide = (choice) => {
      const isCorrect = (r.type === 'good' && choice === 'O') || (r.type === 'bad' && choice === 'X');
      if (isCorrect) { correct++; playSFX('correct'); } else { wrong++; playSFX('wrong'); }
      reveal(r, isCorrect);
      logAttempt({ session_id: sessionId, mode: MODE, word: r.src?.word || `s${idx}`, is_correct: isCorrect, answer: choice, correct_answer: r.type === 'good' ? 'O' : 'X', points: isCorrect ? 1 : 0, extra: { type: r.type, level: 3, category: 'grammar', grammarFile } });
    };
    okBtn.onclick = () => decide('O');
    xBtn.onclick = () => decide('X');
  }

  function baseBtn(color) {
    return `background:#fff;border:3px solid ${color};color:${color};font-weight:800;padding:14px 26px;border-radius:14px;font-size:22px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.06);`;
  }

  function reveal(r, wasRight) {
    const controls = container.querySelectorAll('button'); controls.forEach(b => b.disabled = true);
    const revealBox = document.createElement('div');
    revealBox.style.cssText = 'margin-top:16px;text-align:center';
    if (r.type === 'good') {
      revealBox.innerHTML = `<div style="color:#4caf50;font-weight:800;font-size:28px;margin-bottom:10px;">Correct sentence ✔</div>`;
    } else {
      const raw = r.enBad;
      const wrongToken = r.wrongToken || '';
      const safeWrong = wrongToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const badHtml = raw.replace(new RegExp(`\\b${safeWrong}\\b`, 'i'), (m) => `<span class="mistake" style="color:#ff6b6b;font-weight:800;text-decoration:line-through;">${m}</span>`);
      revealBox.innerHTML = `
        <div style="color:#ff6b6b;font-weight:700;margin-bottom:8px;">There is a mistake ✖</div>
        <div style="font-size:22px;line-height:1.6;color:#333;margin-bottom:10px;">${badHtml}</div>
        <div id="fixLine" style="position:relative;min-height:80px;width:100%;max-width:760px;margin:0 auto;padding:0 8px;">
          <span style="position:absolute;left:50%;transform:translateX(-50%);background:#e8f5e9;color:#2e7d32;border:2px solid #2e7d32;padding:12px 20px;border-radius:12px;font-weight:800;font-size:22px;width:100%;box-sizing:border-box;text-align:center;line-height:1.4;word-wrap:break-word;">${r.enCorrect}</span>
        </div>`;
      setTimeout(() => {
        const el = revealBox.querySelector('#fixLine span');
        if (!el) return;
        el.animate([
          { transform: 'translate(-50%, 12px)', opacity: .0 },
          { transform: 'translate(-50%, 0)', opacity: 1 }
        ], { duration: 350, easing: 'ease-out' });
      }, 50);
    }
    container.appendChild(revealBox);
    // Small spacer to separate content from sticky footer
    const spacer = document.createElement('div');
    spacer.style.cssText = 'height:16px;';
    container.appendChild(spacer);
    const next = document.createElement('button');
    next.textContent = (idx < rounds.length - 1 ? 'Next' : 'Finish');
    next.style.cssText = baseBtn('#21b5c0') + 'display:block;margin:0 auto;max-width:360px;width:min(92vw,360px);';
    next.onclick = () => { idx++; render(); };
    const footer = container.querySelector('#gm-footer');
    if (footer) { footer.replaceChildren(); footer.appendChild(next); }
    else { container.appendChild(next); }
    addExitButton();
  }

  function end() {
    endSession(sessionId, {
      mode: MODE,
      summary: {
        score: correct,
        total: rounds.length,
        correct,
        wrong,
        points: correct,
        pct: Math.round((correct / (rounds.length || 1)) * 100),
        category: 'grammar',
        context: 'game',
        grammarName,
        grammarFile,
        level: 3,
      },
      listName: grammarName,
      wordList: rounds.map((r, i) => r.src?.word || `s${i}`),
      meta: { grammarFile, grammarName, level: 3 },
    });
    playSFX('end');
    const gameArea = document.getElementById('gameArea');
    renderGrammarSummary({
      gameArea,
      score: correct,
      total: rounds.length,
      ctx: { grammarFile, grammarName },
    });
  }

  render();
  try {
    if (splashController && typeof splashController.hide === 'function') setTimeout(() => { try { splashController.hide(); } catch {} }, 520);
  } catch (e) {}
}