// Validation and text processing utilities
// String cleaning, regex helpers, and content normalization

/**
 * Escape special regex characters
 */
export function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Clean AI-generated definition responses
 * Removes conversational prefixes and suffixes
 */
export function cleanDefinitionResponse(text) {
  let cleaned = text
    .replace(/^(here\s+is\s+a\s+concise\s+definition\s+for\s+["""][^"""]*["""]\s+without\s+using\s+the\s+word\s+itself:\s*["""]\s*)/i, '')
    .replace(/^(kid-friendly\s+definition:\s*)/i, '')
    .replace(/^(sure[,!]?\s*)?(i['']?ll\s+)?(?:give\s+you\s+)?(?:a\s+)?(?:definition\s+)?(?:for\s+)?(?:that\s+word[.!]?\s*)?/i, '')
    .replace(/^(here['']?s\s+)?(?:a\s+)?(?:definition\s+)?(?:for\s+)?(?:that\s+word[.!]?\s*)?/i, '')
    .replace(/^(the\s+)?(?:definition\s+)?(?:of\s+)?(?:this\s+word\s+)?(?:is[:\s]*)?/i, '')
    .replace(/\s*(?:hope\s+)?(?:this\s+)?(?:helps[!.]?)?$/i, '')
    .replace(/\s*(?:let\s+me\s+know\s+if\s+you\s+need\s+anything\s+else[!.]?)?$/i, '')
    .trim();
  
  // If it starts with quotes, try to extract the quoted content
  if (cleaned.startsWith('"') && cleaned.includes('"', 1)) {
    const match = cleaned.match(/^"([^"]+)"/);
    if (match) cleaned = match[1].trim();
  }
  
  // Remove any remaining conversational fragments
  cleaned = cleaned.replace(/^(well[,\s]*)?/i, '').trim();
  
  return cleaned;
}

/**
 * Normalize string for use as a key (lowercase, underscores, alphanumeric only)
 */
export function normalizeForKey(str) {
  return String(str || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename) {
  return String(filename || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 200);
}

/**
 * Capitalize first letter of string
 */
export function capitalize(str) {
  const s = String(str || '').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Ensure text ends with proper punctuation
 */
export function ensurePunctuation(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  if (!/[.!?]$/.test(trimmed)) return trimmed + '.';
  return trimmed;
}
