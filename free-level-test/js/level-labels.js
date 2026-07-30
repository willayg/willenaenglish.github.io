(function(){
  'use strict';

  var names={
    1:'Starter 1',
    2:'Starter 2',
    3:'Level 1',
    4:'Level 2',
    5:'Level 3',
    6:'Level 4',
    7:'Level 5',
    8:'Level 6',
    9:'Level 7',
    10:'Level 8'
  };

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
    node.nodeValue=raw.replace(trimmed,replacement);
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
      if(prefix)prefix.textContent='';
    }
  }

  function updateDebugMeter(){
    var meter=document.querySelector('#debugLevelMeter');
    if(!meter)return;
    var value=meter.querySelector('.debug-level-meter__value');
    if(value){
      var match=(value.textContent||'').match(/(?:Level\s*)?(10|[1-9])/i);
      if(match)value.textContent=levelName(match[1],false);
    }
    var shortNames={1:'S1',2:'S2',3:'1',4:'2',5:'3',6:'4',7:'5',8:'6',9:'7',10:'8'};
    var segments=meter.querySelectorAll('.debug-level-meter__track span');
    for(var i=0;i<segments.length;i++){
      var internal=Number(segments[i].getAttribute('data-level'));
      var label=segments[i].querySelector('b');
      if(label&&shortNames[internal])label.textContent=shortNames[internal];
      segments[i].setAttribute('aria-label',levelName(internal,false));
    }
  }

  function scan(root){
    root=root||document.body;
    if(!root)return;
    if(root.nodeType===3){replaceTextNode(root);return}
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false);
    var node;
    while((node=walker.nextNode()))replaceTextNode(node);
    updateReportHero();
    updateDebugMeter();
  }

  var queued=false;
  function scheduleScan(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(function(){queued=false;scan(document.body)});
  }

  new MutationObserver(scheduleScan).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  scan(document.body);
})();