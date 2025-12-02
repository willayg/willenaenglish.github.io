// Star Overlay Animation for Full Arcade Rounds
// Provides showRoundStars({ correct, total }) that:
// 1. Computes starCount using same pct thresholds as mode selector.
// 2. Shows a semi-transparent overlay with 5 stars that fill sequentially.
// 3. Plays Lydian scale notes (C D E F# G) for each earned star using Web Audio API.
// 4. Displays a tiered message.
// 5. Auto dismisses after delay or on user interaction (click / key).
// 6. Accessible with aria-live and aria-label.

(function(){
  const LYDIAN_FREQS = [261.63, 293.66, 329.63, 369.99, 392.00]; // C D E F# G
  const MESSAGES = {
    0: 'Try again for a better score!',
    1: 'Keep practicing!',
    2: 'Good effort!',
    3: 'Great job!',
    4: 'Excellent work!',
    5: 'Perfect! You nailed it!'
  };

  function pctToStars(pct){
    if (pct == null) return 0;
    if (pct >= 100) return 5;
    if (pct > 90) return 4;
    if (pct > 80) return 3;
    if (pct > 70) return 2;
    if (pct >= 60) return 1;
    return 0;
  }

  function ensureStyles(){
    if (document.getElementById('star-overlay-styles')) return;
    const css = `
      .star-round-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:8000;font-family:'Poppins',system-ui,sans-serif;animation:starFadeIn .25s ease forwards;}
      .star-round-panel{background:#ffffff; padding:28px 32px 30px; border-radius:28px; text-align:center; position:relative; box-shadow:0 6px 30px -4px rgba(0,0,0,.25); border:2px solid #67e2e6;}
      .star-row{--fa-star-size:2.6em; --fa-star-gap:0.55em; display:flex;gap:var(--fa-star-gap);justify-content:center;margin:6px 0 14px;}
      /* Each star slot scales from the configurable CSS var rather than inheriting button font sizes elsewhere */
      .star-row.size-lg{--fa-star-size:3em;}
      .star-row.size-md{--fa-star-size:2.6em;}
      .star-row.size-sm{--fa-star-size:2.2em;}
      .star-slot{width:var(--fa-star-size);height:var(--fa-star-size);position:relative;flex:0 0 var(--fa-star-size);} 
      .star-slot svg{width:100%;height:100%;filter:drop-shadow(0 2px 4px rgba(0,0,0,.25));}
      .star-empty path{fill:#e2e8f0;stroke:#cbd5e1;stroke-width:1;}
      .star-filled path{fill:url(#goldGradient);stroke:#f8d24b;stroke-width:1.5;}
      .star-glow{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 50%,rgba(255,241,150,.75),rgba(255,241,150,0) 70%);opacity:0;pointer-events:none;}
      .star-slot.filling .star-glow{animation:starGlow .65s ease forwards;}
      .star-slot.filling svg{animation:starPop .55s cubic-bezier(.34,1.56,.64,1) forwards;}
      .star-msg{font-size:1.05rem;font-weight:700;color:#0f172a;margin-top:4px;min-height:1.4em;}
      .star-sub{font-size:.8rem;color:#475569;margin-top:4px;}
      .star-skip-hint{position:absolute;bottom:6px;left:0;right:0;font-size:.65rem;color:#64748b;letter-spacing:.5px;}
      @keyframes starPop{0%{transform:scale(.4) rotate(-12deg);}60%{transform:scale(1.15) rotate(5deg);}100%{transform:scale(1) rotate(0);} }
      @keyframes starGlow{0%{opacity:0;transform:scale(.35);}40%{opacity:1;}100%{opacity:0;transform:scale(1.2);} }
      @keyframes starFadeIn{from{opacity:0;}to{opacity:1;}}
      @keyframes starFadeOut{to{opacity:0;}}
    `;
    const style = document.createElement('style');
    style.id='star-overlay-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function playNote(freq, idx){
    try {
      const ctx = (window.__starAudioCtx || (window.__starAudioCtx = new (window.AudioContext||window.webkitAudioContext)()));
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const now = ctx.currentTime;
      const dur = 0.45;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + .02);
    } catch(e){}
  }

  function buildStarSVG(id){
    // No fixed pixel sizing; parent slot governs final size via CSS vars.
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="goldGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#ffeaa7"/><stop offset="55%" stop-color="#f8d24b"/><stop offset="100%" stop-color="#f6b93b"/></linearGradient></defs><path d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`;
  }

  function removeOverlay(overlay){
    if (!overlay) return; 
    overlay.style.animation='starFadeOut .25s ease forwards';
    setTimeout(()=>{ try { overlay.remove(); } catch{} }, 240);
  }

  function showRoundStars({ correct, total }){
    ensureStyles();
    const pct = total ? Math.round((correct/total)*100) : 0;
    const starCount = pctToStars(pct);

    // Remove existing if any
    try { document.querySelectorAll('.star-round-overlay').forEach(n=>n.remove()); } catch{}

    const overlay = document.createElement('div');
    overlay.className='star-round-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-live','polite');
    overlay.setAttribute('aria-label', `Round result: ${correct} of ${total} correct. ${starCount} stars.`);

    const panel = document.createElement('div');
    panel.className='star-round-panel';

    const msg = document.createElement('div');
    msg.className='star-msg';
    msg.textContent = MESSAGES[starCount] || '';

    const sub = document.createElement('div');
    sub.className='star-sub';
    sub.textContent = `${correct} / ${total}  (${pct}%)`;

  const row = document.createElement('div');
  row.className='star-row size-lg'; // default large size; adjust classes if needed

    for (let i=0;i<5;i++){
      const slot = document.createElement('div');
      slot.className='star-slot';
      slot.innerHTML = `<div class="star-glow"></div>${buildStarSVG(i)}`;
      const svgEl = slot.querySelector('svg');
      if (svgEl) svgEl.setAttribute('class','star-empty'); // use setAttribute for SVG compatibility
      row.appendChild(slot);
    }

    const skip = document.createElement('div');
    skip.className='star-skip-hint';
    skip.textContent='Tap / press any key to continue';

    panel.appendChild(row);
    panel.appendChild(msg);
    panel.appendChild(sub);
    panel.appendChild(skip);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let dismissed = false;
    function dismiss(){ if (dismissed) return; dismissed = true; removeOverlay(overlay); }

    overlay.addEventListener('click', dismiss);
    window.addEventListener('keydown', dismiss, { once:true });

    // Sequential fill animation
    for (let i=0;i<starCount;i++){
      setTimeout(()=>{
        const slot = row.children[i];
        if (!slot) return;
        slot.classList.add('filling');
        const svg = slot.querySelector('svg');
        if (svg) svg.setAttribute('class','star-filled');
        playNote(LYDIAN_FREQS[i] || LYDIAN_FREQS[LYDIAN_FREQS.length-1], i);
      }, i*260 + 180);
    }

  // Auto dismiss after final star animation or after 3s if no stars (was 2s)
  const totalDelay = starCount ? (180 + starCount*260 + 1700) : 2500;
  setTimeout(dismiss, totalDelay);

    return { dismiss };
  }

  // Expose
  window.showRoundStars = showRoundStars;
})();
