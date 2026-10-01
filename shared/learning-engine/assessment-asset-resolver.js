(function(global){
'use strict';
var BASE='/Assets/level-test/google/';
var NOTO=BASE;
var registry={
  toothbrush:'emoji_u1faa5.svg',
  spoon:'emoji_u1f944.svg',
  pencil:'emoji_u270f.svg',
  happy:'emoji_u1f600.svg',
  sad:'emoji_u1f622.svg',
  tired:'emoji_u1f62b.svg',
  angry:'emoji_u1f620.svg',
  hungry:'emoji_u1f924.svg',
  cold:'emoji_u1f976.svg',
  cat:'emoji_u1f431.svg',
  dog:'emoji_u1f436.svg',
  tiger:'emoji_u1f42f.svg',
  rabbit:'emoji_u1f430.svg',
  frog:'emoji_u1f438.svg',
  fish:'emoji_u1f41f.svg',
  bird:'emoji_u1f426.svg',
  mouse:'emoji_u1f42d.svg',
  elephant:'emoji_u1f418.svg',
  apple:'emoji_u1f34e.svg',
  'green-apple':'emoji_u1f34f.svg',
  banana:'emoji_u1f34c.svg',
  orange:'emoji_u1f34a.svg',
  grapes:'emoji_u1f347.svg',
  milk:'emoji_u1f95b.svg',
  soup:'emoji_u1f963.svg',
  book:'emoji_u1f4d6.svg',
  'open-book':'emoji_u1f4d6.svg',
  'closed-book':'emoji_u1f4d5.svg',
  books:'emoji_u1f4da.svg',
  notebook:'emoji_u1f4d3.svg',
  ruler:'emoji_u1f4cf.svg',
  pen:'emoji_u1f58a.svg',
  'soccer-ball':'emoji_u26bd.svg',
  basketball:'emoji_u1f3c0.svg',
  baseball:'emoji_u26be.svg',
  tennis:'emoji_u1f3be.svg',
  'ice-skate':'emoji_u26f8.svg',
  car:'emoji_u1f697.svg',
  bus:'emoji_u1f68c.svg',
  train:'emoji_u1f686.svg',
  airplane:'emoji_u2708.svg',
  bicycle:'emoji_u1f6b2.svg',
  chair:'emoji_u1fa91.svg',
  door:'emoji_u1f6aa.svg',
  box:'emoji_u1f4e6.svg',
  school:'emoji_u1f3eb.svg',
  house:'emoji_u1f3e0.svg',
  office:'emoji_u1f3e2.svg',
  hospital:'emoji_u1f3e5.svg',
  stadium:'emoji_u1f3df.svg',
  park:'emoji_u1f3de.svg',
  tree:'emoji_u1f333.svg',
  backpack:'emoji_u1f392.svg',
  phone:'emoji_u1f4f1.svg',
  laptop:'emoji_u1f4bb.svg',
  headphones:'emoji_u1f3a7.svg',
  ticket:'emoji_u1f3ab.svg',
  calendar:'emoji_u1f4c5.svg',
  'alarm-clock':'emoji_u23f0.svg',
  'clock-eight':'emoji_u1f557.svg',
  running:'emoji_u1f3c3.svg',
  walking:'emoji_u1f6b6.svg',
  standing:'emoji_u1f9cd.svg',
  swimming:'emoji_u1f3ca.svg',
  reading:'emoji_u1f4d6.svg',
  writing:'emoji_u270d.svg',
  dancing:'emoji_u1f483.svg',
  microphone:'emoji_u1f3a4.svg',
  cooking:'emoji_u1f373.svg',
  art:'emoji_u1f3a8.svg',
  bento:'emoji_u1f371.svg',
  sandwich:'emoji_u1f96a.svg',
  'fork-knife':'emoji_u1f374.svg',
  'juice-box':'emoji_u1f9c3.svg',
  water:'emoji_u1f4a7.svg',
  hamburger:'emoji_u1f354.svg',
  'rice-ball':'emoji_u1f359.svg',
  'birthday-cake':'emoji_u1f382.svg',
  'christmas-tree':'emoji_u1f384.svg',
  sun:'emoji_u2600.svg',
  cloud:'emoji_u2601.svg',
  rain:'emoji_u1f327.svg',
  umbrella:'emoji_u2614.svg',
  'red-circle':'emoji_u1f534.svg',
  'blue-circle':'emoji_u1f535.svg',
  'green-circle':'emoji_u1f7e2.svg',
  'yellow-circle':'emoji_u1f7e1.svg',
  'purple-circle':'emoji_u1f7e3.svg',
  'orange-circle':'emoji_u1f7e0.svg',
  'brown-circle':'emoji_u1f7e4.svg',
  'black-circle':'emoji_u26ab.svg'
};
function key(value){return String(value==null?'':value).trim().toLowerCase().replace(/[\s_]+/g,'-');}
function resolve(assetKey){
  var k=key(assetKey);
  if(!k)return null;
  var entry=registry[k];
  if(!entry)return null;
  if(typeof entry==='string')return BASE+entry;
  return entry&&entry.url?entry.url:null;
}
function register(assetKey,file){
  var k=key(assetKey),f=String(file==null?'':file).trim();
  if(!k||!f)return false;
  registry[k]=f;
  return true;
}
function registerUrl(assetKey,url){
  var k=key(assetKey),u=String(url==null?'':url).trim();
  if(!k||!/^https:\/\//i.test(u))return false;
  registry[k]={url:u};
  return true;
}
function has(assetKey){return Boolean(resolve(assetKey));}
function list(){return Object.keys(registry).slice();}
global.WillenaAssessmentAssets={resolve:resolve,register:register,registerUrl:registerUrl,has:has,list:list,base:BASE,notoBase:NOTO};
})(window);
