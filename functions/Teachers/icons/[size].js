// Small public PWA icon endpoint. Generated on demand; no auth or student data.
function crc(bytes){
 let c=0xffffffff;
 for(const x of bytes){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}
 return (c^0xffffffff)>>>0;
}
function u32(n){return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]}
function chunk(name,data){
 const type=Array.from(name,ch=>ch.charCodeAt(0));
 return [...u32(data.length),...type,...data,...u32(crc([...type,...data]))]
}
function d2(x,y,x1,y1,x2,y2){
 const dx=x2-x1,dy=y2-y1,t=Math.min(1,Math.max(0,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)));
 const ex=x-(x1+t*dx),ey=y-(y1+t*dy);return ex*ex+ey*ey
}
function icon(size){
 const lines=[[126,174,185,346],[185,346,222,346],[222,346,256,251],[256,251,290,346],[290,346,326,346],[326,346,384,174]];
 // Use one palette byte per pixel (index 0-3) to keep encoding predictable.
 const indexed=[];
 for(let j=0;j<size;j++){
  indexed.push(0);
  for(let i=0;i<size;i++){
   const x=(i+.5)*512/size,y=(j+.5)*512/size;
   let index=Math.abs(Math.hypot(x-256,y-256)-222)<7?1:0;
   if(lines.some(([a,b,c,d])=>d2(x,y,a,b,c,d)<(24*24)))index=2;
   if(Math.hypot(x-406,y-115)<27)index=3;
   indexed.push(index)
  }
 }
 // Rebuild stored zlib for indexed scanlines matching IHDR bit depth 8.
 const def=[0x78,0x01];let ad=1,bd=0;
 for(const x of indexed){ad=(ad+x)%65521;bd=(bd+ad)%65521}
 for(let k=0;k<indexed.length;){
  const n=Math.min(65535,indexed.length-k),last=k+n===indexed.length;
  def.push(last?1:0,n&255,n>>>8,(~n)&255,((~n)>>>8)&255,...indexed.slice(k,k+n));
  k+=n;
 }
 def.push(...u32(((bd<<16)|ad)>>>0));
 const palette=[24,62,74,104,202,213,255,255,255,237,117,169];
 const png=[137,80,78,71,13,10,26,10,...chunk('IHDR',ihdr),...chunk('PLTE',palette),...chunk('IDAT',def),...chunk('IEND',[])];
 return Uint8Array.from(png);
}
export async function onRequest({request}){
 const name=new URL(request.url).pathname.split('/').pop();
 const n=name==='192.png'?192:name==='512.png'?512:null;
 if(!n)return new Response('Not found',{status:404});
 return new Response(icon(n),{headers:{'content-type':'image/png','cache-control':'public, max-age=604800','x-content-type-options':'nosniff'}});
}
