// Public icon PNG generated from the original traced Willena wordmark.
// Indexed PNG: transparent background, black outlines, yellow W, green and pink accents.
const SHAPES=["M347,189 L344,190 L342,194 L329,210 L327,214 L318,225 L307,242 L304,245 L303,247 L303,267 L304,268 L312,268 L313,269 L333,269 L334,268 L346,268 L347,267 L347,253 L348,252 L348,204 L347,203 Z","M430,114 L420,119 L400,132 L383,145 L378,151 L378,270 L379,273 L430,273 L431,272 L431,115 Z","M345,94 L304,94 L303,95 L303,182 L304,182 L317,168 L317,167 L336,149 L337,149 L347,138 L347,96 Z","M342,100 L343,101 L343,135 L309,168 L307,165 L308,101 L310,99 L337,99 L338,100 Z","M510,73 L506,74 L497,79 L495,79 L493,81 L491,81 L489,83 L487,83 L473,90 L468,94 L466,94 L464,96 L461,97 L458,100 L458,271 L459,273 L510,273 L511,271 L511,92 L510,91 Z","M24,29 L23,31 L23,79 L24,80 L24,211 L25,212 L25,219 L29,231 L34,241 L41,251 L42,251 L48,258 L62,268 L66,269 L73,273 L76,273 L80,275 L90,276 L91,277 L108,277 L114,275 L119,275 L128,271 L130,271 L140,266 L145,262 L148,262 L163,271 L175,275 L179,275 L185,277 L203,277 L204,276 L214,275 L217,273 L220,273 L223,271 L225,271 L227,269 L229,269 L231,267 L234,266 L246,257 L255,247 L261,238 L262,234 L265,229 L266,223 L268,220 L268,215 L269,214 L269,201 L270,200 L270,30 L269,29 L213,29 L213,160 L212,161 L212,207 L211,210 L206,216 L198,220 L189,220 L183,217 L179,213 L175,205 L175,30 L174,29 L119,29 L118,30 L118,202 L117,203 L117,208 L115,212 L109,218 L104,220 L95,220 L90,218 L84,212 L81,206 L81,31 L80,29 Z","M36,39 L67,39 L70,41 L70,66 L71,67 L71,204 L72,205 L72,211 L76,219 L85,227 L94,230 L105,230 L106,229 L109,229 L118,224 L124,217 L127,211 L127,207 L128,206 L128,41 L130,39 L161,39 L165,41 L165,198 L166,199 L166,209 L167,210 L167,213 L174,223 L178,226 L188,230 L199,230 L210,226 L218,218 L222,209 L222,180 L223,179 L223,41 L225,39 L258,39 L260,41 L260,194 L259,195 L259,212 L258,213 L258,218 L256,221 L256,224 L254,227 L253,231 L244,244 L236,252 L226,259 L218,263 L215,263 L212,265 L208,265 L202,267 L186,267 L185,266 L181,266 L180,265 L176,265 L170,263 L157,256 L148,248 L145,248 L139,254 L133,258 L118,265 L114,265 L108,267 L91,267 L90,266 L81,265 L78,263 L75,263 L73,261 L67,259 L57,252 L49,244 L42,234 L38,226 L37,220 L35,217 L35,211 L34,210 L34,184 L33,183 L33,57 L34,56 L34,41 Z","M463,25 L463,30 L462,31 L462,67 L463,68 L463,72 L469,71 L471,69 L474,69 L482,65 L488,64 L491,62 L494,62 L497,60 L500,60 L506,57 L507,54 L507,25 L499,25 L498,24 L464,24 Z","M466,30 L469,28 L501,28 L504,30 L504,53 L502,55 L500,55 L497,57 L494,57 L491,59 L488,59 L485,61 L470,66 L467,66 L465,60 Z","M426,24 L388,24 L387,25 L383,25 L383,42 L382,43 L383,114 L387,113 L396,107 L407,102 L409,100 L420,95 L426,91 L426,85 L427,84 L427,30 L426,29 Z","M419,28 L422,32 L422,86 L419,89 L409,94 L402,99 L400,99 L391,105 L389,105 L387,102 L387,30 L389,28 Z","M317,17 L307,22 L302,27 L298,33 L298,36 L296,39 L296,52 L300,62 L307,69 L314,73 L321,74 L322,75 L327,75 L328,74 L336,73 L343,69 L352,59 L354,53 L354,50 L355,49 L355,42 L354,41 L354,38 L352,32 L342,21 L338,19 L336,19 L333,17 Z","M321,20 L330,20 L336,22 L343,27 L347,32 L351,43 L351,49 L349,55 L345,61 L337,68 L335,68 L332,70 L327,70 L326,71 L318,70 L312,67 L306,62 L303,58 L300,51 L300,41 L304,31 L311,24 Z"];
const GROUPS=[[0,1],[1,1],[4,1],[5,1],[6,2],[11,1],[12,2],[2,1],[3,2],[9,1],[10,3],[7,1],[8,4]];
const POLYS=SHAPES.map(p=>[...p.matchAll(/(\d+),(\d+)/g)].map(m=>[Number(m[1]),Number(m[2])]));
const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0};
const u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
function chunk(name,body){const type=[...name].map(c=>c.charCodeAt(0));return [...u32(body.length),...type,...body,...u32(crc([...type,...body]))]}
function makeIcon(size){
 const pixels=new Uint8Array(size*size);
 const scale=0.916666667,dx=14,dy=117;
 // Fill each original vector contour in draw order. Transparent everywhere else.
 for(const [shape,color] of GROUPS){
  const points=POLYS[shape];if(points.length<3)continue;
  const ys=points.map(p=>p[1]);
  const yFirst=Math.max(0,Math.floor((Math.min(...ys)*scale+dy)*size/512)-1);
  const yLast=Math.min(size-1,Math.ceil((Math.max(...ys)*scale+dy)*size/512)+1);
  for(let j=yFirst;j<=yLast;j++){
   const y=((j+.5)*512/size-dy)/scale;const xs=[];
   for(let k=0;k<points.length;k++){
    const a=points[k],b=points[(k+1)%points.length];
    if((a[1]<=y&&y<b[1])||(b[1]<=y&&y<a[1]))
      xs.push((a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))*scale+dx);
   }
   xs.sort((a,b)=>a-b);
   for(let k=0;k+1<xs.length;k+=2){
    const first=Math.max(0,Math.ceil(xs[k]*size/512-.5));
    const end=Math.min(size,Math.ceil(xs[k+1]*size/512-.5));
    for(let i=first;i<end;i++)pixels[j*size+i]=color;
   }
  }
 }
 const rows=[];for(let j=0;j<size;j++){rows.push(0);for(let i=0;i<size;i++)rows.push(pixels[j*size+i])}
 let a=1,b=0;for(const x of rows){a=(a+x)%65521;b=(b+a)%65521}
 const zipped=[0x78,0x01];
 for(let i=0;i<rows.length;){const n=Math.min(65535,rows.length-i),last=i+n===rows.length;zipped.push(last?1:0,n&255,n>>>8,(~n)&255,((~n)>>>8)&255,...rows.slice(i,i+n));i+=n}
 zipped.push(...u32(((b<<16)|a)>>>0));
 const palette=[0,0,0,8,8,8,255,255,0,57,237,0,251,0,155];
 const alpha=[0,255,255,255,255];
 return Uint8Array.from([137,80,78,71,13,10,26,10,...chunk('IHDR',[...u32(size),...u32(size),8,3,0,0,0]),...chunk('PLTE',palette),...chunk('tRNS',alpha),...chunk('IDAT',zipped),...chunk('IEND',[])]);
}
export async function onRequest({request}){
 const name=new URL(request.url).pathname.split('/').pop();
 const size=name==='192.png'?192:name==='512.png'?512:null;
 if(!size)return new Response('Not found',{status:404});
 return new Response(makeIcon(size),{headers:{'content-type':'image/png','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}});
}