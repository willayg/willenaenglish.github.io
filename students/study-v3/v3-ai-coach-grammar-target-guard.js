(function(global){
'use strict';
var VERSION='coach-grammar-target-guard-v1.0',tries=0;
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}}
function answerText(v){if(typeof v==='string'||typeof v==='number')return String(v);if(v&&typeof v==='object')return text(v.text||v.answer||v.value);return'';}
function choiceText(v){return typeof v==='string'?v:text(v&&v.text||v&&v.option_text);}
function exactHaveHas(item){var a=answerText(item&&item.answer).toLowerCase(),cs=arr(item&&item.choices).map(choiceText).map(function(x){return x.toLowerCase();});return (a==='have'||a==='has')&&cs.indexOf('have')>=0&&cs.indexOf('has')>=0;}
function sentenceSource(item){var a=answerText(item&&item.answer);if(/\b(have|has)\b/i.test(a)&&a.split(/\s+/).length>=3)return a;var cs=arr(item&&item.choices).map(choiceText);for(var i=0;i<cs.length;i++)if(/\b(have|has)\b/i.test(cs[i])&&cs[i].split(/\s+/).length>=3)return cs[i];var p=text(item&&item.prompt);if(/\b(have|has)\b/i.test(p)&&p.split(/\s+/).length>=3)return p;return'';}
function convertHaveHas(item,i){var sentence=sentenceSource(item);if(!sentence)return null;var m=sentence.match(/\b(have|has)\b/i);if(!m)return null;var aux=m[1].toLowerCase(),out=clone(item)||{};out.id=text(out.id||'guard-have-has')+'-havehas-'+i;out.prompt=sentence.replace(/\b(have|has)\b/i,'___');out.context='Choose have or has.';out.answer=aux;out.choices=['have','has'];out.itemType='grammar_choice';out.metadata=Object.assign({},out.metadata||{},{stage5_target_guard:true,stage5_tested_form:'have_has'});return out;}
function guard(result,input){if(!result||text(input&&input.conceptCode)!=='have_has')return result;var source=arr(result.items),safe=[],seen={};source.forEach(function(item,i){var x=exactHaveHas(item)?clone(item):convertHaveHas(item,i);if(!x)return;var k=text(x.prompt).toLowerCase();if(!k||seen[k])return;seen[k]=1;safe.push(x);});var wanted=Math.max(3,Math.min(6,Number(input&&input.count)||4)),selected=safe.slice(0,wanted);return Object.assign({},result,{items:safe,selected:selected,itemCount:safe.length,targetGuard:'have_has'});}
function install(){var r=global.WillenaCoachConceptRetriever;if(!r||r.__targetGuard||typeof r.remediationSet!=='function')return false;var original=r.remediationSet.bind(r);r.remediationSet=async function(input){var result=await original(input);return guard(result,input||{});};r.__targetGuard=true;r.targetGuardVersion=VERSION;return true;}
function boot(){if(install())return;var t=setInterval(function(){tries++;if(install()||tries>100)clearInterval(t);},100);}
boot();
global.WillenaCoachGrammarTargetGuard={version:VERSION,install:install,guard:guard,exactHaveHas:exactHaveHas,convertHaveHas:convertHaveHas};
})(window);