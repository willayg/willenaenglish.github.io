(function(){
  'use strict';

  var names={1:'Starter 1',2:'Starter 2',3:'Level 1',4:'Level 2',5:'Level 3',6:'Level 4',7:'Level 5',8:'Level 6',9:'Level 7',10:'Level 8'};

  function levelName(level,plus){
    var n=Math.max(1,Math.min(10,Number(level)||1));
    return names[n]+(plus?'+':'');
  }

  window.willenaLevelName=levelName;

  function replaceTextNode(node){
    if(!node||node.nodeType!==3)return;
    var raw=node.nodeValue||'';
    var trimmed=raw.trim();
    var match=trimmed.match(/^(?:Level|단계)\s*(10|[1-9])(\+)?$/i);
    if(!match)return;
    var replacement=levelName(match[1],Boolean(match[2]));
    if(replacement!==trimmed)node.nodeValue=raw.replace(trimmed,replacement);
  }

  function updateReportHero(){
    var hero=document.querySelector('.report-level');
    if(!hero)return;
    var strong=hero.querySelector('strong');
    var prefix=hero.querySelector('span');
    if(!strong)return;
    var value=(strong.textContent||'').trim();
    if(/^\d+$/.test(value)){
      strong.textContent=levelName(value,false);
      if(prefix&&prefix.textContent)prefix.textContent='';
    }
  }

  function scan(root){
    if(!root)return;
    if(root.nodeType===3){replaceTextNode(root);return;}
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false);
    var node;
    while((node=walker.nextNode()))replaceTextNode(node);
    updateReportHero();
  }

  var queued=false;
  function scheduleScan(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(function(){queued=false;scan(document.querySelector('#app'));});
  }

  var app=document.querySelector('#app');
  if(app)new MutationObserver(scheduleScan).observe(app,{childList:true,subtree:true,characterData:true});
  scan(app);
})();
