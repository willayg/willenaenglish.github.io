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
function outline(){
 const points=[[88,100],[157,100],[157,323]];
 function cubic(cx1,cy1,cx2,cy2,x2,y2){
  const [x0,y0]=points[points.length-1];
  for(let i=1;i<=14;i++){const t=i/14,v=1-t;
   points.push([v*v*v*x0+3*v*v*t*cx1+3*v*t*t*cx2+t*t*t*x2,v*v*v*y0+3*v*v*t*cy1+3*v*t*t*cy2+t*t*t*y2])}
 }
 cubic(157,354,176,368,198,368);
 cubic(220,368,239,354,239,323);
 points.push([239,100],[304,100],[304,323]);
 cubic(304,354,323,368,345,368);
 cubic(367,368,386,354,386,323);
 points.push([386,100],[454,100],[454,335]);
 cubic(454,415,401,451,345,451);
 cubic(302,451,276,437,271,425);
 cubic(258,441,234,451,197,451);
 cubic(133,451,88,411,88,335);
 points.push([88,100]);
 return points.slice(1).map((b,i)=>[...points[i],...b]);
}
const outlineSegments=outline();
function icon(size){
 const ihdr=[...u32(size),...u32(size),8,3,0,0,0];
 const lines=outlineSegments;
 // Use one palette byte per pixel (index 0-3) to keep encoding predictable.
 const indexed=[];
 for(let j=0;j<size;j++){
  indexed.push(0);
  for(let i=0;i<size;i++){
   const x=(i+.5)*512/size,y=(j+.5)*512/size;
   let index=0;
   if(lines.some(([a,b,c,d])=>d2(x,y,a,b,c,d)<(9*9)))index=2;
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
 const palette=[8,8,8,8,8,8,255,255,255];
 const png=[137,80,78,71,13,10,26,10,...chunk('IHDR',ihdr),...chunk('PLTE',palette),...chunk('IDAT',def),...chunk('IEND',[])];
 return Uint8Array.from(png);
}
export async function onRequest({request}){
 const name=new URL(request.url).pathname.split('/').pop();
 const n=name==='192.png'?192:name==='512.png'?512:null;
 if(!n)return new Response('Not found',{status:404});
 return new Response(icon(n),{headers:{'content-type':'image/png','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}});
}
