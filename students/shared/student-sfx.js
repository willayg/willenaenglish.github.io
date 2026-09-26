const BASE='/students/shared/assets/audio/sfx/';

const FILES={
  correct:'correct.wav',
  wrong:'wrong.wav',
  complete:'complete.wav',
  star:'star-tick.wav'
};

const DEFAULT_VOLUME={
  correct:.58,
  wrong:.50,
  complete:.62,
  star:.48
};

const cache=new Map();

function getAudio(name){
  const file=FILES[name];
  if(!file)return null;
  if(!cache.has(name)){
    const audio=new Audio(BASE+file);
    audio.preload='auto';
    cache.set(name,audio);
  }
  return cache.get(name);
}

export function playStudentSfx(name,{volume}={}){
  try{
    const base=getAudio(name);
    if(!base)return;
    const audio=base.cloneNode();
    audio.volume=Math.max(0,Math.min(1,Number.isFinite(Number(volume))?Number(volume):(DEFAULT_VOLUME[name]??.55)));
    audio.currentTime=0;
    audio.play().catch(()=>{});
  }catch(_){}
}

export function preloadStudentSfx(){
  Object.keys(FILES).forEach(name=>{try{getAudio(name)?.load?.()}catch(_){}});
}
