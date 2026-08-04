// Minimal points client: server-authoritative, single source of truth
import { FN } from './api-base.js?v=20260115';

const OV_URL = FN('progress_summary') + '?section=overview';
const COUNT_URL = FN('count_true_attempts');
let refreshing = false;
let nextTimer = 0;
let currentPoints = null;

let optimisticListenerRegistered = false;

function registerOptimisticListenerOnce() {
	if (optimisticListenerRegistered) return;
	optimisticListenerRegistered = true;
	window.addEventListener('points:optimistic-bump', (e) => {
		const delta = e.detail?.delta || 1;
		optimisticBump(delta);
	});
}

// THROTTLE: Prevent excessive server calls (at most once per 10 seconds)
const REFRESH_THROTTLE_MS = 10000;
let lastRefreshTime = 0;

export function initPointsClient() {
	// Idempotent: safe to call multiple times
	if (typeof window !== 'undefined') registerOptimisticListenerOnce();
}

// Auto-init: register listener immediately so games don't need to call initPointsClient
if (typeof window !== 'undefined') {
	registerOptimisticListenerOnce();
}

export function optimisticBump(delta = 1) {
	try {
		const d = Number.isFinite(delta) ? delta : 1;
		if (typeof currentPoints === 'number') {
			currentPoints += d;
			window.dispatchEvent(new CustomEvent('points:update', { detail: { total: currentPoints } }));
			// Confirm the optimistic value against the server shortly afterward.
			setTimeout(() => { refreshFromServerOnce().catch(() => {}); }, 500);
			return;
		}

		// The header can receive a reward before its initial total has loaded.
		// Never dispatch a null total; fetch the authoritative total immediately.
		refreshFromServerOnce().catch(() => {});
	} catch {}
}

export function scheduleRefresh(delayMs = 0) {
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
	lastRefreshTime = Date.now();
	try {
		const res = await fetch(COUNT_URL, { credentials: 'include', cache: 'no-store' });
		if (res.ok) {
			const js = await res.json().catch(() => null);
			const total = (js && typeof js.points === 'number') ? js.points
				: (js && typeof js.correct === 'number') ? js.correct
				: null;
			if (typeof total === 'number') {
				applyServerPoints(total);
				return true;
			}
		}
		const ovRes = await fetch(OV_URL, { credentials: 'include', cache: 'no-store' });
		if (!ovRes.ok) return false;
		const ov = await ovRes.json().catch(() => null);
		if (!ov || typeof ov.points !== 'number') return false;
		applyServerPoints(ov.points);
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
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') scheduleRefresh(0);
	});
}

export function showLoginBanner() {}
export function hideBanner() {}
