import { initializeImageModule } from './images.js?v=20260923-imgstate2';
import { setMaskWordPairs, setHideRandomLetters } from './behaviors.js?v=20260923-imgstate2';

export async function loadModules() {
    // Optional dynamic overrides are disabled by default (no tests directory in production)
    // Keep fallbacks active without noisy console errors.
    return;
}
