(function(){
  'use strict';

  var root=document.getElementById('app');
  var scripts=[
    {src:'./js/assessment-loader.js?v=20260731-1',kind:'loader'},
    {src:'./js/dialogue-tts.js?v=20260730-3'},
    {src:'./js/app.js?v=20260731-1',kind:'module'},
    {src:'./js/reading-layout.js?v=20260730-2'},
    {src:'./js/listening-compact.js?v=20260730-5'},
    {src:'./js/report-enhancer.js?v=20260730-3',kind:'module'},
    {src:'./js/debug-level-meter.js?v=20260730-3'}
  ];

  function showError(error){
    console.error('[LevelTestBootstrap]',error);
    if(!root)return;
    root.innerHTML='<section class="screen screen-safe-in screen-safe-ready"><h2>테스트를 불러올 수 없습니다</h2><p class="error">페이지를 새로고침해 주세요.</p></section>';
  }

  function prepare(code,kind){
    if(kind==='module'){
      code=code.replace(/^\s*import[^;]+;\s*/,'');
    }
    if(kind==='loader'){
      code=code.replace(/\bexport\s+/g,'');
      code+='\nwindow.loadQuestionBank=loadQuestionBank; window.loadJSON=loadJSON;';
    }
    return code;
  }

  function runScript(entry){
    var url=new URL(entry.src,document.baseURI).href;
    return fetch(url,{cache:'no-store'}).then(function(response){
      if(!response.ok)throw new Error('Could not load '+url+' ('+response.status+')');
      return response.text();
    }).then(function(code){
      var runnable=prepare(code,entry.kind);
      new Function(runnable+'\n//# sourceURL='+url)();
    });
  }

  var chain=Promise.resolve();
  scripts.forEach(function(entry){
    chain=chain.then(function(){return runScript(entry);});
  });
  chain.catch(showError);
})();
