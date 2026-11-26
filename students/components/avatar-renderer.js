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
const characters=Object.freeze([{"id":"ft-bunny-1","name":"Bunny Fox Classic","character":"bunny","characterName":"Bunny Fox","unlockPoints":100},{"id":"ft-bunny-2","name":"Bunny Fox Aviator","character":"bunny","characterName":"Bunny Fox","unlockPoints":100},{"id":"ft-bunny-3","name":"Bunny Fox Wink","character":"bunny","characterName":"Bunny Fox","unlockPoints":100},{"id":"ft-pigfish-1","name":"Pigfish Classic","character":"pigfish","characterName":"Pigfish","unlockPoints":300},{"id":"ft-pigfish-2","name":"Pigfish Diver","character":"pigfish","characterName":"Pigfish","unlockPoints":300},{"id":"ft-pigfish-3","name":"Pigfish Pirate","character":"pigfish","characterName":"Pigfish","unlockPoints":300},{"id":"ft-willi-1","name":"Willo Classic","character":"willi","characterName":"Willo","unlockPoints":0},{"id":"ft-willi-2","name":"Willo Star","character":"willi","characterName":"Willo","unlockPoints":0},{"id":"ft-willi-3","name":"Willo Bubbles","character":"willi","characterName":"Willo","unlockPoints":0},{"id":"ft-willy-1","name":"AI Willi Classic","character":"willy","characterName":"AI Willi","unlockPoints":0},{"id":"ft-willy-2","name":"AI Willi Cool","character":"willy","characterName":"AI Willi","unlockPoints":0},{"id":"ft-willy-3","name":"AI Willi Pixel","character":"willy","characterName":"AI Willi","unlockPoints":0},{"id":"ft-dusk-1","name":"Dusk Classic","character":"dusk","characterName":"Dusk","unlockPoints":5000},{"id":"ft-dusk-2","name":"Dusk Goggles","character":"dusk","characterName":"Dusk","unlockPoints":5000},{"id":"ft-dusk-3","name":"Dusk Star","character":"dusk","characterName":"Dusk","unlockPoints":5000},{"id":"ft-steve-1","name":"Sergeant Steve Classic","character":"steve","characterName":"Sergeant Steve","unlockPoints":8000},{"id":"ft-steve-2","name":"Sergeant Steve Cool","character":"steve","characterName":"Sergeant Steve","unlockPoints":8000},{"id":"ft-steve-3","name":"Sergeant Steve Furious","character":"steve","characterName":"Sergeant Steve","unlockPoints":8000}].map(Object.freeze));
const choices=Object.freeze([...characters,...illustrated,...originals,...classic.map(([id,name])=>({id,name}))].map(Object.freeze));
const characterMap=new Map(characters.map(c=>[c.id,c]));
function eligible(value,points){const c=characterMap.get(value);return !c||c.unlockPoints===0||(Number.isFinite(points)&&points>=c.unlockPoints);}
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
 if(characterMap.has(v)||index(v)>=0)return v;
 return Object.hasOwn(legacy,v)?legacy[v]:'wa11';
}
function render(el,value){
 if(!el)return;
 const v=normalize(value),i=index(v);
 el.dataset.avatarValue=v;
 if(characterMap.has(v)){
  const j=characters.findIndex(c=>c.id===v),art=document.createElement('span');art.setAttribute('aria-hidden','true');art.style.cssText='display:block;width:100%;height:100%;max-width:100%;max-height:100%;aspect-ratio:1;flex:none;border-radius:50%;background-image:url("/students/assets/avatars/free-talking-avatars.svg?v=1");background-repeat:no-repeat;background-size:300% 600%;background-position:'+((j%3)*50)+'% '+(Math.floor(j/3)*20)+'%;';el.dataset.avatarArt='1';el.style.padding='0';el.replaceChildren(art);return;
 }
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
window.WillenaAvatar=Object.freeze({choices,index,normalize,render,value,eligible,characters});
})();