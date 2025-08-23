// Mode Selector UI
export function renderModeSelector({ onModeChosen, onWordsClick }) {
  const container = document.getElementById('gameArea');
  
  // Show the menu bar
  const menuBar = document.getElementById('menuBar');
  if (menuBar) {
    menuBar.style.display = 'flex';
    
    // Wire up navigation
    const wordsBtn = document.getElementById('wordsBtn');
    const modeBtn = document.getElementById('modeBtn');
    
    if (wordsBtn) wordsBtn.onclick = onWordsClick;
    if (modeBtn) modeBtn.style.color = '#93cbcf'; // Highlight current section
  }
  
  container.innerHTML = `<div style="text-align:center;padding:40px;">
    <h2>Choose a Mode</h2>
    <div style="
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      max-width: 600px;
      margin: 24px auto;
      padding: 0 20px;
    ">
      <button class="mode-btn" data-mode="meaning" style="
        width: 100%;
        height: 120px;
        border: 2px solid #19777e;
        border-radius: 12px;
        background: #93cbcf;
        color: #fff;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        line-height: 1.2;
        box-shadow: 0 2px 8px rgba(60,60,80,0.08);
        touch-action: manipulation;
      " onmouseover="this.style.background='#19777e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(60,60,80,0.15)'; this.style.borderColor='#93cbcf'" onmouseout="this.style.background='#93cbcf'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(60,60,80,0.08)'; this.style.borderColor='#19777e'">Meaning Match</button>
      
      <button class="mode-btn" data-mode="spelling" style="
        width: 100%;
        height: 120px;
        border: 2px solid #19777e;
        border-radius: 12px;
        background: #93cbcf;
        color: #fff;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        line-height: 1.2;
        box-shadow: 0 2px 8px rgba(60,60,80,0.08);
        touch-action: manipulation;
      " onmouseover="this.style.background='#19777e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(60,60,80,0.15)'; this.style.borderColor='#93cbcf'" onmouseout="this.style.background='#93cbcf'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(60,60,80,0.08)'; this.style.borderColor='#19777e'">Spelling</button>
      
      <button class="mode-btn" data-mode="listening" style="
        width: 100%;
        height: 120px;
        border: 2px solid #19777e;
        border-radius: 12px;
        background: #93cbcf;
        color: #fff;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        line-height: 1.2;
        box-shadow: 0 2px 8px rgba(60,60,80,0.08);
        touch-action: manipulation;
      " onmouseover="this.style.background='#19777e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(60,60,80,0.15)'; this.style.borderColor='#93cbcf'" onmouseout="this.style.background='#93cbcf'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(60,60,80,0.08)'; this.style.borderColor='#19777e'">Listening Mode</button>
      
      <button class="mode-btn" data-mode="picture" style="
        width: 100%;
        height: 120px;
        border: 2px solid #19777e;
        border-radius: 12px;
        background: #93cbcf;
        color: #fff;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        line-height: 1.2;
        box-shadow: 0 2px 8px rgba(60,60,80,0.08);
        touch-action: manipulation;
      " onmouseover="this.style.background='#19777e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(60,60,80,0.15)'; this.style.borderColor='#93cbcf'" onmouseout="this.style.background='#93cbcf'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(60,60,80,0.08)'; this.style.borderColor='#19777e'">Picture Mode</button>
      
      <button class="mode-btn" data-mode="listen_and_spell" style="
        width: 100%;
        height: 120px;
        border: 2px solid #19777e;
        border-radius: 12px;
        background: #93cbcf;
        color: #fff;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        line-height: 1.2;
        box-shadow: 0 2px 8px rgba(60,60,80,0.08);
        touch-action: manipulation;
      " onmouseover="this.style.background='#19777e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(60,60,80,0.15)'; this.style.borderColor='#93cbcf'" onmouseout="this.style.background='#93cbcf'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(60,60,80,0.08)'; this.style.borderColor='#19777e'">Listen and Spell</button>
      
      <button class="mode-btn" data-mode="multi_choice_kor_to_eng" style="
        width: 100%;
        height: 120px;
        border: 2px solid #19777e;
        border-radius: 12px;
        background: #93cbcf;
        color: #fff;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        line-height: 1.2;
        box-shadow: 0 2px 8px rgba(60,60,80,0.08);
        touch-action: manipulation;
      " onmouseover="this.style.background='#19777e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(60,60,80,0.15)'; this.style.borderColor='#93cbcf'" onmouseout="this.style.background='#93cbcf'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(60,60,80,0.08)'; this.style.borderColor='#19777e'">Multi Choice<br>Kor→Eng</button>
      
      <button class="mode-btn" data-mode="multi_choice_eng_to_kor" style="
        width: 100%;
        height: 120px;
        border: 2px solid #19777e;
        border-radius: 12px;
        background: #93cbcf;
        color: #fff;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        line-height: 1.2;
        box-shadow: 0 2px 8px rgba(60,60,80,0.08);
        touch-action: manipulation;
      " onmouseover="this.style.background='#19777e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(60,60,80,0.15)'; this.style.borderColor='#93cbcf'" onmouseout="this.style.background='#93cbcf'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(60,60,80,0.08)'; this.style.borderColor='#19777e'">Multi Choice<br>Eng→Kor</button>
    </div>
  </div>`;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => onModeChosen(btn.dataset.mode);
  });
}
