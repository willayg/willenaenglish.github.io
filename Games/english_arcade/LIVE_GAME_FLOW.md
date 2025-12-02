# Live Game Cross-Device Flow

This document describes the new backend ID-based flow replacing the prior localStorage slug stubs.

## Overview
Teachers create a live game from the Game Builder modal. Instead of generating a random slug and storing a stub in localStorage (which only worked on the same device), the builder now POSTs the game payload to a Netlify Function `/.netlify/functions/live_game` which persists the game in the `live_games` table (Supabase). The response includes a UUID `id`. A QR code and share link are generated using `?id=<uuid>` so any device can fetch the game data.

## API
POST /.netlify/functions/live_game
Body:
```
{ "mode": "multi_choice_eng_to_kor", "title": "Optional Title", "words": [...], "config": { ... }, "ttlMinutes": 180 }
```
Response:
```
{ "success": true, "id": "<uuid>" }
```
GET /.netlify/functions/live_game?id=<uuid>
Response (200):
```
{ "success": true, "id": "<uuid>", "mode": "multi_choice_eng_to_kor", "title": "Optional Title", "words": [...], "config": { ... } }
```
404 if not found or expired.

## Table Schema Suggestion
```
CREATE TABLE live_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id text UNIQUE,
  creator_id uuid,
  mode text NOT NULL,
  title text,
  words jsonb,
  config jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  access text DEFAULT 'public'
);
CREATE INDEX ON live_games (created_at);
```
Add a scheduled cleanup (or manual) to purge rows where `expires_at < now()`.

## Frontend Changes
- `create-game-modal.js`: Replaced slug/localStorage logic with POST to live_game, QR now uses `?id=`.
- `play-main.js`: Reads `id` param, fetches game data from backend, then loads the requested mode.

## Extending
1. Add new modes: update `core/mode-registry.js` and ensure `mode` value saved in POST matches the registry key.
2. Add auth linking: include `creator_id` (resolve user via cookie) inside function if you need ownership / moderation.
3. Add short codes: generate a 5-6 character `short_id` and allow lookup by either `id` or `short` param.

## Security Considerations
- Current implementation allows public anonymous reads (intended for classroom). Do not store sensitive data in `words` or `config`.
- If abuse occurs, add a random short code and only expose that, or restrict creation to authenticated teachers.

## Migration Notes
Old slug-based localStorage stubs are no longer used. Links with `?slug=` will fail until removed; update any saved bookmarks or docs to use `?id=`.
