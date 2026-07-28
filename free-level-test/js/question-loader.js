const ASSET_VERSION="20260728-2";
export async function loadQuestionBank(){
  const paths=Array.from({length:10},(_,i)=>`adaptive-level-${String(i+1).padStart(2,"0")}`);
  const groups=await Promise.all(paths.map(async p=>{
    const r=await fetch(`./data/questions/${p}.json?v=${ASSET_VERSION}`,{cache:"no-store"});
    if(!r.ok)throw new Error(`Could not load ${p}`);
    return r.json();
  }));
  return groups.flat();
}
export async function loadJSON(path){
  const separator=path.includes("?")?"&":"?";
  const r=await fetch(`${path}${separator}v=${ASSET_VERSION}`,{cache:"no-store"});
  if(!r.ok)throw new Error(`Could not load ${path}`);
  return r.json();
}