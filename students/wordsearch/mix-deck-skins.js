(() => {
  if (document.getElementById('mix-deck-skins')) return;
  const style = document.createElement('style');
  style.id = 'mix-deck-skins';
  style.textContent = `
    .mix-match-grid[data-deck-style="diamond-block"] .mix-card-back{
      background:#55d8e5!important;
      border:5px solid #173b43!important;
      box-shadow:5px 6px 0 #173b43!important;
    }
    .mix-match-grid[data-deck-style="diamond-block"] .mix-card-back::after{
      display:none!important;
    }
    .mix-match-grid[data-deck-style="diamond-block"] .mix-card-mark{
      width:82px!important;
      height:82px!important;
      border:0!important;
      background:transparent!important;
      display:grid!important;
      grid-template-columns:repeat(2,30px)!important;
      grid-template-rows:repeat(2,30px)!important;
      gap:7px!important;
      place-content:center!important;
      transform:rotate(45deg)!important;
    }
    .mix-match-grid[data-deck-style="diamond-block"] .mix-card-mark i{
      display:block!important;
      width:30px!important;
      height:30px!important;
      border:4px solid #173b43!important;
      border-radius:7px!important;
      box-sizing:border-box!important;
      background:#fff!important;
    }
    .mix-match-grid[data-deck-style="diamond-block"] .mix-card-mark i:nth-child(2),
    .mix-match-grid[data-deck-style="diamond-block"] .mix-card-mark i:nth-child(3){
      background:#ffd9ea!important;
    }
  `;
  document.head.appendChild(style);
})();