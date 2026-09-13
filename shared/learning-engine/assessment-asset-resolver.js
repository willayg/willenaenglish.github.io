(function(global){
'use strict';
var BASE='/Assets/level-test/noto/';
var NOTO='https://raw.githubusercontent.com/googlefonts/noto-emoji/main/svg/';
var registry={
  toothbrush:'toothbrush.svg',
  spoon:'spoon.svg',
  pencil:'pencil.svg',
  cat:{url:NOTO+'emoji_u1f431.svg'},
  dog:{url:NOTO+'emoji_u1f436.svg'},
  tiger:{url:NOTO+'emoji_u1f42f.svg'},
  rabbit:{url:NOTO+'emoji_u1f430.svg'},
  frog:{url:NOTO+'emoji_u1f438.svg'},
  fish:{url:NOTO+'emoji_u1f41f.svg'},
  bird:{url:NOTO+'emoji_u1f426.svg'},
  apple:{url:NOTO+'emoji_u1f34e.svg'},
  book:{url:NOTO+'emoji_u1f4d6.svg'},
  books:{url:NOTO+'emoji_u1f4da.svg'},
  'soccer-ball':{url:NOTO+'emoji_u26bd.svg'},
  basketball:{url:NOTO+'emoji_u1f3c0.svg'},
  car:{url:NOTO+'emoji_u1f697.svg'},
  bus:{url:NOTO+'emoji_u1f68c.svg'},
  train:{url:NOTO+'emoji_u1f686.svg'},
  airplane:{url:NOTO+'emoji_u2708.svg'},
  bicycle:{url:NOTO+'emoji_u1f6b2.svg'},
  chair:{url:NOTO+'emoji_u1fa91.svg'},
  school:{url:NOTO+'emoji_u1f3eb.svg'},
  house:{url:NOTO+'emoji_u1f3e0.svg'},
  office:{url:NOTO+'emoji_u1f3e2.svg'},
  hospital:{url:NOTO+'emoji_u1f3e5.svg'},
  stadium:{url:NOTO+'emoji_u1f3df.svg'},
  park:{url:NOTO+'emoji_u1f3de.svg'},
  tree:{url:NOTO+'emoji_u1f333.svg'},
  backpack:{url:NOTO+'emoji_u1f392.svg'},
  phone:{url:NOTO+'emoji_u1f4f1.svg'},
  laptop:{url:NOTO+'emoji_u1f4bb.svg'},
  headphones:{url:NOTO+'emoji_u1f3a7.svg'},
  ticket:{url:NOTO+'emoji_u1f3ab.svg'},
  calendar:{url:NOTO+'emoji_u1f4c5.svg'},
  'alarm-clock':{url:NOTO+'emoji_u23f0.svg'},
  'clock-eight':{url:NOTO+'emoji_u1f557.svg'},
  running:{url:NOTO+'emoji_u1f3c3.svg'},
  walking:{url:NOTO+'emoji_u1f6b6.svg'},
  swimming:{url:NOTO+'emoji_u1f3ca.svg'},
  reading:{url:NOTO+'emoji_u1f4d6.svg'},
  writing:{url:NOTO+'emoji_u270d.svg'},
  dancing:{url:NOTO+'emoji_u1f483.svg'},
  microphone:{url:NOTO+'emoji_u1f3a4.svg'},
  cooking:{url:NOTO+'emoji_u1f373.svg'},
  art:{url:NOTO+'emoji_u1f3a8.svg'},
  bento:{url:NOTO+'emoji_u1f371.svg'},
  sandwich:{url:NOTO+'emoji_u1f96a.svg'},
  'fork-knife':{url:NOTO+'emoji_u1f374.svg'},
  'juice-box':{url:NOTO+'emoji_u1f9c3.svg'},
  water:{url:NOTO+'emoji_u1f4a7.svg'},
  hamburger:{url:NOTO+'emoji_u1f354.svg'},
  'rice-ball':{url:NOTO+'emoji_u1f359.svg'},
  sun:{url:NOTO+'emoji_u2600.svg'},
  cloud:{url:NOTO+'emoji_u2601.svg'},
  rain:{url:NOTO+'emoji_u1f327.svg'},
  umbrella:{url:NOTO+'emoji_u2614.svg'},
  'red-circle':{url:NOTO+'emoji_u1f534.svg'},
  'blue-circle':{url:NOTO+'emoji_u1f535.svg'},
  'green-circle':{url:NOTO+'emoji_u1f7e2.svg'},
  'yellow-circle':{url:NOTO+'emoji_u1f7e1.svg'},
  'purple-circle':{url:NOTO+'emoji_u1f7e3.svg'},
  'orange-circle':{url:NOTO+'emoji_u1f7e0.svg'},
  'brown-circle':{url:NOTO+'emoji_u1f7e4.svg'},
  'black-circle':{url:NOTO+'emoji_u26ab.svg'}
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
