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
function cleanBook(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || raw.book_title || '').trim().replace(/\s+/g, ' ');
  if (!title) return null;
  const sourceType = raw.source_type === 'catalog' && raw.book_id ? 'catalog' : 'manual';
  return {
    book_id: sourceType === 'catalog' ? String(raw.book_id) : null,
    book_title: title,
    source_type: sourceType,
    catalog_series: sourceType === 'catalog' ? (String(raw.series || raw.catalog_series || '').trim() || null) : null,
    catalog_level: sourceType === 'catalog' ? (String(raw.level || raw.catalog_level || '').trim() || null) : null,
    resolved_at: sourceType === 'catalog' ? new Date().toISOString() : null
  };
}
function cleanLevel(raw, hasBooks) {
  if (hasBooks) return null;
  const value = String(raw || '').trim();
  if (!value) return null;
  const allowed = new Set(['S1','S2','1','2','3','4','5','6','7','8','9','10','Mixed']);
  return allowed.has(value) ? value : undefined;
}
async function getClassWithBooks(db, id) {
  const { data: row, error } = await db.from('classes').select('id,name,display_name,status,level,room,capacity,notes,created_at,updated_at').eq('id', id).single();
  if (error) throw error;
  const books = await db.from('class_book_assignments').select('id,class_id,book_id,book_title,source_type,catalog_series,catalog_level,resolved_at,status,created_at').eq('class_id', id).eq('status','active').order('created_at');
  if (books.error) throw books.error;
  return {...row, books:(books.data||[]).slice(0,3)};
}

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

  const params = new URLSearchParams(event.rawQuery || event.queryStringParameters ? new URLSearchParams(event.queryStringParameters || {}).toString() : '');
  const action = event.queryStringParameters?.action || params.get('action') || '';
  if(event.httpMethod==='GET' && action==='search_books'){
    const q=String(event.queryStringParameters?.q||'').trim();
    if(q.length<2)return reply(event,200,{success:true,books:[]});
    const {data,error}=await db.from('content_books').select('id,title,book_number,public_level,internal_level_id,series_id,content_series(name,publisher)').ilike('title',`%${q}%`).eq('status','active').order('title').limit(12);
    if(error)return reply(event,400,{success:false,error:error.message});
    return reply(event,200,{success:true,books:(data||[]).map(b=>({book_id:b.id,title:b.title,series:b.content_series?.name||'',publisher:b.content_series?.publisher||'',level:b.public_level!=null?String(b.public_level):b.internal_level_id!=null?String(b.internal_level_id):''}))});
  }
  if(event.httpMethod==='GET'){
    const {data:classes,error}=await db.from('classes').select('id,name,display_name,status,level,room,capacity,notes,created_at,updated_at').eq('status','active').order('name');
    if(error)return reply(event,400,{success:false,error:error.message});
    const ids=(classes||[]).map(c=>c.id);let assignments=[];
    if(ids.length){const res=await db.from('class_book_assignments').select('id,class_id,book_id,book_title,source_type,catalog_series,catalog_level,resolved_at,status,created_at').in('class_id',ids).eq('status','active').order('created_at');if(res.error)return reply(event,400,{success:false,error:res.error.message});assignments=res.data||[]}
    const byClass=new Map();for(const a of assignments){if(!byClass.has(a.class_id))byClass.set(a.class_id,[]);byClass.get(a.class_id).push(a)}
    return reply(event,200,{success:true,classes:(classes||[]).map(c=>({...c,books:(byClass.get(c.id)||[]).slice(0,3)}))});
  }

  let body;try{body=JSON.parse(event.body||'{}')}catch{return reply(event,400,{success:false,error:'Invalid JSON'})}
  const books=(Array.isArray(body.books)?body.books:[]).map(cleanBook).filter(Boolean).slice(0,3);
  const level=cleanLevel(body.level, books.length>0);
  if(level===undefined)return reply(event,400,{success:false,error:'Invalid level'});

  if(action==='update_class'){
    const classId=String(body.class_id||'').trim();
    if(!classId)return reply(event,400,{success:false,error:'Missing class ID'});
    const existing=await db.from('classes').select('id').eq('id',classId).maybeSingle();
    if(existing.error)return reply(event,400,{success:false,error:existing.error.message});
    if(!existing.data)return reply(event,404,{success:false,error:'Class not found'});
    const oldAssignments=await db.from('class_book_assignments').select('*').eq('class_id',classId).eq('status','active');
    if(oldAssignments.error)return reply(event,400,{success:false,error:oldAssignments.error.message});
    const update=await db.from('classes').update({level,updated_at:new Date().toISOString()}).eq('id',classId);
    if(update.error)return reply(event,400,{success:false,error:update.error.message});
    const archive=await db.from('class_book_assignments').update({status:'archived',finished_at:new Date().toISOString().slice(0,10)}).eq('class_id',classId).eq('status','active');
    if(archive.error)return reply(event,400,{success:false,error:archive.error.message});
    if(books.length){
      const rows=books.map(book=>({class_id:classId,...book,subject:null,started_at:new Date().toISOString().slice(0,10),status:'active',notes:book.source_type==='manual'?'Unresolved manual book; link to curriculum catalog when available.':null}));
      const inserted=await db.from('class_book_assignments').insert(rows);
      if(inserted.error){
        await db.from('classes').update({level:null}).eq('id',classId);
        if((oldAssignments.data||[]).length)await db.from('class_book_assignments').insert((oldAssignments.data||[]).map(a=>({...a,id:undefined,status:'active',finished_at:null})));
        return reply(event,400,{success:false,error:inserted.error.message});
      }
    }
    try{return reply(event,200,{success:true,class:await getClassWithBooks(db,classId)})}catch(e){return reply(event,400,{success:false,error:e.message})}
  }

  const name=String(body.name||'').trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>80)return reply(event,400,{success:false,error:'Class name must be 2–80 characters'});
  const {data:existing,error:existingError}=await db.from('classes').select('id').ilike('name',name).maybeSingle();
  if(existingError)return reply(event,400,{success:false,error:existingError.message});
  if(existing)return reply(event,409,{success:false,error:'Class name already exists'});
  const payload={name,display_name:name,legacy_class_name:name,status:'active',level,room:null,capacity:null,notes:null};
  const {data:created,error}=await db.from('classes').insert(payload).select('*').single();
  if(error)return reply(event,400,{success:false,error:error.message});
  let inserted=[];
  if(books.length){
    const rows=books.map(book=>({class_id:created.id,...book,subject:null,started_at:new Date().toISOString().slice(0,10),status:'active',notes:book.source_type==='manual'?'Unresolved manual book; link to curriculum catalog when available.':null}));
    const result=await db.from('class_book_assignments').insert(rows).select('id,class_id,book_id,book_title,source_type,catalog_series,catalog_level,resolved_at,status,created_at');
    if(result.error){await db.from('classes').delete().eq('id',created.id);return reply(event,400,{success:false,error:result.error.message})}
    inserted=result.data||[];
  }
  return reply(event,201,{success:true,class:{...created,books:inserted}});
};
