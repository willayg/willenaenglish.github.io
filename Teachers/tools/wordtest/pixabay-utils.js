/**
 * Pixabay URL helpers
 * Centralizes construction of search URLs for opening Pixabay in a new tab
 * and building the Netlify function request for image fetching.
 */

/**
 * Build a Pixabay site search URL for a given word and mode.
 * Modes: 'photos' | 'illustrations' | 'ai' | 'gifs'
 */
export function getPixabaySearchUrl(word, mode = 'photos') {
  const encoded = encodeURIComponent(String(word || ''));
  switch (mode) {
    case 'photos':
      return `https://pixabay.com/images/search/${encoded}/`;
    case 'illustrations':
      return `https://pixabay.com/illustrations/search/${encoded}/`;
    case 'ai':
      // Use content_type=ai filter on images search
      return `https://pixabay.com/images/search/${encoded}/?content_type=ai`;
    case 'gifs':
      // Use content_type=gif filter on images search
      return `https://pixabay.com/images/search/${encoded}/?content_type=gif`;
    default:
      return `https://pixabay.com/images/search/${encoded}/`;
  }
}

/**
 * Build the Netlify function URL for server-side Pixabay fetching.
 * Only supports image_type mapping (photo | illustration | all).
 * For AI/GIF filters, fall back to 'all' as the Netlify function doesn't support content_type.
 */
export function getPixabayFunctionUrl(word, mode = 'photos', perPage = 5) {
  const q = encodeURIComponent(String(word || ''));
  const imageType = mode === 'illustrations' ? 'illustration' : (mode === 'photos' ? 'photo' : 'all');
  const params = new URLSearchParams({ q, image_type: imageType, safesearch: 'true', order: 'popular', per_page: String(perPage) });
  return `/.netlify/functions/pixabay?${params.toString()}`;
}

// Expose a safe global for inline handlers where imports aren't available
try { window.getPixabaySearchUrl = getPixabaySearchUrl; } catch { /* SSR/No window */ }

export default { getPixabaySearchUrl, getPixabayFunctionUrl };
