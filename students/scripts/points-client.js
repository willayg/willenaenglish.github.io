// Minimal points client: server-authoritative, single source of truth
import { FN } from './api-base.js';

const OV_URL = FN('progress_summary') + '?section=overview';
const COUNT_URL = FN('count_true_attempts');
let refreshing = false;
let nextTimer = 0;
let currentPoints = null;

export function initPointsClient() {
	// noop for now; hook for future
}

export function optimisticBump(delta = 1) {
	// In-memory only; UI will refresh after server confirms
	try {
		const d = Number.isFinite(delta) ? delta : 1;
		if (typeof currentPoints === 'number') currentPoints += d;
		window.dispatchEvent(new CustomEvent('points:update', { detail: { total: currentPoints } }));
	} catch {}
}

export function scheduleRefresh(delayMs = 0) {
	try { clearTimeout(nextTimer); } catch {}
	nextTimer = setTimeout(() => { refreshFromServerOnce().catch(() => {}); }, Math.max(0, delayMs));
}

export function applyServerPoints(n) {
	if (typeof n !== 'number') return;
	currentPoints = n;
	try { window.dispatchEvent(new CustomEvent('points:update', { detail: { total: n } })); } catch {}
}

export async function refreshFromServerOnce() {
	if (refreshing) return false;
	refreshing = true;
	try {
		// Prefer the lightweight endpoint if available
		const res = await fetch(COUNT_URL, { credentials: 'include', cache: 'no-store' });
		if (res.ok) {
			const js = await res.json().catch(() => null);
			const total = (js && typeof js.points === 'number') ? js.points
				: (js && typeof js.correct === 'number') ? js.correct
				: null;
			if (typeof total === 'number') {
				applyServerPoints(total);
				try { window.dispatchEvent(new CustomEvent('points:update', { detail: { total } })); } catch {}
				return true;
			}
		}
		// Fallback to overview points
		const ovRes = await fetch(OV_URL, { credentials: 'include', cache: 'no-store' });
		if (!ovRes.ok) return false;
		const ov = await ovRes.json().catch(() => null);
		if (!ov || typeof ov.points !== 'number') return false;
		applyServerPoints(ov.points);
		try { window.dispatchEvent(new CustomEvent('points:update', { detail: { total: ov.points } })); } catch {}
		return true;
	} finally {
		refreshing = false;
	}
}

export async function fetchOverview() {
	const res = await fetch(OV_URL, { credentials: 'include', cache: 'no-store' });
	if (!res.ok) return {};
	return res.json().catch(() => ({}));
}

export function handleVisibilityAndStorage() {
	// On return to tab, refresh once
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') scheduleRefresh(0);
	});
}

export function showLoginBanner() {}
export function hideBanner() {}
