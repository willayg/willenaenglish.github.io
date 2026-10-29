// October 2026 report-card import proof of concept.
// Private Google Sheets credentials stay in report-cards-api. Never send secrets to browsers.
// NOTE: This route is intentionally fail-closed if teacher authentication or API configuration is missing.
const reply = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/report-card-sheet') return reply(404, {error:'Not found'});
  const incomingOrigin = request.headers.get('Origin');
  if (incomingOrigin && incomingOrigin !== url.origin) return reply(403, {error:'Origin not allowed'});
  // Existing teacher_admin authenticates sb_access cookies and checks teacher/admin role.
  // Forward only that session cookie; never pass client-supplied Authorization or custom tokens.
  const cookies = request.headers.get('Cookie') || '';
  const match = /(?:^|;\\s*)sb_access=([^;]+)/.exec(cookies);
  if (!match) return reply(401, {error:'Teacher login required'});
  const headers = new Headers({Cookie:'sb_access=' + match[1]});
  // Validate using the same teacher API already used by Test Input. Never trust an Origin header as authentication.
  let auth;
  try {
    auth = await fetch('https://teachers.willenaenglish.com/.netlify/functions/teacher_admin?action=list_students&limit=1', {
      headers, redirect:'manual', cache:'no-store'
    });
    if (!auth.ok) return reply(401, {error:'Teacher session not verified'});
    const checked = await auth.json();
    if (checked?.success !== true || !Array.isArray(checked.students)) return reply(401, {error:'Teacher session not verified'});
  } catch {
    return reply(503, {error:'Teacher authentication unavailable'});
  }
  if (!env.REPORT_CARDS || !env.REPORT_CARDS_API_TOKEN)
    return reply(503, {error:'Report-card binding or server secret is not configured'});
  try {
    const response = await env.REPORT_CARDS.fetch('https://report-cards-api.willena.workers.dev/v1/report-cards/october-2026', {
      headers: { Authorization: 'Bearer ' + env.REPORT_CARDS_API_TOKEN }, redirect:'manual'
    });
    if (!response.ok) return reply(502, {error:'Google Sheets reader unavailable',upstreamStatus:response.status});
    const data = await response.json();
    if (!Array.isArray(data.students)) return reply(502, {error:'Unexpected sheet response'});
    return reply(200, {source:'Report Card October 2026', readOnly:true, students:data.students});
  } catch {
    return reply(502, {error:'Could not contact report-card reader'});
  }
}
