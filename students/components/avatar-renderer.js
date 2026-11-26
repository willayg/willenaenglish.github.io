// One compact sprite; legacy emojis and initials still work.
(function(){
'use strict';
if(window.WillenaAvatar)return;
const names=['Pilot Fox','Shadow Cat','Ribbon Bunny','Axolotl','Red Panda','Cyclops Alien','Purple Monster','Space Octopus','Fire Dragon','Snow Yeti','Happy Robot','Astronaut','Cat Bot','Builder Bot','Ice Knight','Mushroom','Griffin','Grumpy Dumpling','Strawberry Ninja','Cool Toast'];
const choices=Object.freeze(names.map((name,i)=>Object.freeze({id:'wa'+String(i+1).padStart(2,'0'),name})));
function index(value){const match=/^wa(0[1-9]|1[0-9]|20)$/.exec(String(value||''));return match?Number(match[1])-1:-1}
function render(el,value){
 if(!el)return;
 const v=String(value||'🙂'),i=index(v);
 el.dataset.avatarValue=v;
 if(i<0){el.textContent=v;if(el.dataset.avatarArt==='1'){el.style.removeProperty('padding');delete el.dataset.avatarArt}return}
 const art=document.createElement('span');
 art.setAttribute('aria-hidden','true');
 art.style.cssText='display:block;width:100%;height:100%;max-width:100%;max-height:100%;aspect-ratio:1;flex:none;border-radius:50%;background-image:url("/students/assets/avatars/willena-originals.svg?v=1");background-repeat:no-repeat;background-size:500% 400%;background-position:'+((i%5)*25)+'% '+(Math.floor(i/5)*100/3)+'%;';
 el.dataset.avatarArt='1';el.style.padding='0';el.replaceChildren(art);
}
function value(el){return el?.dataset.avatarValue||el?.textContent.trim()||''}
window.WillenaAvatar=Object.freeze({choices,index,render,value});
})();