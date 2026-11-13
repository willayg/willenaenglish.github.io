// Shared AI Willy robot vector. Studio, character portraits, and active Free Talking actor use the identical SVG path generator.
export const DEFAULT_WILLY_CONFIG=Object.freeze({head:114,body:74,headY:0,eyes:100,legs:72,antenna:88,arms:95,tabletSize:100,expression:'smile',pose:'wave',tablet:'yes',shell:'#f8fbff',navy:'#142b51',yellow:'#ffce12',face:'#101b30',eyesColor:'#9cddff',outline:'#294674'});
export function createWillySvg(config=DEFAULT_WILLY_CONFIG,options={}){
 const c={...DEFAULT_WILLY_CONFIG,...config};
 // Crop the approved mascot to a talking head, without redrawing its face.
 // Both the selection portrait and the live actor import this same SVG.
 if(options.headOnly){
  const full=createWillySvg(c,{...options,headOnly:false,portrait:false,stage:false});
  const defs=full.match(/<defs>[\s\S]*?<\/defs>/)?.[0]||'';
  const start=full.indexOf('<g id="head"');
  if(start<0)throw Error('AI Willy head group missing');
  const head=full.slice(start,full.lastIndexOf('</svg>'));
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="175 55 450 470" class="bf-svg aw-svg aw-talking-head" width="800" height="800" preserveAspectRatio="xMidYMid meet" role="img" aria-label="AI Willy talking head">'+defs+head+'</svg>';
 }

 const H=c.head/100,B=c.body/100,E=c.eyes/100,L=c.legs/100,A=c.antenna/100,R=c.arms/100,T=c.tabletSize/100;
 const n=c.navy,o=c.outline,w=c.shell,y=c.yellow,f=c.face,eye=c.eyesColor;
 const upper=210+c.headY,hy=upper,cy=hy+148*H,bodyY=cy+83;
 // Face center is x=400; keep both eyes exactly symmetrical for every eye-size setting.
 const eyeLeft=400-(43*E),eyeRight=400+(43*E);
 const eyes=c.expression==='open'
 ?'<ellipse cx="'+eyeLeft+'" cy="314" rx="23" ry="27" fill="'+eye+'"/><ellipse cx="'+eyeRight+'" cy="314" rx="23" ry="27" fill="'+eye+'"/><circle cx="'+eyeLeft+'" cy="314" r="12" fill="'+f+'"/><circle cx="'+eyeRight+'" cy="314" r="12" fill="'+f+'"/>'
 :'<path d="M'+(eyeLeft-28)+' 326 Q'+eyeLeft+' 275 '+(eyeLeft+28)+' 326" fill="none" stroke="'+eye+'" stroke-width="14" stroke-linecap="round"/>'+(c.expression==='wink'?'<path d="M'+(eyeRight-24)+' 321 L'+(eyeRight+24)+' 321" stroke="'+eye+'" stroke-width="13" stroke-linecap="round"/>':'<path d="M'+(eyeRight-28)+' 326 Q'+eyeRight+' 275 '+(eyeRight+28)+' 326" fill="none" stroke="'+eye+'" stroke-width="14" stroke-linecap="round"/>');
 // Alternate eye shapes all live in this ONE SVG; only the shared actor chooses a mood.
 const emotionEyes='<g class="aw-eyes-mood aw-eyes-happy">'+
  '<path d="M329 327 Q357 283 385 327 M415 327 Q443 283 471 327" fill="none" stroke="'+eye+'" stroke-width="14" stroke-linecap="round"/>'+
  '</g><g class="aw-eyes-mood aw-eyes-surprised">'+
  '<ellipse cx="357" cy="319" rx="19" ry="28" fill="none" stroke="'+eye+'" stroke-width="11"/>'+
  '<ellipse cx="443" cy="319" rx="19" ry="28" fill="none" stroke="'+eye+'" stroke-width="11"/>'+
  '</g><g class="aw-eyes-mood aw-eyes-sad">'+
  '<path d="M330 303 Q357 291 383 313 M417 313 Q443 291 470 303" fill="none" stroke="'+eye+'" stroke-width="12" stroke-linecap="round"/>'+
  '<path d="M334 348 Q357 330 380 348 M420 348 Q443 330 466 348" fill="none" stroke="'+eye+'" stroke-width="9" stroke-linecap="round"/>'+
  '</g><g class="aw-eyes-mood aw-eyes-angry">'+
  '<path d="M329 299 L386 321 M414 321 L471 299" fill="none" stroke="'+eye+'" stroke-width="14" stroke-linecap="round"/>'+
  '<path d="M337 342 L379 333 M421 333 L463 342" fill="none" stroke="'+eye+'" stroke-width="10" stroke-linecap="round"/>'+
  '</g><g class="aw-eyes-mood aw-eyes-cat">'+
  '<path d="M328 313 Q358 288 387 312 Q361 339 328 313Z M413 312 Q442 288 472 313 Q439 339 413 312Z" fill="none" stroke="'+eye+'" stroke-width="9" stroke-linejoin="round"/>'+
  '<path d="M357 306v22 M443 306v22" fill="none" stroke="'+eye+'" stroke-width="5" stroke-linecap="round"/>'+
  '</g>';
 const wave='<g transform="rotate(-39 249 463) scale('+R+')"><rect x="196" y="421" width="68" height="132" rx="32" fill="'+w+'" stroke="'+o+'" stroke-width="11"/><rect x="197" y="523" width="67" height="29" rx="13" fill="'+n+'"/><circle cx="230" cy="414" r="32" fill="'+w+'" stroke="'+o+'" stroke-width="10"/></g>';
 const down='<g transform="rotate(27 252 463) scale('+R+')"><rect x="196" y="421" width="68" height="132" rx="32" fill="'+w+'" stroke="'+o+'" stroke-width="11"/><rect x="197" y="523" width="67" height="29" rx="13" fill="'+n+'"/><circle cx="230" cy="551" r="30" fill="'+w+'" stroke="'+o+'" stroke-width="10"/></g>';
 const right='<g transform="rotate(-25 476 475)"><rect x="458" y="438" width="67" height="118" rx="31" fill="'+w+'" stroke="'+o+'" stroke-width="11"/><rect x="459" y="527" width="65" height="28" rx="12" fill="'+n+'"/><circle cx="492" cy="551" r="31" fill="'+w+'" stroke="'+o+'" stroke-width="10"/></g>';
 const tablet=c.tablet==='yes'?'<g transform="translate(484 444) rotate(9) scale('+T+')"><rect x="0" y="0" width="175" height="197" rx="23" fill="'+n+'" stroke="'+o+'" stroke-width="12"/><rect x="13" y="13" width="147" height="168" rx="12" fill="#263953"/><text x="87" y="120" text-anchor="middle" font-size="73" font-weight="900" font-family="sans-serif" fill="'+w+'">W</text><circle cx="169" cy="165" r="31" fill="'+w+'" stroke="'+o+'" stroke-width="10"/></g>':right;
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+(options.portrait?'145 75 510 470':options.stage?'75 25 650 760':'-100 -105 1000 1040')+'" class="bf-svg aw-svg" width="800" height="800" preserveAspectRatio="xMidYMid meet" role="img" aria-label="AI Willy robot mascot"><defs><linearGradient id="williShell" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="'+w+'"/></linearGradient><linearGradient id="williFace" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#24395a"/><stop offset="1" stop-color="'+f+'"/></linearGradient></defs>'
 +'<ellipse cx="392" cy="744" rx="180" ry="17" fill="#294674" opacity=".12"/>'
 +'<g id="legs" transform="translate(0 '+(bodyY-450)+')"><g transform="translate(0 0) scale(1 '+L+')"><path d="M317 615 L305 700 Q304 712 329 717 L361 717 Q385 709 380 693 L384 615Z" fill="url(#williShell)" stroke="'+o+'" stroke-width="11"/><path d="M423 615 L422 701 Q423 717 457 718 L485 718 Q501 709 489 690 L484 615Z" fill="url(#williShell)" stroke="'+o+'" stroke-width="11"/></g><path d="M300 '+(696*L+615*(1-L))+' Q285 '+(719*L+615*(1-L))+' 306 '+(734*L+615*(1-L))+' H374 Q391 '+(724*L+615*(1-L))+' 373 '+(696*L+615*(1-L))+'Z" fill="'+n+'"/><path d="M425 '+(696*L+615*(1-L))+' Q415 '+(722*L+615*(1-L))+' 447 '+(735*L+615*(1-L))+' H509 Q522 '+(713*L+615*(1-L))+' 492 '+(696*L+615*(1-L))+'Z" fill="'+n+'"/></g>'
 +'<g id="body" transform="translate(400 '+bodyY+') scale('+B+') translate(-400 -455)">'+(c.pose==='down'?down:wave)
 +'<rect x="280" y="420" width="240" height="226" rx="95" fill="url(#williShell)" stroke="'+o+'" stroke-width="12"/><path d="M283 589 Q398 637 516 589 L517 625 Q397 687 283 625Z" fill="'+n+'"/><path d="M343 491 L357 551 Q363 565 376 548 L397 513 L422 550 Q439 566 445 548 L461 492" fill="none" stroke="'+o+'" stroke-width="27" stroke-linecap="round" stroke-linejoin="round"/><path d="M343 491 L357 551 Q363 565 376 548 L397 513 L422 550 Q439 566 445 548 L461 492" fill="none" stroke="'+y+'" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>'
 +tablet+'</g>'
 +'<g id="head" transform="translate(400 '+hy+') scale('+H+') translate(-400 -205)"><g class="aw-head-motion">'
 +'<g class="aw-antenna"><rect x="387" y="'+(205-92*A)+'" width="27" height="'+(92*A+30)+'" rx="13" fill="'+n+'" stroke="'+o+'" stroke-width="7"/><circle cx="401" cy="'+(205-92*A)+'" r="27" fill="'+y+'" stroke="#eb9b05" stroke-width="6"/></g>'
 +'<ellipse class="aw-ear-left" cx="237" cy="340" rx="29" ry="54" fill="'+y+'" stroke="'+n+'" stroke-width="15"/><ellipse class="aw-ear-right" cx="562" cy="340" rx="29" ry="54" fill="'+y+'" stroke="'+n+'" stroke-width="15"/>'
 +'<rect x="235" y="205" width="330" height="253" rx="115" fill="url(#williShell)" stroke="'+o+'" stroke-width="12"/>'
 +'<rect x="279" y="254" width="242" height="154" rx="69" fill="url(#williFace)" stroke="'+n+'" stroke-width="9"/>'
 +'<g class="aw-eyes-default">'+eyes+'</g>'+emotionEyes+'<circle cx="315" cy="375" r="7" fill="'+y+'"/><circle cx="484" cy="375" r="7" fill="'+y+'"/>'
 // No idle mouth: the cyan equalizer is the only mouth and appears during speech.
 +'<g class="aw-mouth-wave" stroke="#63d6ff" fill="none" stroke-linecap="round" stroke-width="9"><path class="aw-bar aw-bar-1" d="M366 369v-10"/><path class="aw-bar aw-bar-2" d="M383 377v-24"/><path class="aw-bar aw-bar-3" d="M400 381v-32"/><path class="aw-bar aw-bar-4" d="M417 377v-24"/><path class="aw-bar aw-bar-5" d="M434 369v-10"/></g>'
 +'<path d="M333 234 Q432 203 497 250" fill="none" stroke="#ffffff" stroke-opacity=".46" stroke-width="11" stroke-linecap="round"/>'
 // Magical cat mode: ears, eyes and whiskers only — no smile or idle mouth.
 +'<g class="aw-cat-details" fill="none" stroke="#83e5ff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">'+
 '<path d="M299 229 L326 179 L352 207 M448 207 L474 179 L501 229" />'+
 '<path d="M343 372 L303 359 M343 384 L302 387 M457 372 L497 359 M457 384 L498 387"/>'+
 '<path d="M395 361 L400 366 L405 361" stroke-width="5"/>'+
 '</g>'
 // Electric sparks sit at the antenna tip. Invisible when he is not talking.
 +'<g class="aw-electric" fill="none" stroke="#5fe8ff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">'+
 '<path class="aw-spark aw-spark-1" d="M343 105 L363 86 L357 115 L378 108"/>'+
 '<path class="aw-spark aw-spark-2" d="M446 92 L425 105 L449 113 L434 130"/>'+
 '<path class="aw-spark aw-spark-3" d="M399 58 L386 40 L408 44 L399 20"/>'+
 '</g>'
 +'</g></g></svg>';
}

// Canonical idle/talking head for every Free Talking surface.
// Menus, live conversations and finish screens must import this asset,
// not generate independent head markup or copy its SVG paths.
export const AI_WILLY_HEAD_SVG=createWillySvg({}, {headOnly:true});
