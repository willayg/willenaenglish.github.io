(function(global){
'use strict';
var coach=global.WillenaAICoach;
if(!coach||typeof coach.registerProvider!=='function')return;
var cache={};
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function shuffle(a){a=arr(a).slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),x=a[i];a[i]=a[j];a[j]=x;}return a;}
function unique(a){var seen={},out=[];arr(a).forEach(function(x){var id=text(x&&x.id||x&&x.sourceId);if(!id||seen[id])return;seen[id]=1;out.push(x);});return out;}
function bookLevel(b,ctx){var n=Number(b&&(b.public_level||b.publicLevel))||0;if(!n&&Number(b&&b.internal_level_id)>2)n=Number(b.internal_level_id)-2;return n||Number(ctx&&ctx.bookPublicLevel)||Number(ctx&&ctx.publicLevel)||0;}
coach.registerProvider('unit',async function(args,ctx){
  args=args||{};if(!ctx)return null;
  var api=global.WillenaStudyQuestionBank;if(!api||typeof api.loadUnit!=='function')return null;
  var bookId=text(args.bookId||ctx.bookId),unitId=text(args.unitId||ctx.unitId),books=arr(ctx.books),book=books.find(function(b){return String(b&&b.book_id)===bookId;})||ctx.book;
  if(!book)return null;
  var units=arr(book.units),unit=units.find(function(u){return String(u&&u.id)===unitId;})||((String(ctx.unitId)===unitId)?ctx.unit:null);
  if(!unit)return null;
  var level=bookLevel(book,ctx),key=bookId+'|'+unitId;
  if(!cache[key])cache[key]=api.loadUnit(level,{bookId:bookId,unitId:unitId,bookTitle:text(book.book_title||book.title),unitNumber:Number(unit.unit_number)||1}).catch(function(){return[];});
  var all=unique(await cache[key]),skill=text(args.skill);
  if(skill)all=all.filter(function(x){return text(x&&x.skill)===skill;});
  var items=shuffle(all).slice(0,Number(args.count)||10);
  if(!items.length)return{type:'coach_unit',title:args.title||{ko:'추천 연습',en:'Recommended practice'},message:{ko:'이 단원에서 해당 영역의 연습 문제를 찾지 못했어요.',en:'I could not find practice questions for that skill in this unit.'},items:[]};
  return{type:'coach_unit',title:args.title||{ko:'추천 연습',en:'Recommended practice'},message:args.message||{ko:'이 단원의 해당 영역 문제만 골랐어요.',en:'I picked only the matching skill questions from that unit.'},items:items};
});
global.WillenaCoachTargetedPractice={version:'targeted-practice-v1'};
})(window);
