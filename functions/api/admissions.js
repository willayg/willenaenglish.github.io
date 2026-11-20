// Admin-only same-origin bridge for the existing HttpOnly teacher session.
const edge = 'https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/admissions-2027';
const actions = new Set(['list','confirm','notified','remove']);
const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const error = (message,status) => new Response(JSON.stringify({error:message}),{status,headers});

export async function onRequest({request}) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  if (!actions.has(action)) return error('요청을 찾을 수 없습니다.',404);
  if (request.method !== (action==='list' ? 'GET' : 'POST')) return error('지원하지 않는 요청입니다.',405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return error('관리자 화면을 이용해 주세요.',403);
  if (request.method === 'POST' && !request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return error('JSON 요청이 필요합니다.',415);
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)sb_access=([^;]+)/);
  if (!match) return error('관리자 로그인이 필요합니다.',401);
  let token;
  try { token=decodeURIComponent(match[1]); } catch { return error('로그인을 다시 해 주세요.',401); }
  const upstream = new URL(edge);
  upstream.searchParams.set('action', action);
  upstream.searchParams.set('year',url.searchParams.get('year')||'');
  try {
    const response = await fetch(upstream,{
      method:request.method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:request.method==='POST' ? request.body : undefined
    });
    return new Response(response.body,{status:response.status,headers});
  } catch { return error('명단에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',503); }
}
