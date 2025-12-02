import { initializeImageModule } from './images.js';
import { setMaskWordPairs, setHideRandomLetters } from './behaviors.js';

export async function loadModules() {
    // Optional dynamic overrides are disabled by default (no tests directory in production)
    // Keep fallbacks active without noisy console errors.
    return;
}
