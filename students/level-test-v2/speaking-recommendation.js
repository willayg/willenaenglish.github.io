const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function recommendSpeaking(evidence=[]){
  const clean=(Array.isArray(evidence)?evidence:[])
    .map(x=>({level:Number(x?.level),score:Number(x?.score)}))
    .filter(x=>Number.isInteger(x.level)&&x.level>=1&&x.level<=12&&x.score>=1&&x.score<=5);

  if(!clean.length){
    return {recommended_level:null,confidence:'none',evidence_count:0,levels_tested:[],summary:'No scored speaking evidence yet.'};
  }

  const byLevel=new Map();
  for(const item of clean){
    if(!byLevel.has(item.level))byLevel.set(item.level,[]);
    byLevel.get(item.level).push(item.score);
  }

  const levels=[...byLevel.keys()].sort((a,b)=>a-b);
  const stats=levels.map(level=>{
    const scores=byLevel.get(level);
    const avg=scores.reduce((a,b)=>a+b,0)/scores.length;
    return {level,count:scores.length,average:avg,min:Math.min(...scores),max:Math.max(...scores)};
  });

  let weightedSum=0;
  let totalWeight=0;
  for(const item of clean){
    const offset=({1:-1.35,2:-0.65,3:0,4:0.45,5:0.8})[item.score]??0;
    const weight=1+(item.level-1)*0.035;
    weightedSum+=(item.level+offset)*weight;
    totalWeight+=weight;
  }
  let estimate=weightedSum/totalWeight;

  const highest=stats[stats.length-1];
  if(highest&&highest.count>=2&&highest.average<2.5){
    estimate=Math.min(estimate,highest.level-0.5);
  }
  if(highest&&highest.count>=2&&highest.average>=4.25){
    estimate=Math.max(estimate,highest.level+0.35);
  }

  const recommended=clamp(Math.round(estimate),1,12);
  const count=clean.length;
  const spread=levels.length;
  const confidence=count>=6&&spread>=2?'high':count>=3?'medium':'low';
  const summary=`${count} scored response${count===1?'':'s'} across ${spread} level${spread===1?'':'s'}; estimated speaking level ${estimate.toFixed(1)}.`;

  return {
    recommended_level:recommended,
    confidence,
    evidence_count:count,
    levels_tested:levels,
    estimate:Number(estimate.toFixed(2)),
    level_stats:stats,
    summary
  };
}
