// Constants - Centralized configuration values

export const ENDPOINTS = {
  SUPABASE_PROXY: '/.netlify/functions/supabase_proxy_fixed',
  UPSERT_SENTENCES: '/.netlify/functions/upsert_sentences_batch',
  IMAGE_PROXY: '/.netlify/functions/image_proxy',
  // Reuse OpenAI proxy for translations (prompt-based)
  TRANSLATE: '/.netlify/functions/openai_proxy',
};

export const STORAGE_KEYS = {
  USER_ID: 'user_id',
  SESSION_USER_ID: 'user_id',
  GAME_CACHE_PREFIX: 'game_builder_cache_',
};

export const USER_ID_KEYS = [
  'user_id', 'id', 'userId', 'current_user_id', 'currentUserId',
  'sb_user_id', 'supabase_user_id', 'auth_user_id'
];

export const ACTIONS = {
  UPDATE_GAME: 'update_game_data',
  INSERT_GAME: 'insert_game_data',
  DELETE_GAME: 'delete_game_data',
  GET_GAME: 'get_game_data',
  LIST_GAMES: 'list_game_data',
  UPSERT_SENTENCES: 'upsert_sentences_batch',
};

export const DEFAULTS = {
  TITLE: 'Untitled Game',
  PLACEHOLDER_IMAGE: 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><rect width="300" height="180" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#94a3b8">Loading...</text></svg>'
  ),
};

export const TOAST_DURATION = 2000;
export const TINY_TOAST_DURATION = 500;
