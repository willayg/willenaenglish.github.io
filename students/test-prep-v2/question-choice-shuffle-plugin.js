// Renderer plugin: randomize multiple-choice positions without modifying the renderer itself.
// Mutates the question object passed to Renderer.render() so grading and tracking use
// the same displayed answer positions that the student sees.

const installed=new WeakMap();
const lastCorrectPosition=new Map();

function randomInt(max){
  if(max<=1)return 0;
  try{
    if(globalThis.crypto?.getRandomValues){
      const a=new Uint32Array(1);
      const limit=Math.floor(0x100000000/max)*max;
      let x;
      do{globalThis.crypto.getRandomValues(a);x=a[0]}while(x>=limit);
      return x%max;
    }
  }catch(_){ }
  return Math.floor(Math.random()*max);
}

function shuffledOrder(n){
  const order=Array.from({length:n},(_,i)=>i);
  for(let i=n-1;i>0;i--){
    const j=randomInt(i+1);
    [order[i],order[j]]=[order[j],order[i]];
  }
  return order;
}

function positionMap(order){
  const oldToNew=new Map();
  order.forEach((oldIndex,newIndex)=>oldToNew.set(oldIndex+1,newIndex+1));
  return oldToNew;
}

function numericAnswerPositions(answer,n){
  const values=Array.isArray(answer)?answer:[answer];
  return values.map(v=>String(v??'').trim()).filter(v=>/^\d+$/.test(v)).map(Number).filter(v=>v>=1&&v<=n);
}

function remapAnswers(answer,map,n){
  const values=Array.isArray(answer)?answer:[answer];
  return values.map(v=>{
    const s=String(v??'').trim();
    if(!/^\d+$/.test(s))return v;
    const oldPos=Number(s);
    if(oldPos<1||oldPos>n)return v;
    return String(map.get(oldPos)||oldPos);
  });
}

function sameOrder(order){return order.every((oldIndex,newIndex)=>oldIndex===newIndex)}

export function shuffleChoiceQuestion(question){
  if(!question||!['choice','multi'].includes(String(question.form||'')))return question;
  const choices=Array.isArray(question.choices)?question.choices:[];
  const n=choices.length;
  if(n<2)return question;

  const oldAnswers=numericAnswerPositions(question.answer,n);
  const key=String(question.tracking?.questionId||question.id||question.masteryKey||'');
  const previousCorrect=key&&oldAnswers.length===1?lastCorrectPosition.get(key):null;

  let order,map,newAnswers;
  for(let attempt=0;attempt<10;attempt++){
    order=shuffledOrder(n);
    map=positionMap(order);
    newAnswers=remapAnswers(question.answer,map,n);
    const nextCorrect=oldAnswers.length===1?Number(newAnswers[0]):null;
    const useful=!sameOrder(order)&&(!previousCorrect||!nextCorrect||nextCorrect!==previousCorrect);
    if(useful)break;
  }

  if(!order||!map)return question;
  question.choices=order.map(oldIndex=>choices[oldIndex]);
  question.answer=newAnswers||remapAnswers(question.answer,map,n);

  if(key&&oldAnswers.length===1){
    const pos=Number(question.answer?.[0]);
    if(Number.isFinite(pos))lastCorrectPosition.set(key,pos);
  }
  return question;
}

export function installChoiceShufflePlugin({Renderer}={}){
  if(!Renderer?.prototype||installed.has(Renderer))return installed.get(Renderer)||null;
  const originalRender=Renderer.prototype.render;
  if(typeof originalRender!=='function')return null;

  function renderWithChoiceShuffle(question,...rest){
    shuffleChoiceQuestion(question);
    return originalRender.call(this,question,...rest);
  }

  Renderer.prototype.render=renderWithChoiceShuffle;
  const handle={
    uninstall(){
      if(Renderer.prototype.render===renderWithChoiceShuffle)Renderer.prototype.render=originalRender;
      installed.delete(Renderer);
    }
  };
  installed.set(Renderer,handle);
  return handle;
}
