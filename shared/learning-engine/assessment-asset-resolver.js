(function(global){
'use strict';
var BASE='/Assets/level-test/noto/';
var registry={
  toothbrush:'toothbrush.svg',
  spoon:'spoon.svg',
  pencil:'pencil.svg'
};
function key(value){return String(value==null?'':value).trim().toLowerCase().replace(/[\s_]+/g,'-');}
function resolve(assetKey){
  var k=key(assetKey);
  if(!k)return null;
  var file=registry[k];
  return file?BASE+file:null;
}
function register(assetKey,file){
  var k=key(assetKey),f=String(file==null?'':file).trim();
  if(!k||!f)return false;
  registry[k]=f;
  return true;
}
function has(assetKey){return Boolean(resolve(assetKey));}
global.WillenaAssessmentAssets={resolve:resolve,register:register,has:has,base:BASE};
})(window);
