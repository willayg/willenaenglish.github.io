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
const polygons=[[[347,189],[344,190],[304,245],[304,268],[333,269],[347,267]],[[430,114],[400,132],[383,145],[378,151],[379,273],[431,272]],[[345,94],[303,95],[303,182],[347,138],[347,96]],[[342,100],[343,135],[309,168],[307,165],[308,101],[310,99]],[[510,73],[473,90],[458,100],[459,273],[510,273],[511,271]],[[24,29],[24,211],[29,231],[41,251],[48,258],[62,268],[73,273],[91,277],[108,277],[119,275],[130,271],[145,262],[148,262],[163,271],[185,277],[203,277],[225,271],[246,257],[261,238],[269,214],[270,30],[213,29],[212,207],[206,216],[198,220],[189,220],[183,217],[179,213],[175,205],[175,30],[118,30],[118,202],[115,212],[109,218],[104,220],[95,220],[90,218],[84,212],[81,206],[81,31],[80,29]],[[36,39],[67,39],[70,41],[71,204],[72,211],[76,219],[85,227],[94,230],[105,230],[118,224],[124,217],[128,206],[128,41],[130,39],[161,39],[165,41],[166,209],[167,213],[174,223],[188,230],[199,230],[210,226],[218,218],[222,209],[223,41],[225,39],[258,39],[260,41],[259,212],[253,231],[244,244],[236,252],[226,259],[212,265],[202,267],[186,267],[170,263],[157,256],[148,248],[145,248],[133,258],[118,265],[108,267],[91,267],[81,265],[67,259],[57,252],[49,244],[38,226],[34,210],[33,57],[34,41]],[[463,25],[463,72],[469,71],[471,69],[506,57],[507,25]],[[466,30],[469,28],[503,29],[504,53],[497,57],[467,66],[465,60]],[[426,24],[383,25],[383,114],[387,113],[426,91]],[[419,28],[422,32],[422,86],[402,99],[389,105],[387,102],[387,30],[389,28]],[[317,17],[307,22],[298,33],[296,39],[296,52],[298,58],[307,69],[314,73],[322,75],[336,73],[343,69],[352,59],[355,49],[355,42],[352,32],[342,21],[333,17]],[[321,20],[330,20],[336,22],[343,27],[347,32],[351,43],[351,49],[345,61],[337,68],[326,71],[318,70],[312,67],[306,62],[300,51],[300,41],[304,31],[311,24]]];
function icon(size){
 const ihdr=[...u32(size),...u32(size),8,3,0,0,0];
 const indexed=[];
 for(let j=0;j<size;j++){
  indexed.push(0);
  const y=(j+.5)*528/size-113;
  const crossings=[];
  for(const points of polygons){
   for(let k=0;k<points.length;k++){
    const [x1,y1]=points[k], [x2,y2]=points[(k+1)%points.length];
    if((y1<=y&&y2>y)||(y2<=y&&y1>y))
     crossings.push(x1+(y-y1)*(x2-x1)/(y2-y1));
   }
  }
  crossings.sort((a,b)=>a-b);
  let at=0;
  for(let i=0;i<size;i++){
   const x=(i+.5)*528/size;
   while(at<crossings.length&&crossings[at]<=x)at++;
   indexed.push(at%2?2:0);
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
 const palette=[41,38,61,41,38,61,255,255,255];
 const png=[137,80,78,71,13,10,26,10,...chunk('IHDR',ihdr),...chunk('PLTE',palette),...chunk('IDAT',def),...chunk('IEND',[])];
 return Uint8Array.from(png);
}
export async function onRequest({request}){
 const name=new URL(request.url).pathname.split('/').pop();
 const n=name==='192.png'?192:name==='512.png'?512:null;
 if(!n)return new Response('Not found',{status:404});
 return new Response(icon(n),{headers:{'content-type':'image/png','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}});
}
