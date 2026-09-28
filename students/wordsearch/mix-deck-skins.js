(() => {
  if (document.getElementById('mix-deck-skins')) return;
  const style = document.createElement('style');
  style.id = 'mix-deck-skins';
  style.textContent = `
    .mix-match-grid[data-deck-style] .mix-card-mark{
      font-size:0!important;
      width:68px!important;
      height:68px!important;
      border-radius:10px!important;
      border:4px solid #173b43!important;
    }

    .mix-match-grid[data-deck-style="puzzle-block"] .mix-card-back{
      background:#55d8e5!important;
      border:5px solid #173b43!important;
      box-shadow:5px 6px 0 #173b43!important;
    }
    .mix-match-grid[data-deck-style="puzzle-block"] .mix-card-mark{
      background:
        linear-gradient(90deg,#fff 0 46%,#173b43 46% 54%,#ffd9ea 54% 100%),
        linear-gradient(#fff 0 46%,#173b43 46% 54%,#ffd9ea 54% 100%)!important;
    }

    .mix-match-grid[data-deck-style="maze-tile"] .mix-card-back{
      background:#fff!important;
      border:5px solid #173b43!important;
      box-shadow:5px 6px 0 #ed78b4!important;
    }
    .mix-match-grid[data-deck-style="maze-tile"] .mix-card-mark{
      background:
        linear-gradient(90deg,transparent 0 18%,#55d8e5 18% 34%,transparent 34% 52%,#173b43 52% 68%,transparent 68%),
        linear-gradient(transparent 0 18%,#ed78b4 18% 34%,transparent 34% 52%,#55d8e5 52% 68%,transparent 68%),
        #fff!important;
    }

    .mix-match-grid[data-deck-style="pixel-badge"] .mix-card-back{
      background:#ffdeec!important;
      border:5px solid #173b43!important;
      box-shadow:5px 6px 0 #173b43!important;
    }
    .mix-match-grid[data-deck-style="pixel-badge"] .mix-card-mark{
      border-radius:4px!important;
      background:
        linear-gradient(#173b43 0 0) 0 0/20px 20px,
        linear-gradient(#55d8e5 0 0) 24px 0/20px 20px,
        linear-gradient(#173b43 0 0) 48px 0/20px 20px,
        linear-gradient(#55d8e5 0 0) 0 24px/20px 20px,
        linear-gradient(#ed78b4 0 0) 24px 24px/20px 20px,
        linear-gradient(#55d8e5 0 0) 48px 24px/20px 20px,
        linear-gradient(#173b43 0 0) 0 48px/20px 20px,
        linear-gradient(#55d8e5 0 0) 24px 48px/20px 20px,
        linear-gradient(#173b43 0 0) 48px 48px/20px 20px!important;
      background-repeat:no-repeat!important;
    }
  `;
  document.head.appendChild(style);
})();