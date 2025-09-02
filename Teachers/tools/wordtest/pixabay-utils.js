/**
 * Pixabay URL helpers
 * Centralizes construction of search URLs for opening Pixabay in a new tab
 * and building the Netlify function request for image fetching.
 */

/**
 * Build a Pixabay site search URL for a given word and mode.
 * Modes: 'photos' | 'illustrations' | 'ai' | 'vector images'
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
    case 'clipart':
      // Treat clipart as vector-only search on Pixabay
      return `https://pixabay.com/vectors/search/${encoded}/`;
    case 'vector images':
      return `https://pixabay.com/vectors/search/${encoded}/`;
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
  // Map UI mode to Pixabay API image_type
  let imageType = 'all';
  if (mode === 'illustrations') imageType = 'illustration';
  else if (mode === 'photos') imageType = 'photo';
  else if (mode === 'clipart' || mode === 'vector images') imageType = 'vector';
  const params = new URLSearchParams({ q, image_type: imageType, safesearch: 'true', order: 'popular', per_page: String(perPage) });
  return `/.netlify/functions/pixabay?${params.toString()}`;
}

// Expose a safe global for inline handlers where imports aren't available
try { window.getPixabaySearchUrl = getPixabaySearchUrl; } catch { /* SSR/No window */ }

export default { getPixabaySearchUrl, getPixabayFunctionUrl };
