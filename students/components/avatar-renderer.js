// One compact sprite; old emoji selections resolve to original Willena avatars.
(function(){
'use strict';
if(window.WillenaAvatar)return;
const names=['Pilot Fox','Shadow Cat','Ribbon Bunny','Axolotl','Red Panda','Cyclops Alien','Purple Monster','Space Octopus','Fire Dragon','Snow Yeti','Happy Robot','Astronaut','Cat Bot','Builder Bot','Ice Knight','Mushroom','Griffin','Grumpy Dumpling','Strawberry Ninja','Cool Toast'];
const choices=Object.freeze(names.map((name,i)=>Object.freeze({id:'wa'+String(i+1).padStart(2,'0'),name})));
function index(value){const match=/^wa(0[1-9]|1[0-9]|20)$/.exec(String(value||''));return match?Number(match[1])-1:-1}
const legacy=Object.freeze({"🦊":"wa01","🐺":"wa01","🦝":"wa01","🐶":"wa01","🐱":"wa02","🐯":"wa02","🦁":"wa02","🐰":"wa03","🐇":"wa03","🐹":"wa03","🐭":"wa03","🐿":"wa03","🐸":"wa04","🦎":"wa04","🐟":"wa04","🐠":"wa04","🐡":"wa04","🐬":"wa04","🐳":"wa04","🐋":"wa04","🦈":"wa04","🐼":"wa05","🐻":"wa05","🐨":"wa05","🦨":"wa05","🦡":"wa05","🐌":"wa06","🐛":"wa06","🐜":"wa06","🐝":"wa06","🐞":"wa06","🐵":"wa07","🐷":"wa07","🐗":"wa07","🦔":"wa07","🦏":"wa07","🦛":"wa07","🐙":"wa08","🦑":"wa08","🦐":"wa08","🦀":"wa08","🦞":"wa08","🐲":"wa09","🦖":"wa09","🦕":"wa09","🐊":"wa09","🐍":"wa09","🐑":"wa10","🐐":"wa10","🦙":"wa10","🐮":"wa10","🦬":"wa10","🙂":"wa11","😀":"wa11","😃":"wa11","😄":"wa11","😊":"wa11","🤖":"wa11","🧑‍🚀":"wa12","👨‍🚀":"wa12","👩‍🚀":"wa12","😺":"wa13","😸":"wa13","🐘":"wa14","🐪":"wa14","🐫":"wa14","🐢":"wa15","🦋":"wa16","🦅":"wa17","🦉":"wa17","🦇":"wa17","🐔":"wa17","🐧":"wa17","🐦":"wa17","🐤":"wa17","🦆":"wa17","🥟":"wa18","🦄":"wa19","🐴":"wa19","🦓":"wa19","🦌":"wa19","🦒":"wa19","🍞":"wa20"});
function normalize(value){
 const v=String(value||'').trim().replace(/\uFE0F/g,'');
 if(index(v)>=0)return v;
 return Object.hasOwn(legacy,v)?legacy[v]:'wa11';
}
function render(el,value){
 if(!el)return;
 const v=normalize(value),i=index(v);
 el.dataset.avatarValue=v;
 const art=document.createElement('span');
 art.setAttribute('aria-hidden','true');
 art.style.cssText='display:block;width:100%;height:100%;max-width:100%;max-height:100%;aspect-ratio:1;flex:none;border-radius:50%;background-image:url("/students/assets/avatars/willena-originals.svg?v=1");background-repeat:no-repeat;background-size:500% 400%;background-position:'+((i%5)*25)+'% '+(Math.floor(i/5)*100/3)+'%;';
 el.dataset.avatarArt='1';el.style.padding='0';el.replaceChildren(art);
}
function value(el){return el?.dataset.avatarValue||el?.textContent.trim()||''}
window.WillenaAvatar=Object.freeze({choices,index,normalize,render,value});
})();