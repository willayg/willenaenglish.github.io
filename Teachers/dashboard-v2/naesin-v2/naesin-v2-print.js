(function(){
'use strict';

// Small shared UI hardening loaded on every Naesin V2 page.
// Keep the wide stats matrix inside its own scroll container, matching UX_UI_GUIDE.html.
if(!document.getElementById('na2MatrixScrollFix')){
  const style=document.createElement('style');
  style.id='na2MatrixScrollFix';
  style.textContent=`
    .na2-shell,.na2-tests,.na2-test,.na2-test-copy{min-width:0;max-width:100%}
    .na2-matrix-wrap{
      display:block;
      width:100%;
      max-width:100%;
      overflow-x:auto!important;
      overflow-y:hidden;
      -webkit-overflow-scrolling:touch;
      overscroll-behavior-x:contain;
      touch-action:pan-x pan-y;
      scrollbar-gutter:stable;
    }
    .na2-matrix{width:max-content!important;min-width:1050px;max-width:none}
    .na2-matrix th:first-child,.na2-matrix td:first-child{
      position:sticky;
      left:0;
      z-index:3;
      background:#fff;
      box-shadow:1px 0 0 #e6edef;
    }
    .na2-matrix th:first-child{z-index:4;background:#fbfdfd}
    .na2-matrix-wrap::-webkit-scrollbar{height:10px}
    .na2-matrix-wrap::-webkit-scrollbar-track{background:#eef5f6}
    .na2-matrix-wrap::-webkit-scrollbar-thumb{background:#b8dfe3;border-radius:999px}
  `;
  document.head.appendChild(style);
}

window.NaesinV2Print={
  openEditor(){console.info('[Naesin V2] print editor bridge not wired yet');},
  makePdf(){console.info('[Naesin V2] direct PDF bridge not wired yet');}
};
})();
