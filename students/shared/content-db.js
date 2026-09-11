const CONTENT_DB_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_DB_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const BASE_HEADERS={apikey:CONTENT_DB_KEY,Authorization:`Bearer ${CONTENT_DB_KEY}`};

export async function contentDbGet(path,{range=null}={}){
  const headers={...BASE_HEADERS};
  if(range)headers.Range=range;
  const response=await fetch(`${CONTENT_DB_URL}${path}`,{headers,cache:'no-store'});
  if(!response.ok)throw new Error(await response.text());
  return response.json();
}

export async function contentDbRpc(name,body={}){
  if(!name)throw new Error('CONTENT_DB_RPC_NAME_REQUIRED');
  const response=await fetch(`${CONTENT_DB_URL}/rest/v1/rpc/${encodeURIComponent(name)}`,{
    method:'POST',
    headers:{...BASE_HEADERS,'Content-Type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store'
  });
  if(!response.ok)throw new Error(await response.text());
  return response.json();
}
