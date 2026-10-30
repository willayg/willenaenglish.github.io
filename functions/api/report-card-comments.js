// Teacher-only Cloudflare Pages endpoint. Supabase RLS is the authority.
const SUPABASE='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
function accessToken(req){
  const match=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)sb_access=([^;]+)/);
  if(!match)return '';
  try{return decodeURIComponent(match[1]);}catch{return '';}
}
async function supabase(path,token,method='GET',payload){
  const response=await fetch(SUPABASE+'/rest/v1/'+path,{
    method,headers:{'apikey':KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json',
      'Prefer':'return=representation'},body:payload?JSON.stringify(payload):undefined
  });
  if(!response.ok)throw Error('Supabase returned HTTP '+response.status);
  return response.json();
}
export async function onRequest({request}){
  if(!['GET','POST'].includes(request.method))return json({success:false,error:'Method not allowed'},405);
  const token=accessToken(request);
  if(!token)return json({success:false,error:'Teacher login required'},401);
  try{
    if(request.method==='GET'){
      const period=new URL(request.url).searchParams.get('period_id')||'';
      if(!/^\d{4}-\d{2}$/.test(period))return json({success:false,error:'Invalid period'},400);
      const p=new URLSearchParams({select:'period_id,sheet_row,test_id,student_id,english_name,class_name,comment_text,revision,status',period_id:'eq.'+period,limit:'500'});
      const comments=await supabase('report_card_student_comments?'+p,token);
      return json({success:true,comments});
    }
    const body=await request.json().catch(()=>({}));
    const {period_id,sheet_row,class_name,english_name,revision,comment_text}=body;
    if(!/^\d{4}-\d{2}$/.test(String(period_id||''))||!Number.isInteger(sheet_row)||sheet_row<1||
       typeof class_name!=='string'||!class_name||typeof english_name!=='string'||!english_name||
       !Number.isInteger(revision)||revision<1||typeof comment_text!=='string'||!comment_text.trim()||
       comment_text.length>10000)return json({success:false,error:'Invalid comment'},400);
    const where=new URLSearchParams({
      period_id:'eq.'+period_id,sheet_row:'eq.'+sheet_row,class_name:'eq.'+class_name,
      english_name:'eq.'+english_name,revision:'eq.'+revision,select:'revision,comment_text'
    });
    const changed=await supabase('report_card_student_comments?'+where,token,'PATCH',{
      comment_text,revision:revision+1,updated_at:new Date().toISOString()
    });
    if(changed.length!==1)return json({success:false,error:'Comment changed or student mismatch. Reload before editing.'},409);
    return json({success:true,comment:changed[0]});
  }catch(error){return json({success:false,error:'Comment access failed: '+String(error.message||error)},502);}
}
