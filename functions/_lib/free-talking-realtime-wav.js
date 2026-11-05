// Server-only Realtime text-to-audio generator for Free Talking Genius.
// OpenAI Realtime emits PCM16 mono at 24 kHz. Wrap it in a WAV container for
// browser playback and opt-in R2 WAV caching; no student audio is sent.
export async function generateQuestionWav({apiKey,text,model='gpt-realtime-2.1-mini',voice='marin'}){
 if(!apiKey)throw new Error('Realtime API key missing');
 const url='https://api.openai.com/v1/realtime?model='+encodeURIComponent(model);
 const handshake=await fetch(url,{headers:{Upgrade:'websocket',Authorization:'Bearer '+apiKey,'OpenAI-Beta':'realtime=v1'},signal:AbortSignal.timeout(10000)});
 if(!handshake.webSocket)throw new Error('Realtime WebSocket rejected (HTTP '+handshake.status+')');
 const socket=handshake.webSocket;
 socket.accept();
 const instructions=[
  'You are AI Willi, a friendly conversational English partner.',
  'Speak in natural American English with relaxed, genuinely curious intonation, natural stress and connected speech.',
  'Use a comfortable unhurried pace, but never exaggerate individual syllables.',
  'Sound like a friendly person asking a question, not a teacher reading a language test.',
  'Output ONLY the exact supplied question, without greetings, commentary, introductions or paraphrasing.'
 ].join(' ');
 const chunks=[];
 let bytes=0,settled=false;
 const result=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>finish(new Error('Realtime audio timed out')),11000);
  const finish=(error,value)=>{
   if(settled)return;settled=true;clearTimeout(timeout);
   try{socket.close(1000,'done')}catch{}
   if(error)reject(error);else resolve(value);
  };
  socket.addEventListener('error',()=>finish(new Error('Realtime connection error')));
  socket.addEventListener('close',()=>{if(!settled)finish(new Error('Realtime connection closed before audio completed'))});
  socket.addEventListener('message',event=>{
   try{
    const data=JSON.parse(String(event.data));
    if(data.type==='error')return finish(new Error('Realtime error: '+String(data.error?.message||data.error?.code||'unknown').slice(0,220)));
    if(data.type==='session.created'){
     socket.send(JSON.stringify({type:'session.update',session:{
      type:'realtime',output_modalities:['audio'],instructions,
      audio:{output:{format:{type:'audio/pcm',rate:24000},voice}}
     }}));
    }else if(data.type==='session.updated'){
     socket.send(JSON.stringify({type:'response.create',response:{
      conversation:'none',output_modalities:['audio'],instructions,
      audio:{output:{format:{type:'audio/pcm'},voice}},
      input:[{type:'message',role:'user',content:[{type:'input_text',text:'Read this exact question aloud, without any other words: '+JSON.stringify(text)}]}]
     }}));
    }else if(data.type==='response.output_audio.delta'){
     const encoded=String(data.delta||'');
     if(!encoded)return;
     const binary=atob(encoded),part=new Uint8Array(binary.length);
     for(let i=0;i<binary.length;i++)part[i]=binary.charCodeAt(i);
     bytes+=part.byteLength;
     if(bytes>1200000)return finish(new Error('Realtime audio too long'));
     chunks.push(part);
    }else if(data.type==='response.done'){
     if(data.response?.status!=='completed')return finish(new Error('Realtime response '+String(data.response?.status||'incomplete')));
     if(bytes<4800)return finish(new Error('Realtime returned no playable audio'));
     finish(null,wrapWav(chunks,bytes));
    }
   }catch(e){finish(e)}
  });
 });
 return result;
}
function wrapWav(chunks,size){
 const buffer=new ArrayBuffer(44+size),view=new DataView(buffer),out=new Uint8Array(buffer);
 const ascii=(offset,text)=>{for(let i=0;i<text.length;i++)out[offset+i]=text.charCodeAt(i)};
 ascii(0,'RIFF');view.setUint32(4,36+size,true);ascii(8,'WAVE');ascii(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
 view.setUint32(24,24000,true);view.setUint32(28,48000,true);
 view.setUint16(32,2,true);view.setUint16(34,16,true);
 ascii(36,'data');view.setUint32(40,size,true);
 let offset=44;for(const part of chunks){out.set(part,offset);offset+=part.length}
 return buffer;
}
