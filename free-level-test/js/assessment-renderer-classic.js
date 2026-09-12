(function(){
'use strict';

function escText(value){return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function escAttr(value){return escText(value).replace(/"/g,"&quot;")}

function create(options){
  options=options||{};
  var tx=options.tx;
  var shuffle=options.shuffle;
  if(typeof tx!=="function")throw new Error("WillenaAssessmentRendererClassic requires tx()");
  if(typeof shuffle!=="function")throw new Error("WillenaAssessmentRendererClassic requires shuffle()");

  function scrambleParts(state){
    var chosen=Array.isArray(state.selected)?state.selected:[];
    var used=new Set(chosen.map(function(x){return x.uid}));
    var available=(state.scramblePool||[]).filter(function(x){return !used.has(x.uid)});
    return{chosen:chosen,available:available};
  }

  function renderScramble(state){
    var parts=scrambleParts(state),chosen=parts.chosen,available=parts.available;
    var meaning=state.current&&state.current.meaning||"";
    return '<p class="prompt scramble-instruction">'+tx("unscramble")+'</p>'+
      (meaning?'<div class="scramble-meaning"><strong>'+escText(meaning)+'</strong></div>':"")+
      '<div class="scramble-answer '+(chosen.length?"has-tokens":"")+'">'+
      (chosen.map(function(x,i){return '<button class="scramble-token chosen" data-chosen="'+i+'">'+escText(x.text)+'</button>'}).join("")||'<span>'+tx("tapUndo")+'</span>')+
      '</div><div class="scramble-bank">'+
      available.map(function(x){return '<button class="scramble-token" data-uid="'+escAttr(x.uid)+'">'+escText(x.text)+'</button>'}).join("")+
      '</div>';
  }

  function listeningMarkup(q,state){
    return '<div class="listening-panel"><div class="listening-icon" aria-hidden="true">🎧</div><p>'+tx("listenInstruction")+'</p><button class="listen-button" id="playAudio" type="button" '+
      (state.playsLeft<=0||state.isSpeaking?'disabled="disabled"':'')+'><span>'+
      (state.isSpeaking?tx("playing"):tx("play"))+'</span></button><small id="playsRemaining">'+state.playsLeft+' '+tx("playsLeft")+'</small></div><p class="prompt listening-question">'+escText(q.q)+'</p>';
  }

  function renderTest(state){
    var q=state.current,n=state.answers.length+1;
    var isScramble=q.type==="sentence_unscramble",isListening=q.type==="listening";
    return '<div class="question-meta"><span>'+tx("question")+' '+n+'</span><span>'+n+' / '+state.maxQ+'</span></div>'+
      '<div class="progress"><i style="width:'+(state.answers.length/state.maxQ*100)+'%"></i></div>'+
      '<div class="question-card" data-question-level="'+escAttr(q.level)+'">'+
      (isScramble?renderScramble(state):(isListening?listeningMarkup(q,state):'<p class="prompt">'+escText(q.q)+'</p>')+
      '<div class="choices">'+shuffle(q.choices).map(function(c){return '<button class="choice" data-value="'+escAttr(c)+'">'+escText(c)+'</button>'}).join("")+'</div>')+
      '</div><div class="actions"><button class="btn btn-primary" id="next" '+
      (isScramble&&state.selected.length===q.tokens.length?'':'disabled="disabled"')+'>'+tx("next")+' →</button></div>';
  }

  return{
    renderScramble:renderScramble,
    listeningMarkup:listeningMarkup,
    renderTest:renderTest,
    escText:escText,
    escAttr:escAttr
  };
}

window.WillenaAssessmentRendererClassic={create:create,escText:escText,escAttr:escAttr};
})();
