const endpoint = 'https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/admissions-2027';
export async function send(action, payload) {
  const response = await fetch(endpoint + '?action=' + encodeURIComponent(action), {
    method:'POST', credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    throw new Error(result.error || '전송 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  }
  return result;
}
