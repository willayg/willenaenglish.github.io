const AWARDS = [
  {key:'champion', icon:'🏆', title:'Reading Bee Champion', desc:'Overall champion', group:'podium'},
  {key:'second_place', icon:'🥈', title:'2nd Place', desc:'Runner-up', group:'podium'},
  {key:'third_place', icon:'🥉', title:'3rd Place', desc:'Third place', group:'podium'},
  {key:'best_fluency', icon:'🌟', title:'Best Fluency', desc:'Natural & smooth', group:'special'},
  {key:'best_expression', icon:'🌟', title:'Best Expression', desc:'Intonation & emotion', group:'special'},
  {key:'best_pronunciation', icon:'🌟', title:'Best Pronunciation', desc:'Accuracy', group:'special'},
  {key:'best_comprehension', icon:'🌟', title:'Best Comprehension', desc:'Understanding', group:'special'},
  {key:'most_improved', icon:'🌟', title:'Most Improved Reader', desc:'Biggest growth', group:'special'},
  {key:'most_confident', icon:'🌟', title:'Most Confident Reader', desc:'Confidence', group:'special'},
  {key:'best_storyteller', icon:'🌟', title:'Best Storyteller', desc:'Engaging delivery', group:'special'},
  {key:'best_character_voice', icon:'🌟', title:'Best Character Voice', desc:'Character voices', group:'special'}
];

const $ = s => document.querySelector(s);
const statusEl = $('#status');
const saveBtn = $('#saveBtn');
const notice = $('#notice');

function api(path, options={}) {
  if (window.WillenaAPI?.fetch) return window.WillenaAPI.fetch(path, options);
  return fetch(path, {...options, credentials:'include'});
}

function renderCards() {
  for (const award of AWARDS) {
    const host = award.group === 'podium' ? $('#podiumGrid') : $('#specialGrid');
    const card = document.createElement('div');
    card.className = 'award ' + award.group;
    card.innerHTML = `<label for="vote-${award.key}"><span class="icon">${award.icon}</span><span>${award.title}</span><span class="desc">${award.desc}</span></label>
      <input id="vote-${award.key}" data-award="${award.key}" maxlength="80" autocomplete="off" placeholder="Student name">`;
    host.appendChild(card);
  }
}

function getVotes() {
  return Object.fromEntries(AWARDS.map(a => [a.key, document.querySelector(`[data-award="${a.key}"]`).value.trim()]));
}

function setVotes(votes={}) {
  for (const award of AWARDS) {
    document.querySelector(`[data-award="${award.key}"]`).value = votes[award.key] || '';
  }
}

function renderResults(results={}) {
  const host = $('#results'); host.innerHTML = '';
  for (const award of AWARDS) {
    const row = document.createElement('div'); row.className = 'result-row';
    const leaders = results[award.key] || [];
    row.innerHTML = `<div class="result-award">${award.icon} ${award.title}</div><div class="leaders">${leaders.length ? leaders.map((x,i)=>`<span class="leader">${i===0?'🏅 ':''}${escapeHtml(x.name)} <b>×${x.count}</b></span>`).join('') : '<span class="empty">No votes yet</span>'}</div>`;
    host.appendChild(row);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

async function load() {
  renderCards();
  try {
    const res = await api('/.netlify/functions/reading_bee_votes');
    if (res.status === 401) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = '/Teachers/login.html?redirect=' + next; return;
    }
    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); }
    catch {
      const type = res.headers.get('content-type') || 'unknown';
      throw new Error(`API error: HTTP ${res.status} · ${type} · ${raw.slice(0,80).replace(/\\s+/g,' ')}`);
    }
    if (!res.ok || !data.success) throw new Error(data.error || 'Could not load voting');
    setVotes(data.votes);
    if (data.is_admin) {
      $('#resultsPanel').style.display = 'block';
      $('#voterCount').textContent = `${data.total_voters || 0} teacher${data.total_voters === 1 ? '' : 's'} voted`;
      renderResults(data.results);
    }
    statusEl.textContent = 'Your votes are ready.';
    saveBtn.disabled = false;
  } catch (err) {
    notice.style.display = 'block';
    notice.textContent = err.message || 'Could not load voting.';
    statusEl.textContent = 'Voting could not be loaded.';
  }
}

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true; statusEl.textContent = 'Saving…';
  try {
    const res = await api('/.netlify/functions/reading_bee_votes', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({votes:getVotes()})
    });
    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); }
    catch {
      const type = res.headers.get('content-type') || 'unknown';
      throw new Error(`Save API error: HTTP ${res.status} · ${type} · ${raw.slice(0,80).replace(/\\s+/g,' ')}`);
    }
    if (res.status === 401) { location.href='/Teachers/login.html'; return; }
    if (!res.ok || !data.success) throw new Error(data.error || 'Could not save votes');
    statusEl.textContent = '✓ Votes saved';
    setTimeout(()=>{ if(statusEl.textContent.includes('saved')) statusEl.textContent='You can change your votes anytime.'; }, 2200);
    const refresh = await api('/.netlify/functions/reading_bee_votes');
    const refreshRaw = await refresh.text();
    let fresh = {};
    try { fresh = JSON.parse(refreshRaw); } catch {}
    if (fresh.is_admin) {
      $('#voterCount').textContent = `${fresh.total_voters || 0} teacher${fresh.total_voters === 1 ? '' : 's'} voted`;
      renderResults(fresh.results);
    }
  } catch (err) {
    statusEl.textContent = 'Save failed';
    notice.style.display='block'; notice.textContent=err.message || 'Could not save votes.';
  } finally { saveBtn.disabled = false; }
});

load();
