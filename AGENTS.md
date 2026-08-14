# Willena architecture rules

## Never use Netlify

DO NOT USE NETLIFY FOR WILLENA.

- Do not create files under `netlify/functions/`.
- Do not propose or implement Netlify Functions.
- Do not route Willena APIs through Netlify.
- Do not assume a Netlify deployment exists.
- Do not use Netlify as a fallback or temporary backend.

## Approved architecture

Willena uses:

- Cloudflare Pages for hosted web apps.
- Cloudflare Workers / the existing Cloudflare API gateway for server-side API logic when needed.
- Supabase for authentication, database, storage, RLS, and direct data operations where appropriate.

For new backend work, first determine whether it belongs in an existing Cloudflare Worker/API route or can be done safely through Supabase with RLS. Do not introduce another backend platform.

## Existing legacy paths

Some existing frontend code may still contain historical `/.netlify/functions/...`-shaped paths because the Cloudflare gateway maps legacy route names. Do not interpret those strings as permission to create or depend on Netlify infrastructure. Prefer migrating new work to explicit Cloudflare/Supabase architecture when practical.
