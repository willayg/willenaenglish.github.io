(function(global){
'use strict';
var original=global.loadQuestionBank;
if(typeof original!=='function')throw new Error('Assessment question registry requires loadQuestionBank().');
var bank=[],byId={};
function index(items){
  bank=Array.isArray(items)?items:[];
  byId={};
  bank.forEach(function(question){if(question&&question.id!=null)byId[String(question.id)]=question;});
  global.WillenaAssessmentQuestionBank=bank;
  global.dispatchEvent(new CustomEvent('willena:assessment-bank-ready',{detail:{count:bank.length}}));
  return bank;
}
global.loadQuestionBank=function(){return Promise.resolve(original()).then(index);};
global.WillenaAssessmentQuestionRegistry={
  all:function(){return bank.slice();},
  get:function(id){return byId[String(id)]||null;},
  count:function(){return bank.length;}
};
})(window);
