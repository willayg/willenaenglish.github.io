// Minimal points client: server-authoritative, single source of truth
import { FN } from './api-base.js?v=20260115';

const OV_URL = FN('progress_summary') + '?section=overview';
const COUNT_URL = FN('count_true_attempts');
let refreshing = false;
let nextTimer = 0;
let currentPoints = null;

// THROTTLE: Prevent excessive server calls (at most once per 10 seconds)
const REFRESH_THROTTLE_MS = 10000;
let lastRefreshTime = 0;

export function initPointsClient() {
	// Listen for optimistic bump events from batch mode
	window.addEventListener('points:optimistic-bump', (e) => {
		const delta = e.detail?.delta || 1;
		optimisticBump(delta);
	});
}

// Auto-init: register listener immediately so games don't need to call initPointsClient
if (typeof window !== 'undefined') {
	window.addEventListener('points:optimistic-bump', (e) => {
		const delta = e.detail?.delta || 1;
		optimisticBump(delta);
	});
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
	// THROTTLE: Skip if we refreshed recently (reduce function invocations)
	const now = Date.now();
	const timeSinceLast = now - lastRefreshTime;
	if (timeSinceLast < REFRESH_THROTTLE_MS && delayMs === 0) {
		console.debug('[points-client] Throttled refresh, last was', Math.round(timeSinceLast/1000), 's ago');
		return;
	}
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
	lastRefreshTime = Date.now(); // Track for throttling
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
