(function(){
'use strict';

var originalLoad=window.loadQuestionBank;
if(typeof originalLoad!=="function")return;

function shuffle(items){
  return items.slice().sort(function(){return Math.random()-.5});
}

function chooseGrammarErrors(items){
  var errors=shuffle(items.filter(function(item){return item.type==="grammar_error";}));
  if(errors.length<=2)return errors;

  var first=errors[0];
  var far=errors.filter(function(item){return Math.abs(Number(item.level)-Number(first.level))>=4;});
  var second=(far.length?far:errors.filter(function(item){return item.id!==first.id;}))[0];
  return second?[first,second]:[first];
}

window.loadQuestionBank=function(){
  return Promise.resolve(originalLoad()).then(function(bank){
    var allowedErrors=new Set(chooseGrammarErrors(bank).map(function(item){return item.id;}));
    return bank.filter(function(item){
      return item.type!=="grammar_error"||allowedErrors.has(item.id);
    }).map(function(item){
      if(item.type!=="grammar_application")return item;
      var copy={};
      Object.keys(item).forEach(function(key){copy[key]=item[key];});
      copy.type="grammar";
      copy.metadata=Object.assign({},item.metadata||{},{database_item_type:"grammar_application"});
      return copy;
    });
  });
};
})();
