// Games/english_arcade/scripts/api-base.js
// Determine the correct API base URL based on environment
const getApiBase = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  // GitHub Pages or custom domain needs full Netlify URL
  if (host === 'willenaenglish.github.io' || host === 'willenaenglish.com' || host === 'www.willenaenglish.com') {
    return 'https://willenaenglish.netlify.app';
  }
  // Netlify or localhost use relative paths
  return '';
};

const FUNCTIONS_BASE = getApiBase();
export const FN = (name) => `${FUNCTIONS_BASE}/.netlify/functions/${name}`;
