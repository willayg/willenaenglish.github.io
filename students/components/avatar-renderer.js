// Original Willena avatars plus individually matched animal artwork.
// Animals without approved artwork retain their classic icon and identity.
(function(){
'use strict';
if(window.WillenaAvatar)return;
const names=["Pilot Fox","Shadow Cat","Ribbon Bunny","Axolotl","Red Panda","Cyclops Alien","Purple Monster","Space Octopus","Fire Dragon","Snow Yeti","Happy Robot","Astronaut","Cat Bot","Builder Bot","Ice Knight","Mushroom","Griffin","Grumpy Dumpling","Strawberry Ninja","Cool Toast"];
const animals=[["🐶","Dog"],["🐱","Cat"],["🐰","Bunny"],["🦊","Fox"],["🐻","Bear"],["🐼","Panda"],["🐨","Koala"],["🐯","Tiger"],["🦁","Lion"],["🐮","Cow"],["🐷","Pig"],["🐸","Frog"],["🐵","Monkey"],["🦄","Unicorn"],["🐔","Chicken"],["🐧","Penguin"],["🐦","Parrot"],["🐤","Chick"],["🦅","Eagle"],["🦉","Owl"],["🐺","Howling Wolf"],["🦝","Raccoon"],["🦙","Llama"],["🐴","Horse"],["🦓","Zebra"],["🦌","Deer"],["🐑","Sheep"],["🐐","Goat"],["🦒","Giraffe"],["🐘","Elephant"],["🦏","Rhino"],["🦛","Hippo"],["🐇","Rabbit"],["🦎","Lizard"],["🐍","Snake"],["🐢","Turtle"],["🐊","Crocodile"],["🐬","Dolphin"],["🐳","Spouting Whale"],["🐋","Whale"],["🦈","Shark"],["🐠","Clownfish"],["🐡","Pufferfish"],["🐙","Octopus"],["🦥","Sleepy Sloth"]];
const classic=[["🐭","Mouse"],["🐹","Hamster"],["🦆","Duck"],["🦇","Bat"],["🦨","Skunk"],["🦡","Badger"],["🐗","Boar"],["🦬","Bison"],["🐪","Dromedary Camel"],["🐫","Bactrian Camel"],["🦔","Hedgehog"],["🐿️","Chipmunk"],["🦖","T-Rex"],["🦕","Sauropod"],["🐟","Fish"],["🦐","Shrimp"],["🦑","Squid"],["🦀","Crab"],["🦞","Lobster"],["🦋","Butterfly"],["🐌","Snail"],["🐛","Caterpillar"],["🐜","Ant"],["🐝","Bee"],["🐞","Ladybug"]];
const id=(prefix,i)=>prefix+String(i+1).padStart(2,'0');
const originals=names.map((name,i)=>({id:id('wa',i),name}));
const illustrated=animals.map(([emoji,name],i)=>({id:id('an',i),name}));
const choices=Object.freeze([...illustrated,...originals,...classic.map(([id,name])=>({id,name}))].map(Object.freeze));
const strip=v=>String(v||'').trim().replace(/\uFE0F/g,'');
const legacy=Object.freeze(Object.fromEntries([...animals.map(([emoji],i)=>[strip(emoji),id('an',i)]),...classic.map(([emoji])=>[strip(emoji),emoji]),...Object.entries({"🐲":"wa09","🙂":"wa11","😀":"wa11","😃":"wa11","😄":"wa11","😊":"wa11","🤖":"wa11","🧑‍🚀":"wa12","👨‍🚀":"wa12","👩‍🚀":"wa12","😺":"wa13","😸":"wa13","🥟":"wa18","🍞":"wa20"})]));
function index(value){
 const m=/^(wa|an)(\d{2})$/.exec(String(value||''));
 if(!m)return -1;
 const i=Number(m[2])-1;
 return m[1]==='wa'?(i>=0&&i<names.length?i:-1):(i>=0&&i<animals.length?names.length+i:-1);
}
function normalize(value){
 const v=strip(value);
 if(index(v)>=0)return v;
 return Object.hasOwn(legacy,v)?legacy[v]:'wa11';
}
function render(el,value){
 if(!el)return;
 const v=normalize(value),i=index(v);
 el.dataset.avatarValue=v;
 if(i<0){
   el.textContent=v;
   if(el.dataset.avatarArt==='1'){el.style.removeProperty('padding');delete el.dataset.avatarArt}
   return;
 }
 const animal=i>=names.length,j=animal?i-names.length:i,cols=animal?9:5,rows=animal?5:4;
 const src=animal?'willena-animals-v1.svg':'willena-originals.svg?v=1';
 const art=document.createElement('span');
 art.setAttribute('aria-hidden','true');
 art.style.cssText='display:block;width:100%;height:100%;max-width:100%;max-height:100%;aspect-ratio:1;flex:none;border-radius:50%;background-image:url("/students/assets/avatars/'+src+'");background-repeat:no-repeat;background-size:'+(cols*100)+'% '+(rows*100)+'%;background-position:'+((j%cols)*100/(cols-1))+'% '+(Math.floor(j/cols)*100/(rows-1))+'%;';
 el.dataset.avatarArt='1';el.style.padding='0';el.replaceChildren(art);
}
function value(el){return el?.dataset.avatarValue||el?.textContent.trim()||''}
window.WillenaAvatar=Object.freeze({choices,index,normalize,render,value});
})();