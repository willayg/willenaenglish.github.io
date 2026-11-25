// Shared only inside Word Genius speaking; silent, bounded lookahead.
// Returned MP3s may be browser blobs or short-lived signed R2 links.
export function createSpeakingAudioCache(load){
  const ready=new Map();
  const pending=new Map();
  const keyOf=text=>String(text||'').trim().toLowerCase();
  async function get(text){
    const key=keyOf(text);
    if(!key)throw new Error('Missing listening text');
    let saved=ready.get(key);
    if(saved?.expiresAt&&saved.expiresAt<=Date.now()){
      ready.delete(key);saved=null;
    }
    if(saved)return saved;
    if(pending.has(key))return pending.get(key);
    const promise=(async()=>{
      const reply=await load(String(text).trim());
      let url='',expiresAt=null;
      if(reply?.audio_url){
        url=String(reply.audio_url);
        if(!url.startsWith('https://'))throw new Error('Invalid stored audio URL');
        // Study V2 presigned R2 links last eight hours.
        expiresAt=Date.now()+6*60*60*1000;
      }else if(reply?.audio){
        const bytes=Uint8Array.from(atob(reply.audio),ch=>ch.charCodeAt(0));
        url=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));
      }else throw new Error('No listening audio received');
      const entry={url,expiresAt};
      ready.set(key,entry);
      return entry;
    })().finally(()=>pending.delete(key));
    pending.set(key,promise);
    return promise;
  }
  // Prefetch no more than the current and next two words. No audio plays.
  // Two concurrent requests start immediately; the third follows the first
  // two, to avoid launching a large unit's worth of generation requests.
  function prefetch(words){
    const unique=new Map();
    for(const word of words||[]){
      const key=keyOf(word);
      if(key&&!unique.has(key))unique.set(key,String(word).trim());
    }
    const text=[...unique.values()].slice(0,3);
    const first=text.slice(0,2).map(value=>get(value).catch(()=>null));
    if(text.length>2){
      void Promise.allSettled(first).then(()=>get(text[2]).catch(()=>null));
    }
  }
  return {get,prefetch};
}
