(()=>{
'use strict';
if(window.WillenaAvatarLab)return;
const fields=[
 {key:'kind',label:'Character',options:['Human','Cat','Bunny','Robot','Monster','Fox','Alien']},
 {key:'body',label:'Skin / fur',options:['Peach','Tan','Brown','Ivory','Orange','Pink','Mint','Blue','Purple','Grey','Yellow','Red'],colors:['#f4bf97','#c58b61','#8d553d','#fff5e3','#f99b44','#f39ac0','#87d9b1','#83b9ef','#b5a2ed','#a7b5c7','#f8d36b','#ee7778']},
 {key:'hair',label:'Hair / detail',options:['Plain','Tuft','Spiky','Side sweep','Curly','Long','Fringe','Mohawk']},
 {key:'ink',label:'Hair / accent colour',options:['Dark','Brown','Blond','Red','Pink','Blue','Green','White','Purple'],colors:['#27344c','#75492e','#f2c35e','#c65b43','#ef77b7','#4f9de4','#54b58c','#faf4ee','#8961d0']},
 {key:'eyes',label:'Eyes',options:['Bright','Happy','Sleepy','Wink','Surprised','Determined','Star eyes']},
 {key:'mouth',label:'Mouth',options:['Smile','Grin','Surprised','Serious','Smirk','Tongue','Fangs']},
 {key:'gear',label:'Accessory',options:['None','Glasses','Sunglasses','Headphones','Bow','Cap','Crown','Dragon horns','Electric antenna','Halo'],points:[0,0,0,0,0,0,500,1500,3000,5000]},
 {key:'bg',label:'Background',options:['Sky','Rose','Mint','Lavender','Peach','Sunshine','Midnight','Ocean','Forest','Cherry'],colors:['#d8ecff','#fce0ed','#d9f5e7','#e9dfff','#ffe7d1','#fff0b3','#273650','#aee8ee','#b9e2ab','#f9bac7']},
 {key:'pattern',label:'Pattern',options:['Plain','Stars','Dots','Lightning','Stripes','Bubbles','Sunburst']}
];
const defaults=[0,0,1,0,0,0,0,0,0];
const prefix='al1-';
function encode(values){return Array.isArray(values)&&values.length===fields.length&&values.every((v,i)=>Number.isInteger(v)&&v>=0&&v<fields[i].options.length)?prefix+values.map(v=>v.toString(36)).join(''):null}
function decode(value){if(typeof value!=='string'||!/^al1-[0-9a-z]{9}$/.test(value))return null;const v=Array.from(value.slice(prefix.length),x=>parseInt(x,36));return encode(v)===value?v:null}
function eligible(value,points){const v=decode(value);if(!v)return false;const threshold=fields[6].points[v[6]];return threshold===0||(Number.isFinite(points)&&points>=threshold)}
const line='#293248';
const path=(d,fill='none',stroke=line,width=3)=>'<path d="'+d+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round"/>';
const ellipse=(x,y,rx,ry,fill,stroke='none',width=0)=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'"/>';
const circle=(x,y,r,fill,stroke='none',width=0)=>ellipse(x,y,r,r,fill,stroke,width);
const rect=(x,y,w,h,r,fill,stroke='none',width=0)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'"/>';
const star=(x,y,r,fill)=>path(Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,n=i%2?r*.43:r;return(i?'L':'M')+(x+Math.cos(a)*n).toFixed(1)+' '+(y+Math.sin(a)*n).toFixed(1)}).join(' ')+'Z',fill,'none',0);
function svg(value){
 const v=decode(value);if(!v)return '';
 const [kind,body,hair,ink,eyes,mouth,gear,bg,pattern]=v;
 const skin=fields[1].colors[body],accent=fields[3].colors[ink],back=fields[7].colors[bg];
 let s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" aria-hidden="true" style="display:block;width:100%;height:100%">';
 s+=rect(0,0,128,128,0,back);
 const pale=bg===6?'#91b3e4':'#ffffff';
 s+='<g opacity=".42">';
 if(pattern===1){for(const [x,y,r] of [[15,19,7],[108,18,5],[111,96,8],[14,107,5],[20,59,4],[96,49,4]])s+=star(x,y,r,pale)}
 if(pattern===2){for(let y=8;y<128;y+=20)for(let x=8;x<128;x+=20)s+=circle(x,y,2.7,pale)}
 if(pattern===3)s+=path('M8 12L25 12L15 32L29 29L12 54L15 35L3 38Z',pale,'none')+path('M108 67L124 67L114 86L126 83L109 113L111 92L99 94Z',pale,'none');
 if(pattern===4){for(let x=-100;x<128;x+=22)s+=path('M'+x+' 0h10l128 128h-10Z',pale,'none')}
 if(pattern===5){for(const [x,y,r] of [[16,20,9],[111,33,12],[17,94,12],[108,109,7]])s+=circle(x,y,r,'none',pale,3)}
 if(pattern===6){for(let i=0;i<12;i++){const a=i*Math.PI/6;s+=path('M64 64L'+(64+105*Math.cos(a)).toFixed(1)+' '+(64+105*Math.sin(a)).toFixed(1)+'L'+(64+105*Math.cos(a+.13)).toFixed(1)+' '+(64+105*Math.sin(a+.13)).toFixed(1)+'Z',pale,'none')}}
 s+='</g>';
 // Body and silhouette. Every piece is fixed artwork; no student-supplied SVG or URLs.
 if(kind===0)s+=path('M24 128V118Q27 99 47 96H81Q101 99 104 118V128Z',accent)+rect(54,87,20,21,8,skin,line,3)+ellipse(27,64,8,11,skin,line,3)+ellipse(101,64,8,11,skin,line,3)+rect(31,26,66,73,28,skin,line,3);
 if(kind===1||kind===2||kind===5){
  s+=path('M32 128Q29 105 48 96H80Q99 105 96 128Z',skin);
  if(kind===2)s+=ellipse(43,28,12,27,skin,line,3)+ellipse(85,28,12,27,skin,line,3)+ellipse(43,27,5.5,18,'#f4a3b5')+ellipse(85,27,5.5,18,'#f4a3b5');
  else s+=path('M29 49L25 13Q43 16 54 37M74 37Q86 16 103 13L99 49',skin)+path('M32 37L32 23L44 36M84 36L96 23L96 37','#f3a3b6','none');
  s+=path('M28 55Q30 34 64 34Q98 34 100 55L106 70L99 76L104 80Q91 102 64 103Q37 102 24 80L29 76L22 70Z',skin);
  if(kind===5)s+=path('M30 71Q45 70 64 91Q83 70 98 71Q93 98 64 101Q35 98 30 71Z','#fff3dc','none');
  s+=ellipse(64,78,13,9,kind===5?'#fff3dc':'#fff0dc');
 }
 if(kind===3){
  s+=rect(34,99,60,35,13,accent,line,3)+rect(17,50,15,28,7,accent,line,3)+rect(96,50,15,28,7,accent,line,3)+rect(25,28,78,70,22,skin,line,3)+rect(34,42,60,45,15,'#26364d',line,2)+path('M64 27V16', 'none',line,4)+circle(64,12,6,accent,line,2);
 }
 if(kind===4){
  s+=path('M27 126Q25 103 48 95H80Q103 103 101 126Z',skin)+path('M32 42L20 23Q42 20 46 38M82 38Q86 20 108 23L96 42',accent)+path('M26 67Q18 47 38 37Q45 22 64 31Q86 22 93 40Q110 48 102 68Q112 92 87 99Q65 113 43 99Q16 91 26 67Z',skin);
 }
 if(kind===6){
  s+=path('M39 128Q40 105 54 96H74Q88 105 89 128Z',accent)+path('M64 24Q104 24 103 57Q102 83 81 100Q64 112 47 100Q26 83 25 57Q24 24 64 24Z',skin)+path('M44 30L36 13M84 30L92 13','none',line,3)+circle(36,12,5,accent,line,2)+circle(92,12,5,accent,line,2);
 }
 // Hair and crest layer; on robots this becomes a coloured shell detail.
 const top=kind===3?34:kind===2?34:kind===0?28:36;
 const hairShapes=['','M45 42Q42 23 53 22L59 35Q65 15 72 24L74 34Q86 27 89 39Q70 35 45 42Z','M30 49L25 28L42 34L44 16L57 29L70 14L77 32L96 22L101 46Q65 32 30 49Z','M30 54Q25 25 57 23Q90 15 99 47Q78 46 58 33Q52 53 30 54Z','M29 48Q18 35 34 28Q31 15 48 20Q58 8 68 21Q86 10 90 25Q109 24 100 46Q87 39 76 46Q61 32 49 46Z','M29 84Q18 62 29 39Q32 23 64 23Q98 22 101 49L102 90L92 88L92 47Q66 44 55 33Q47 49 35 51L36 90Z','M29 49Q30 22 64 22Q98 22 99 50L86 44L79 56L68 43L54 55L45 43Z','M47 37Q47 20 56 13L62 24L72 11L77 27L85 25L84 37Z'];
 if(hair&&kind!==3)s+=path(hairShapes[hair],accent,line,2.5);
 if(hair&&kind===3)s+=rect(42,top,44,4,2,accent);
 const yy=kind===3?61:kind===6?63:62, eyeFill=kind===3?'#a8e9ff':line, x1=kind===6?45:47,x2=kind===6?83:81;
 for(const [x,side] of [[x1,0],[x2,1]]){
  if(eyes===1||(eyes===3&&side===1))s+=path('M'+(x-7)+' '+(yy+2)+'q7 -10 14 0','none',eyeFill,4);
  else if(eyes===2)s+=path('M'+(x-7)+' '+yy+'h14','none',eyeFill,4);
  else if(eyes===4)s+=ellipse(x,yy,7,9,'#fff',line,2)+circle(x,yy,3,line);
  else if(eyes===5)s+=ellipse(x,yy+2,5,6,eyeFill)+path('M'+(x-8)+' '+(yy-9)+'l16 '+(side?-5:5),'none',eyeFill,3);
  else if(eyes===6)s+=star(x,yy,8,kind===3?'#ffdb67':'#d69622');
  else s+=ellipse(x,yy,5.5,7,eyeFill)+circle(x+1.8,yy-2.3,1.8,'#fff');
 }
 if(kind===1||kind===2||kind===5)s+=path('M59 75Q64 71 69 75L64 79Z','#e8879d',line,1.5);
 if(kind===0||kind===4||kind===6)s+=ellipse(38,76,5,2.5,'#ed8ea0')+ellipse(90,76,5,2.5,'#ed8ea0');
 const my=kind===3?76:85,mc=kind===3?'#a8e9ff':line;
 if(mouth===0)s+=path('M56 '+my+'q8 9 16 0','none',mc,2.8);
 if(mouth===1)s+=path('M53 '+(my-2)+'Q64 '+(my+3)+' 75 '+(my-2)+'Q73 '+(my+13)+' 64 '+(my+12)+'Q55 '+(my+13)+' 53 '+(my-2)+'Z','#fff',mc,2.5);
 if(mouth===2)s+=ellipse(64,my+2,5,6,mc);
 if(mouth===3)s+=path('M58 '+(my+2)+'h12','none',mc,3);
 if(mouth===4)s+=path('M56 '+(my+3)+'q11 2 16 -5','none',mc,3);
 if(mouth===5)s+=path('M54 '+my+'q10 7 20 0Q70 '+(my+15)+' 64 '+(my+15)+'Q56 '+(my+15)+' 54 '+my+'Z','#ed85a2',mc,2.5);
 if(mouth===6)s+=path('M52 '+my+'q12 6 24 0Q70 '+(my+11)+' 64 '+(my+9)+'Q58 '+(my+11)+' 52 '+my+'Z',mc)+path('M55 '+(my+2)+'l5 7 4-5M73 '+(my+2)+'l-5 7-4-5','#fff','none');
 if(gear===1||gear===2){s+=path('M29 58H33M59 59H69M95 58h4','none',line,3)+rect(33,51,27,21,7,gear===2?line:'none',line,3)+rect(68,51,27,21,7,gear===2?line:'none',line,3);if(gear===2)s+=path('M37 56l9 9M72 56l9 9','none','#637c98',2)}
 if(gear===3)s+=path('M22 67V53Q22 22 64 22Q106 22 106 53V67','none',line,7)+rect(15,55,15,28,6,accent,line,3)+rect(98,55,15,28,6,accent,line,3);
 if(gear===4)s+=path('M81 32L73 21Q83 17 91 27Q99 17 109 21L101 32L109 43Q99 47 91 37Q83 47 73 43Z','#ed7eb4',line,2)+circle(91,32,5,'#f9b7d9',line,2);
 if(gear===5)s+=path('M29 37Q27 12 63 12Q97 12 97 37Z',accent,line,3)+path('M27 37Q64 30 102 36Q120 40 98 46L28 44Z',accent,line,3);
 if(gear===6)s+=path('M35 38L29 12L49 23L64 6L79 23L99 12L93 38Z','#ffd35a',line,3)+rect(35,32,58,9,3,'#f1ad35',line,2)+circle(64,25,4,'#ef75a8',line,1.5);
 if(gear===7)s+=path('M35 41Q15 23 25 7Q28 22 48 30Z','#f5c980',line,3)+path('M93 41Q113 23 103 7Q100 22 80 30Z','#f5c980',line,3);
 if(gear===8)s+=path('M63 37V15','none',line,4)+circle(63,12,6,'#ffdc56',line,2)+path('M38 17l8-10-1 9 8-3M82 13l8-7-1 9 8 1','none','#4cb7df',3);
 if(gear===9)s+=ellipse(64,15,30,9,'none','#d29b23',5)+ellipse(64,13,30,7,'none','#ffdf78',3);
 return s+'</svg>';
}
function render(el,value){if(!el||!decode(value))return false;const art=document.createElement('span');art.setAttribute('aria-hidden','true');art.style.cssText='display:block;width:100%;height:100%;aspect-ratio:1;max-width:100%;max-height:100%;border-radius:50%;overflow:hidden;flex:none';art.innerHTML=svg(value);el.dataset.avatarValue=value;el.dataset.avatarArt='1';el.style.padding='0';el.replaceChildren(art);return true}
function mount({modal,getSelected,getPoints,onChoose}){
 if(!modal)return null;if(modal.__avatarLab)return modal.__avatarLab;
 const grid=modal.querySelector('#emojiGrid'),dialog=modal.querySelector('.avatar-dialog'),actions=modal.querySelector('.avatar-actions');if(!grid||!dialog||!actions)return null;
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
 const button=(cls,text)=>{const e=make('button',cls,text);e.type='button';return e};
 const toolbar=make('div','al-toolbar'),launch=button('al-launch','Create your own avatar'),tile=button('al-custom-tile','');tile.hidden=true;tile.setAttribute('aria-label','Select your custom avatar');toolbar.append(launch,tile);grid.before(toolbar);
 const panel=make('section','al-panel');panel.hidden=true;panel.setAttribute('aria-label','Avatar Lab');
 const top=make('div','al-top'),back=button('al-secondary','‹ Back'),title=make('strong','','Avatar Lab'),random=button('al-secondary','Random');top.append(back,title,random);
 const preview=make('div','al-preview'),controls=make('div','al-controls'),note=make('div','al-note','Make it yours!'),use=button('al-use','Use this avatar');
 panel.append(top,preview,controls,note,use);grid.after(panel);
 let values=defaults.slice(),custom=null;
 const selects=fields.map((f,i)=>{const row=make('label','al-field'),name=make('span','',f.label),select=make('select','');f.options.forEach((n,j)=>{const o=make('option','',n);o.value=String(j);select.append(o)});row.append(name,select);controls.append(row);select.addEventListener('change',()=>{values[i]=Number(select.value);refresh()});return select});
 function points(){const p=getPoints();return Number.isFinite(p)?p:NaN}
 function refresh(){selects.forEach((sel,i)=>{sel.value=String(values[i]);if(i===6)Array.from(sel.options).forEach((o,j)=>{const required=fields[6].points[j];o.disabled=required>0&&!(points()>=required);o.textContent=fields[6].options[j]+(o.disabled?' · '+required.toLocaleString()+' pts (locked)':'')})});const code=encode(values);render(preview,code);const allowed=eligible(code,points());use.disabled=!allowed;note.textContent=allowed?'Choose a style, then save in the avatar picker.':'Unlock this accessory with more points.'}
 function chooseCustom(){if(!custom||!eligible(custom,points()))return;onChoose(custom);sync()}
 function sync(){const v=getSelected();if(decode(v))custom=v;tile.hidden=!custom;if(custom){render(tile,custom);tile.classList.toggle('selected',v===custom);tile.disabled=!eligible(custom,points())}if(!panel.hidden)refresh()}
 function leave(){panel.hidden=true;grid.hidden=false;toolbar.hidden=false;actions.hidden=false;launch.focus()}
 function open(){const v=decode(getSelected())||decode(custom);values=v?v.slice():defaults.slice();toolbar.hidden=true;grid.hidden=true;actions.hidden=true;panel.hidden=false;refresh();back.focus()}
 launch.addEventListener('click',open);tile.addEventListener('click',chooseCustom);back.addEventListener('click',leave);
 random.addEventListener('click',()=>{values=fields.map((f,i)=>{const opts=f.options.map((_,j)=>j).filter(j=>i!==6||f.points[j]===0||points()>=f.points[j]);return opts[Math.floor(Math.random()*opts.length)]});refresh()});
 use.addEventListener('click',()=>{const code=encode(values);if(!eligible(code,points()))return;custom=code;onChoose(code);leave();sync()});
 const api={sync,reset(){panel.hidden=true;grid.hidden=false;toolbar.hidden=false;actions.hidden=false;custom=decode(getSelected())?getSelected():null;sync()},isOpen:()=>!panel.hidden,back:leave};
 modal.__avatarLab=api;api.reset();return api
}
window.WillenaAvatarLab=Object.freeze({fields,encode,decode,eligible,svg,render,mount});
})();