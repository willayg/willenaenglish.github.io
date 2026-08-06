const { createClient } = require('@supabase/supabase-js');

function headers(event) {
  const origin = String(event.headers?.origin || event.headers?.Origin || '').trim();
  const allowed = new Set([
    'https://teachers.willenaenglish.com','https://students.willenaenglish.com','https://staging.willenaenglish.com',
    'https://www.willenaenglish.com','https://willenaenglish.com','https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app','http://localhost:8888','http://localhost:9000'
  ]);
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://teachers.willenaenglish.com',
    'Access-Control-Allow-Credentials': 'true','Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization','Content-Type': 'application/json','Cache-Control': 'no-store'
  };
}
const reply=(event,statusCode,body)=>({statusCode,headers:headers(event),body:JSON.stringify(body)});
function accessToken(event){const c=event.headers?.cookie||event.headers?.Cookie||'';const m=/(?:^|;\s*)sb_access=([^;]+)/.exec(c);return m?decodeURIComponent(m[1]):null}

exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:200,headers:headers(event),body:''};
  if(!['GET','POST'].includes(event.httpMethod))return reply(event,405,{success:false,error:'Method not allowed'});
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return reply(event,500,{success:false,error:'Missing server configuration'});
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=accessToken(event);if(!token)return reply(event,401,{success:false,error:'Not signed in'});
  const {data:authData,error:authError}=await db.auth.getUser(token);
  if(authError||!authData?.user)return reply(event,401,{success:false,error:'Not signed in'});
  const {data:actor,error:actorError}=await db.from('profiles').select('role,approved').eq('id',authData.user.id).single();
  if(actorError||!actor||String(actor.role).toLowerCase()!=='admin'||actor.approved===false)return reply(event,403,{success:false,error:'Admins only'});

  if(event.httpMethod==='GET'){
    const {data:classes,error}=await db.from('classes').select('id,name,display_name,status,level,room,capacity,notes,created_at,updated_at').eq('status','active').order('name');
    if(error)return reply(event,400,{success:false,error:error.message});
    const ids=(classes||[]).map(c=>c.id);
    let assignments=[];
    if(ids.length){
      const res=await db.from('class_book_assignments').select('id,class_id,book_id,book_title,status,created_at').in('class_id',ids).eq('status','active').order('created_at');
      if(res.error)return reply(event,400,{success:false,error:res.error.message});
      assignments=res.data||[];
    }
    const byClass=new Map();for(const a of assignments){if(!byClass.has(a.class_id))byClass.set(a.class_id,[]);byClass.get(a.class_id).push(a)}
    const rows=(classes||[]).map(c=>({...c,books:(byClass.get(c.id)||[]).slice(0,3)}));
    const bookTitles=[...new Set(assignments.map(a=>a.book_title).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    return reply(event,200,{success:true,classes:rows,book_titles:bookTitles});
  }

  let body;try{body=JSON.parse(event.body||'{}')}catch{return reply(event,400,{success:false,error:'Invalid JSON'})}
  const name=String(body.name||'').trim().replace(/\s+/g,' ');
  const books=(Array.isArray(body.books)?body.books:[]).map(v=>String(v||'').trim()).filter(Boolean).slice(0,3);
  const allowedLevels=new Set(['S1','S2','1','2','3','4','5','6','7','8','9','10','Mixed']);
  let level=String(body.level||'').trim();
  if(books.length)level=null;else if(!level)level=null;else if(!allowedLevels.has(level))return reply(event,400,{success:false,error:'Invalid level'});
  if(name.length<2||name.length>80)return reply(event,400,{success:false,error:'Class name must be 2–80 characters'});
  const {data:existing,error:existingError}=await db.from('classes').select('id').ilike('name',name).maybeSingle();
  if(existingError)return reply(event,400,{success:false,error:existingError.message});
  if(existing)return reply(event,409,{success:false,error:'Class name already exists'});
  const payload={name,display_name:name,legacy_class_name:name,status:'active',level,room:null,capacity:null,notes:null};
  const {data:created,error}=await db.from('classes').insert(payload).select('*').single();
  if(error)return reply(event,400,{success:false,error:error.message});
  let inserted=[];
  if(books.length){
    const rows=books.map(title=>({class_id:created.id,book_title:title,started_at:new Date().toISOString().slice(0,10),status:'active'}));
    const result=await db.from('class_book_assignments').insert(rows).select('id,class_id,book_id,book_title,status,created_at');
    if(result.error){await db.from('classes').delete().eq('id',created.id);return reply(event,400,{success:false,error:result.error.message})}
    inserted=result.data||[];
  }
  return reply(event,201,{success:true,class:{...created,books:inserted}});
};
