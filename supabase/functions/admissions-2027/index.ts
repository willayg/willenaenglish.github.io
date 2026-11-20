// Public forms write through narrowly scoped RPCs; staff RPCs use the caller's JWT and database RLS.
const origins = new Set(['https://willenaenglish.com', 'https://www.willenaenglish.com']);
const publicActions = new Set(['renew', 'invitation', 'apply']);
const staffActions = new Set(['list', 'confirm', 'notified', 'remove']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const base = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;

function respond(data: object, status: number, origin = '') {
  const headers = new Headers({'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Vary':'Origin'});
  if (origins.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(JSON.stringify(data), {status, headers});
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !req.body) return null;
  if (Number(req.headers.get('content-length')) > 8192) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  try {
    const data = JSON.parse(await new Response(new Blob(chunks as BlobPart[])).text());
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch { return null; }
}

function rpc(name: string, body: object, apiKey: string, authorization: string) {
  return fetch(base + '/rest/v1/rpc/' + name, {
    method:'POST', headers:{apikey:apiKey, Authorization:authorization, 'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
}

function field(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const clean = value.normalize('NFC').trim();
  return clean.length <= max && !clean.includes('\u0000') ? clean : null;
}

async function publicAction(action: string, input: Record<string,unknown>, origin: string) {
  const unavailable = () => respond({error:'접수 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'},503,origin);
  if (action === 'renew') {
    const name = field(input.student,50), grade = field(input.birth,50), school = field(input.school,80);
    const note = field(input.note ?? '',400), phone = field(input.phone,22)?.replace(/[\s()-]/g,'');
    if (!name || !grade || !school || !phone || !/^0\d{8,10}$/.test(phone) || note === null || input.consent !== true || input.website)
      return respond({error:'학생 정보, 보호자 연락처와 동의 항목을 확인해 주세요.'},400,origin);
    const result = await rpc('submit_admission_renewal_2027',
      {p_name:name,p_grade:grade,p_phone:phone,p_school:school,p_note:note,p_consent:true},service,'Bearer '+service);
    if (!result.ok) return unavailable();
    const state = await result.json();
    if (state === 'closed') return respond({error:'2027년 대기 연장 신청이 마감되었습니다.'},410,origin);
    if (state === 'rate_limited') return respond({error:'접수가 집중되었습니다. 학원으로 문의해 주세요.'},429,origin);
    return state === 'received' ? respond({success:true},200,origin) : unavailable();
  }
  if (typeof input.key !== 'string' || !uuid.test(input.key)) return respond({error:'학원에서 보내드린 초대 링크를 확인해 주세요.'},400,origin);
  const result = await rpc('respond_admission_briefing_2027',{p_key:input.key,p_apply:action==='apply'},service,'Bearer '+service);
  if (!result.ok) return unavailable();
  const state = await result.json();
  if (state === 'invalid') return respond({error:'사용할 수 없는 초대 링크입니다. 학원으로 문의해 주세요.'},404,origin);
  if (state === 'closed') return respond({error:'설명회 신청이 마감되었습니다.'},410,origin);
  if (state !== 'eligible' && state !== 'booked') return unavailable();
  return respond({success:true,state},200,origin);
}

Deno.serve(async req => {
  const url = new URL(req.url), action = url.searchParams.get('action') || '';
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') {
    if (!origins.has(origin) || !publicActions.has(action)) return respond({error:'허용되지 않은 요청입니다.'},403);
    return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type','Vary':'Origin','Cache-Control':'no-store'}});
  }
  try {
    if (publicActions.has(action)) {
      if (!origins.has(origin)) return respond({error:'홈페이지 신청서를 이용해 주세요.'},403);
      if (req.method !== 'POST') return respond({error:'지원하지 않는 요청입니다.'},405,origin);
      const input = await readBody(req);
      if (!input) return respond({error:'작성 내용을 확인해 주세요.'},400,origin);
      return await publicAction(action,input,origin);
    }
    if (!staffActions.has(action)) return respond({error:'요청을 찾을 수 없습니다.'},404);
    const auth = req.headers.get('authorization') || '';
    if (!/^Bearer [^\s]+$/i.test(auth) || auth === 'Bearer '+service) return respond({error:'관리자 로그인이 필요합니다.'},401);
    // PostgREST verifies the signed access token; the RPC checks the current approved admin profile.
    const access = await rpc('willena_push_is_admin',{},anon,auth);
    if (!access.ok) return respond({error:'관리자 세션을 확인해 주세요.'},access.status===401||access.status===403?401:503);
    if (await access.json() !== true) return respond({error:'관리자 권한이 필요합니다.'},403);
    const year = Number(url.searchParams.get('year'));
    if (!Number.isInteger(year) || year<2027 || year>2100) return respond({error:'입학 희망 연도를 확인해 주세요.'},400);
    if (action === 'list' && req.method === 'GET') {
      const result = await rpc('admin_admission_list',{p_year:year},anon,auth);
      if (!result.ok) return respond({error:'명단을 불러오지 못했습니다.'},503);
      return respond({success:true,records:await result.json()},200);
    }
    if (action === 'list' || req.method !== 'POST') return respond({error:'지원하지 않는 요청입니다.'},405);
    const input = await readBody(req);
    if (!input || typeof input.id!=='string' || !uuid.test(input.id)) return respond({error:'신청 건을 확인해 주세요.'},400);
    const result = await rpc('admin_admission_update',{p_year:year,p_id:input.id,p_action:action},anon,auth);
    if (!result.ok) return respond({error:'변경 사항을 저장하지 못했습니다.'},503);
    return await result.json() === true ? respond({success:true},200) : respond({error:'대상 또는 현재 상태를 다시 확인해 주세요.'},409);
  } catch {
    return respond({error:'서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'},503,origin);
  }
});
