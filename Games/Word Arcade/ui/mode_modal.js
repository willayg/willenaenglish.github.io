// Mode Modal UI
export function showModeModal({ onModeChosen, onClose }) {
  let modal = document.getElementById('modeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modeModal';
    modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:1000;';
    modal.innerHTML = `<div style="background:#fff;padding:32px 24px;border-radius:18px;box-shadow:0 4px 24px rgba(60,60,80,0.18);min-width:320px;text-align:center;">
      <h2 style="margin-bottom:18px;color:#19777e;">Choose a Mode</h2>
      <div style="margin-bottom:24px;">
        <button class="mode-btn" data-mode="meaning">Meaning Match</button>
        <button class="mode-btn" data-mode="spelling">Spelling</button>
        <button class="mode-btn" data-mode="listening">Listening Mode</button>
        <button class="mode-btn" data-mode="picture">Picture Mode</button>
        <button class="mode-btn" data-mode="listen_and_spell">Listen and Spell</button>
        <button class="mode-btn" data-mode="multi_choice_kor_to_eng">Multi Choice Kor→Eng</button>
        <button class="mode-btn" data-mode="multi_choice_eng_to_kor">Multi Choice Eng→Kor</button>
      </div>
      <button id="closeModeModal" style="font-size:1em;padding:8px 22px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Cancel</button>
    </div>`;
    document.body.appendChild(modal);
  } else {
    modal.style.display = 'flex';
  }
  document.querySelectorAll('#modeModal .mode-btn').forEach(btn => {
    btn.onclick = () => {
      modal.style.display = 'none';
      onModeChosen(btn.dataset.mode);
    };
  });
  document.getElementById('closeModeModal').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
}
