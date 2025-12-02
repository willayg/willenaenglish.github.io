# Student tracking

This module logs per-word attempts and game sessions from Word Arcade (and other games) via a Netlify Function to Supabase.

- `records.js`: client-side helpers (ES module) used by game modes
- `../netlify/functions/log_word_attempt.js`: serverless endpoint that inserts rows into Supabase

Environment (Netlify > Site settings > Environment variables):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Database tables (see `schema.sql`): `progress_sessions` and `progress_attempts`
- `user_id` fields reference `profiles.id` (the main user table)
- Store user ID at login: `localStorage.setItem('user_id', profilesId)`

## Events sent
- `session_start`: when a mode run begins
- `attempt`: for each word/question  
- `session_end`: when the run finishes

## Review queries (examples)
- Hard words for a user: latest 30 incorrect attempts grouped by word
- Words needing review: words with accuracy < 60% in last N attempts

You can build lesson generators on top of these queries.