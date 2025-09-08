// badges.js - Badge logic and rendering for student profile

// Define badge types and calculation logic
const BADGES = [
  {
    id: 'points-1000',
    icon: '🏅',
    title: 'Point Collector',
    subtitle: 'Earned 1000 points',
    achieved: stats => stats.points >= 1000
  },
  {
    id: 'points-5000',
    icon: '🥇',
    title: 'Point Champion',
    subtitle: 'Earned 5000 points',
    achieved: stats => stats.points >= 5000
  },
  {
    id: 'stars-100',
    icon: '🌟',
    title: 'Super Star',
    subtitle: 'Earned 100 stars',
    achieved: stats => stats.stars >= 100
  },
  {
    id: 'medals-10',
    icon: '🎖️',
    title: 'Medalist',
    subtitle: 'Earned 10 medals',
    achieved: stats => stats.medals >= 10
  },
  {
    id: 'perfect-run',
    icon: '🎯',
    title: 'Bullseye',
    subtitle: 'Completed a perfect run',
    achieved: stats => stats.perfectRuns > 0
  },
  {
    id: 'lists-explored',
    icon: '📚',
    title: 'Explorer',
    subtitle: 'Explored 10 lists',
    achieved: stats => stats.listsExplored >= 10
  },
  {
    id: 'hot-streak',
    icon: '🔥',
    title: 'Hot Streak',
    subtitle: '5-game win streak',
    achieved: stats => stats.hotStreak >= 5
  },
  {
    id: 'words-mastered',
    icon: '💡',
    title: 'Word Master',
    subtitle: 'Mastered 100 words',
    achieved: stats => stats.wordsMastered >= 100
  },
  {
    id: 'sessions-pro',
    icon: '🎮',
    title: 'Session Pro',
    subtitle: 'Played 20 sessions',
    achieved: stats => stats.sessionsPlayed >= 20
  },
  {
    id: 'favorite-list',
    icon: '⭐',
    title: 'List Lover',
    subtitle: 'Set a favorite list',
    achieved: stats => !!stats.favoriteList
  },
  {
    id: 'hardest-word',
    icon: '🏆',
    title: 'Tough Cookie',
    subtitle: 'Identified hardest word',
    achieved: stats => !!stats.hardestWord
  },
  // 20 more creative badges
  { id: 'points-10000', icon: '💰', title: 'Point Tycoon', subtitle: 'Earned 10,000 points', achieved: stats => stats.points >= 10000 },
  { id: 'points-500', icon: '🥈', title: 'Point Rookie', subtitle: 'Earned 500 points', achieved: stats => stats.points >= 500 },
  { id: 'stars-250', icon: '✨', title: 'Hyper Star', subtitle: 'Earned 250 stars', achieved: stats => stats.stars >= 250 },
  { id: 'medals-25', icon: '🏵️', title: 'Medal Hero', subtitle: 'Earned 25 medals', achieved: stats => stats.medals >= 25 },
  { id: 'lists-explored-25', icon: '🗂️', title: 'List Adventurer', subtitle: 'Explored 25 lists', achieved: stats => stats.listsExplored >= 25 },
  { id: 'lists-explored-50', icon: '📖', title: 'List Legend', subtitle: 'Explored 50 lists', achieved: stats => stats.listsExplored >= 50 },
  { id: 'words-mastered-250', icon: '🧠', title: 'Brainiac', subtitle: 'Mastered 250 words', achieved: stats => stats.wordsMastered >= 250 },
  { id: 'words-mastered-500', icon: '🔮', title: 'Word Wizard', subtitle: 'Mastered 500 words', achieved: stats => stats.wordsMastered >= 500 },
  { id: 'sessions-50', icon: '🕹️', title: 'Game Addict', subtitle: 'Played 50 sessions', achieved: stats => stats.sessionsPlayed >= 50 },
  { id: 'sessions-100', icon: '🎲', title: 'Game Legend', subtitle: 'Played 100 sessions', achieved: stats => stats.sessionsPlayed >= 100 },
  { id: 'hot-streak-10', icon: '⚡', title: 'Lightning Streak', subtitle: '10-game win streak', achieved: stats => stats.hotStreak >= 10 },
  { id: 'hot-streak-20', icon: '🔥', title: 'Inferno Streak', subtitle: '20-game win streak', achieved: stats => stats.hotStreak >= 20 },
  { id: 'perfect-run-5', icon: '🏹', title: 'Sharpshooter', subtitle: '5 perfect runs', achieved: stats => stats.perfectRuns >= 5 },
  { id: 'perfect-run-10', icon: '🥏', title: 'Disc Master', subtitle: '10 perfect runs', achieved: stats => stats.perfectRuns >= 10 },
  { id: 'early-bird', icon: '🌅', title: 'Early Bird', subtitle: 'Played early in the day', achieved: stats => stats.earlyBird },
  { id: 'night-owl', icon: '🌙', title: 'Night Owl', subtitle: 'Played late at night', achieved: stats => stats.nightOwl },
  { id: 'first-list', icon: '🎉', title: 'First Steps', subtitle: 'Completed first list', achieved: stats => stats.listsExplored >= 1 },
  { id: 'first-star', icon: '⭐', title: 'Star Baby', subtitle: 'Earned first star', achieved: stats => stats.stars >= 1 },
  { id: 'first-medal', icon: '🏅', title: 'Medal Baby', subtitle: 'Earned first medal', achieved: stats => stats.medals >= 1 },
  { id: 'first-session', icon: '🚀', title: 'Session Baby', subtitle: 'Played first session', achieved: stats => stats.sessionsPlayed >= 1 },
];

function getStatsFromPage() {
  // Read current counters already painted by student_profile.js
  return {
    points: parseInt(document.getElementById('awardPoints')?.textContent)||0,
    medals: parseInt(document.getElementById('awardMedals')?.textContent)||0,
    stars: parseInt(document.getElementById('awardStars')?.textContent)||0,
    // Fallbacks until overview event arrives
    perfectRuns: parseInt(document.getElementById('ovPerfectRuns')?.textContent)||0,
    listsExplored: parseInt(document.getElementById('ovListsExplored')?.textContent)||0,
    hotStreak: parseInt(document.getElementById('ovHotStreak')?.textContent)||0,
    wordsMastered: parseInt(document.getElementById('ovWordsMastered')?.textContent)||0,
    sessionsPlayed: parseInt(document.getElementById('ovSessionsPlayed')?.textContent)||0,
    favoriteList: (document.getElementById('ovFavoriteList')?.textContent||'').trim() && (document.getElementById('ovFavoriteList')?.textContent||'').trim() !== '—',
    hardestWord: (document.getElementById('ovHardestWord')?.textContent||'').trim() && (document.getElementById('ovHardestWord')?.textContent||'').trim() !== '—'
  };
}

function renderBadges(statsOverride) {
  const stats = statsOverride || getStatsFromPage();
  const container = document.getElementById('badgesContainer');
  if (!container) return;
  const achieved = BADGES.filter(b => b.achieved(stats));
  // Remove loading and empty messages
  const loading = document.getElementById('badgesEmpty');
  if (loading) loading.remove();
  const loaded = document.getElementById('badgesLoaded');
  if (loaded) loaded.remove();
  container.innerHTML = achieved.length
    ? achieved.map(b => `
      <div class="badge">
        <span class="badge-icon">${b.icon}</span>
        <span class="badge-title">${b.title}</span>
        <span class="badge-subtitle">${b.subtitle}</span>
      </div>
    `).join('')
    : '<div class="mut">No badges yet.</div>';

  // Keep the Awards counter in sync with what we actually render
  try {
    const awardEl = document.getElementById('awardBadges');
    if (awardEl) awardEl.textContent = String(achieved.length);
    // Also notify listeners (e.g., profile controllers) about the rendered count
    window.dispatchEvent(new CustomEvent('badges:rendered', { detail: { count: achieved.length } }));
  } catch {}
}

// Re-render when overview stats are loaded by student_profile.js
window.addEventListener('profile:overview', (ev) => {
  const ov = ev?.detail || {};
  const stats = {
    points: Number(ov.points)||0,
    stars: Number(ov.stars)||0,
    medals: Number(ov.perfect_runs ?? ov.mastered_lists ?? 0)||0,
    perfectRuns: Number(ov.perfect_runs)||0,
    listsExplored: Number(ov.lists_explored)||0,
    hotStreak: Number(ov.best_streak)||0,
    wordsMastered: Number(ov.words_mastered)||0,
    sessionsPlayed: Number(ov.sessions_played)||0,
    favoriteList: !!(ov.favorite_list && ov.favorite_list.name),
    hardestWord: !!(ov.hardest_word && ov.hardest_word.word)
  };
  renderBadges(stats);
});

// Initial paint and a small fallback that reacts when counters change later
document.addEventListener('DOMContentLoaded', () => {
  renderBadges();
  // Fallback: observe counters and re-render when they change
  const starsEl = document.getElementById('awardStars');
  const medalsEl = document.getElementById('awardMedals');
  const obs = new MutationObserver(() => renderBadges());
  [starsEl, medalsEl].forEach(el => { if (el) obs.observe(el, { characterData: true, subtree: true, childList: true }); });
});
