// UI modal for live leaderboard display after a timed round
// Minimal, dependency-free markup; poll refresh support via callback

export function showLeaderboardModal({ title = 'Leaderboard', entries = [], onClose, onRefresh, onReplay, refreshIntervalMs = 5000 }) {
  let overlay = document.getElementById('leaderboardOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'leaderboardOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9000;';
    document.body.appendChild(overlay);
  }

  function rankMedal(i) {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `${i + 1}.`;
  }

  const rows = (entries || []).map((e, i) => {
    const name = (e.name || 'Player').toString();
    const score = Number(e.score || 0);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px dashed #edf1f4;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.2rem;">${rankMedal(i)}</span>
        <span style="font-weight:800;color:#19777e;">${name}</span>
      </div>
      <div style="font-weight:900;color:#0f172a;">${score}</div>
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" aria-label="${title}" style="background:#fff;border-radius:18px;border:2px solid #67e2e6;box-shadow:0 10px 30px rgba(0,0,0,.25);width:min(560px,92vw);max-height:min(82vh,880px);display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e6eaef;">
        <div style="font-weight:900;font-size:1.1rem;color:#19777e;">${title}</div>
        <div style="display:flex;align-items:center;gap:8px;"></div>
      </div>
      <div style="padding:10px 12px;">
        <div id="lbRows" style="border:1px solid #e6eaef;border-radius:12px;max-height:56vh;overflow:auto;">${rows || '<div style=\'padding:12px;\'>No scores yet.</div>'}</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:10px;">
          ${onReplay ? '<button id="lbReplayBtn" style="background:#19777e;color:#fff;border:none;padding:8px 16px;border-radius:10px;font-weight:800;cursor:pointer;">Replay</button>' : ''}
        </div>
      </div>
    </div>`;

  function cleanup() { try { overlay.remove(); } catch {} }
  const closeBtn = null;
  const closeX = null;
  const refreshBtn = null;
  const replayBtn = overlay.querySelector('#lbReplayBtn');

  // No close X; overlay click still closes if needed
  overlay.onclick = (e) => { if (e.target === overlay) { cleanup(); if (onClose) onClose(); } };
  if (replayBtn && onReplay) replayBtn.onclick = () => { cleanup(); onReplay(); };

  let timer = null;
  // Auto-refresh disabled when no refresh button; keep simple static view
  return {
    close: () => { if (timer) clearInterval(timer); cleanup(); },
    render: (newEntries = []) => {
      const lb = document.getElementById('lbRows');
      if (!lb) return;
      const items = (newEntries || []).map((e, i) => {
        const name = (e.name || 'Player').toString();
        const score = Number(e.score || 0);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px dashed #edf1f4;">
          <div style="display:flex;align-items:center;gap:10px;"><span style="font-size:1.2rem;">${medal}</span><span style="font-weight:800;color:#19777e;">${name}</span></div>
          <div style="font-weight:900;color:#0f172a;">${score}</div>
        </div>`;
      }).join('');
      lb.innerHTML = items || '<div style="padding:12px;">No scores yet.</div>';
    }
  };
}
