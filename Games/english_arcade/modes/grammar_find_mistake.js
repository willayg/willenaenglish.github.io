// Grammar Find-the-Mistake Mode (O/X validator)
// Shows a sentence; student clicks O (correct) or X (wrong). If wrong, reveal fix by striking error
// and animating the correct token over it. Uses half-good/half-bad distribution.

import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { playSFX } from '../sfx.js';
import { renderGrammarSummary } from './grammar_summary.js';

const MODE = 'grammar_find_mistake';

export async function runGrammarFindMistakeMode({ grammarFile, grammarName, grammarConfig = {} }) {
  const container = document.getElementById('gameArea');
  if (!container) return;
  container.innerHTML = '<div style="padding:20px;text-align:center;">Loading…</div>';

  // Load list
  let data = [];
  try {
    const r = await fetch(grammarFile);
    if (!r.ok) throw new Error('load failed');
    data = await r.json();
  } catch (e) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#c00">Failed to load list.</div>';
    return;
  }

  const base = (Array.isArray(data) ? data : []).filter(it => (it && (it.en || it.exampleSentence))); // prefer en; fallback exampleSentence
  if (!base.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;">No sentences.</div>';
    return;
  }

  // Build good/bad pool & corruption helpers
  const makeSentence = (it) => (it.en || it.exampleSentence || '').trim();
  const isSomeAnyList = /some_vs_any\.json$/i.test(String(grammarFile || '')) || /some\s*vs\s*any/i.test(String(grammarName || ''));
  const isPresentSimpleList = /present_simple_sentences\.json$/i.test(String(grammarFile || '')) || /present\s*simple/i.test(String(grammarName || ''));
  const isPresentSimpleNegativeList = /present_simple_negative\.json$/i.test(String(grammarFile || '')) || /present\s*simple[\s:\-]*negative/i.test(String(grammarName || ''));

  function corruptSomeAny(en) {
    const rxSome = /\bsome\b/i;
    const rxAny = /\bany\b/i;
    if (rxSome.test(en)) {
      const bad = en.replace(rxSome, (m) => (m[0] === m[0].toUpperCase() ? 'Any' : 'any'));
      return { bad, wrongToken: 'any', correctToken: 'some' };
    }
    if (rxAny.test(en)) {
      const bad = en.replace(rxAny, (m) => (m[0] === m[0].toUpperCase() ? 'Some' : 'some'));
      return { bad, wrongToken: 'some', correctToken: 'any' };
    }
    return null;
  }

  function corruptSentence(en) {
    if (isSomeAnyList) {
      const res = corruptSomeAny(en);
      if (res) return res;
    }

    // Present Simple NEGATIVE: flip don't <-> doesn't regardless of subject for wrong sentence
    if (isPresentSimpleNegativeList) {
      const rxDoesnt = /\bdoesn['’]?t\b/i;
      const rxDont = /\bdon['’]?t\b/i;
      if (rxDoesnt.test(en)) {
        const m = en.match(rxDoesnt);
        const cap = m && /^[A-Z]/.test(m[0]);
        const replacement = cap ? "Don't" : "don't";
        const bad = en.replace(rxDoesnt, replacement);
        return { bad, wrongToken: replacement, correctToken: m ? m[0] : "doesn't" };
      }
      if (rxDont.test(en)) {
        const m = en.match(rxDont);
        const cap = m && /^[A-Z]/.test(m[0]);
        const replacement = cap ? "Doesn't" : "doesn't";
        const bad = en.replace(rxDont, replacement);
        return { bad, wrongToken: replacement, correctToken: m ? m[0] : "don't" };
      }
      // Fallback: if neither present (unexpected), fall through to generic present simple logic
    }

  // Present simple: force verb agreement error
    if (isPresentSimpleList) {
      const tokens = en.split(/\s+/);
      if (tokens.length >= 3) {
        const lower = tokens.map(t => t.toLowerCase().replace(/[.,!?;:]+$/g, ''));
        let subjIdx = 0;
        if (lower[0] === 'the' && lower.length >= 2) subjIdx = 1;
        const subj = lower[subjIdx];
        let verbIdx = subjIdx + 1;
        const skip = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'of']);
        while (verbIdx < lower.length && skip.has(lower[verbIdx])) verbIdx++;
        if (verbIdx < tokens.length) {
          const origVerb = tokens[verbIdx];
          const bare = origVerb.replace(/[.,!?;:]+$/g, '');
          const punct = origVerb.slice(bare.length);
          const makeForms = (v) => {
            if (!v) return [v, v];
            if (/ies$/i.test(v) && !/[aeiou]ies$/i.test(v)) {
              const base = v.replace(/ies$/i, 'y');
              return [base, v];
            }
            if (/(ches|shes|sses|xes|zes)$/i.test(v)) {
              const base = v.replace(/es$/i, '');
              return [base, v];
            }
            if (/s$/i.test(v) && !/ss$/i.test(v)) {
              const base = v.replace(/s$/i, '');
              return [base, v];
            }
            if (/(ch|sh|s|x|z)$/i.test(v)) return [v, v + 'es'];
            if (/y$/i.test(v) && !/[aeiou]y$/i.test(v)) return [v, v.replace(/y$/i, 'ies')];
            return [v, v + 's'];
          };
          const [baseForm, sForm] = makeForms(bare);
          const isThirdSingular = ['he', 'she', 'it'].includes(subj) || (subj === 'sun');
          const correctVerb = isThirdSingular ? sForm : baseForm;
          const wrongVerb = isThirdSingular ? baseForm : sForm;
          if (correctVerb && wrongVerb && correctVerb.toLowerCase() !== wrongVerb.toLowerCase()) {
            const badTokens = tokens.slice();
            badTokens[verbIdx] = wrongVerb + punct;
            return {
              bad: badTokens.join(' '),
              wrongToken: wrongVerb,
              correctToken: correctVerb,
            };
          }
        }
      }
      // fall through to generic if anything failed
    }

    const isThereIsAreList = /there_is_vs_there_are\.json$/i.test(String(grammarFile || '')) || /there\s+is\s+vs\s+there\s+are/i.test(String(grammarName || ''));
    if (isThereIsAreList) {
      const low = en.toLowerCase();
      if (/^there\s+is\b/.test(low)) {
        const bad = en.replace(/^(there\s+)is\b/i, '$1are');
        return { bad, wrongToken: 'are', correctToken: 'is' };
      }
      if (/^there\s+are\b/.test(low)) {
        const bad = en.replace(/^(there\s+)are\b/i, '$1is');
        return { bad, wrongToken: 'is', correctToken: 'are' };
      }
    }

    const m = en.match(/^(Do|Does|Is|Are|Can)\s+(\S+)\s+(.*)$/i);
    if (m) {
      const aux = m[1];
      const subj = m[2];
      const rest = m[3];
      let wrongAux = null;
      if (/^Do$/i.test(aux)) wrongAux = 'Does';
      else if (/^Does$/i.test(aux)) wrongAux = 'Do';
      else if (/^Is$/i.test(aux)) wrongAux = 'Are';
      else if (/^Are$/i.test(aux)) wrongAux = 'Is';
      if (wrongAux && wrongAux !== aux) {
        return { bad: `${wrongAux} ${subj} ${rest}`, wrongToken: wrongAux, correctToken: aux };
      }
    }

    const parts = en.split(/\s+/);
    if (parts.length >= 3) {
      const verbIdx = 2;
      const orig = parts[verbIdx];
      const changed = /s$/i.test(orig) ? orig.replace(/s$/i, '') : `${orig}s`;
      const bad = parts.slice();
      bad[verbIdx] = changed;
      return { bad: bad.join(' '), wrongToken: changed, correctToken: orig };
    }

    return { bad: en + '!', wrongToken: '!', correctToken: '' };
  }

  // Create half-good, half-bad
  const total = Math.min(14, base.length); // short session
  const half = Math.floor(total/2);
  const shuffled = base.sort(() => Math.random() - 0.5).slice(0, total);
  const good = shuffled.slice(0, half).map(it => ({ type:'good', en: makeSentence(it), src: it }));
  const bad = shuffled.slice(half).map(it => { const en = makeSentence(it); const c = corruptSentence(en); return { type:'bad', enBad: c.bad, enCorrect: en, wrongToken: c.wrongToken, correctToken: c.correctToken, src: it }; });
  const rounds = [...good, ...bad].sort(() => Math.random() - 0.5);

  // Start session
  const sessionId = startSession({ mode: MODE, listName: grammarName, wordList: rounds.map((r,i)=>r.src?.word||`s${i}`), meta: { grammarFile } });
  let idx = 0, correct = 0, wrong = 0;

  function addExitButton() {
    // Use standard wa-quit-btn pattern from other modes
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
      if (confirm('Exit this game?')) {
        try { history.back(); } catch { location.reload(); }
      }
    };
    document.body.appendChild(quitBtn);
  }

  function render(){
    if (idx >= rounds.length) return end();
    const r = rounds[idx];
    container.innerHTML = '';
    container.style.cssText = 'padding:20px;max-width:760px;margin:0 auto;font-family:Poppins,Arial,sans-serif;';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;color:#666';
    head.innerHTML = `<div><b>${grammarName || 'Grammar'}</b></div><div>Q ${idx+1}/${rounds.length}</div>`;
    container.appendChild(head);

    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border:3px solid #40D4DE;border-radius:18px;padding:28px;box-shadow:0 6px 14px rgba(64,212,222,.18);margin-bottom:18px;';
    const sentence = (r.type==='good' ? r.en : r.enBad);
    card.innerHTML = `<div style="font-size:24px;line-height:1.5;color:#333;text-align:center">${sentence}</div>`;
    container.appendChild(card);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'O'; okBtn.setAttribute('aria-label','Correct sentence');
    okBtn.style.cssText = baseBtn('#21b5c0');
    const xBtn = document.createElement('button');
    xBtn.textContent = 'X'; xBtn.setAttribute('aria-label','Wrong sentence');
    xBtn.style.cssText = baseBtn('#ff6b6b');
    btnRow.appendChild(okBtn); btnRow.appendChild(xBtn);
    container.appendChild(btnRow);

    const decide = (choice) => {
      const isCorrect = (r.type==='good' && choice==='O') || (r.type==='bad' && choice==='X');
      if (isCorrect) { correct++; playSFX('correct'); } else { wrong++; playSFX('wrong'); }
      reveal(r, isCorrect);
      logAttempt({ session_id: sessionId, mode: MODE, word: r.src?.word || `s${idx}`, is_correct: isCorrect, answer: choice, correct_answer: r.type==='good'?'O':'X', extra:{ type:r.type } });
    };
    okBtn.onclick = () => decide('O');
    xBtn.onclick = () => decide('X');
  }

  function baseBtn(color){
    return `background:#fff;border:3px solid ${color};color:${color};font-weight:800;padding:14px 26px;border-radius:14px;font-size:22px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.06);`;
  }

  function reveal(r, wasRight){
    const controls = container.querySelectorAll('button'); controls.forEach(b=>b.disabled=true);
    const revealBox = document.createElement('div');
    revealBox.style.cssText = 'margin-top:16px;text-align:center';

    if (r.type==='good') {
      revealBox.innerHTML = `<div style="color:#4caf50;font-weight:800;font-size:28px;margin-bottom:10px;">Correct sentence ✔</div>`;
    } else {
      // Build strikeout for wrongToken and animate correctToken over it
      const raw = r.enBad;
      const wrongToken = r.wrongToken || '';
      const safeWrong = wrongToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const badHtml = raw.replace(new RegExp(`\\b${safeWrong}\\b`,'i'), (m)=>`<span class="mistake" style="color:#ff6b6b;font-weight:800;text-decoration:line-through;">${m}</span>`);
      revealBox.innerHTML = `
        <div style="color:#ff6b6b;font-weight:700;margin-bottom:8px;">There is a mistake ✖</div>
        <div style="font-size:22px;line-height:1.6;color:#333;margin-bottom:10px;">${badHtml}</div>
        <div id="fixLine" style="position:relative;min-height:80px;width:100%;max-width:760px;margin:0 auto;padding:0 8px;">
          <span style="position:absolute;left:50%;transform:translateX(-50%);background:#e8f5e9;color:#2e7d32;border:2px solid #2e7d32;padding:12px 20px;border-radius:12px;font-weight:800;font-size:22px;width:100%;box-sizing:border-box;text-align:center;line-height:1.4;word-wrap:break-word;">${r.enCorrect}</span>
        </div>`;
      // simple slide-up animation
      setTimeout(()=>{
        const el = revealBox.querySelector('#fixLine span'); if(!el) return; el.animate([
          { transform:'translate(-50%, 12px)', opacity:.0 },
          { transform:'translate(-50%, 0)', opacity:1 }
        ], { duration:350, easing:'ease-out' });
      }, 50);
    }

    container.appendChild(revealBox);

    // Even larger spacer to push next button further down and avoid overlap
    const spacer = document.createElement('div');
    spacer.style.cssText = 'height:120px;';
    container.appendChild(spacer);

    const next = document.createElement('button');
    next.textContent = (idx < rounds.length-1 ? 'Next' : 'Finish');
    next.style.cssText = baseBtn('#21b5c0') + 'display:block;margin:0 auto;';
    next.onclick = () => { idx++; render(); };
    container.appendChild(next);

    // Add exit button bottom-right (like other modes)
    addExitButton();
  }

  function end(){
    endSession(sessionId, { 
      mode: MODE, 
      summary:{ correct, wrong, total: rounds.length, accuracy: Math.round((correct/(rounds.length||1))*100), grammarName, grammarFile }, 
      listName: grammarName, 
      wordList: rounds.map((r,i)=>r.src?.word||`s${i}`),
      meta: { grammarFile, grammarName }
    });
    playSFX('end');
    // Remove exit button
    const exitBtn = document.getElementById('grammarQuitBtn');
    if (exitBtn) exitBtn.remove();
    
    // Simple summary view inside gameArea without touching global layout
    container.innerHTML = '';
    container.style.cssText = 'padding:20px;max-width:760px;margin:0 auto;font-family:Poppins,Arial,sans-serif;';
    
    const summary = document.createElement('div');
    summary.className = 'wa-card';
    summary.style.cssText = 'padding:32px 24px;text-align:center;max-width:520px;width:100%;margin:40px auto;border-radius:18px;border:2px solid #40D4DE;box-shadow:0 6px 16px rgba(64,212,222,0.24);background:#fff;';
    summary.innerHTML = `
      <div style="font-size:52px;">🎉</div>
      <div style="font-size:24px;font-weight:700;margin:10px 0;color:#21b5c0;">Complete!</div>
      <div style="margin:14px 0;color:#555;font-size:18px;">Score: <b style="font-size:22px;color:#333;">${correct}</b> / ${rounds.length}</div>
      <button id="gfBackBtn" style="${baseBtn('#21b5c0')}margin-top:12px;">Back</button>
    `;
    container.appendChild(summary);

    const backBtn = document.getElementById('gfBackBtn');
    if (backBtn) {
      backBtn.onclick = () => {
        // Prefer returning to grammar mode selector like other grammar modes
        if (window.WordArcade && typeof window.WordArcade.startGrammarModeSelector === 'function') {
          window.WordArcade.startGrammarModeSelector();
        } else if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
          window.WordArcade.quitToOpening(true);
        } else {
          history.back();
        }
      };
    }
  }

  render();
}
