# Worksheet storage Phase 6 release

This release deploys the `worksheet-assets` Cloudflare Worker and publishes the V2 save paths for Word Builder and Flashcards.

Release order:

1. GitHub Actions runs Worker unit tests.
2. Wrangler validates and deploys the Worker with the direct `WORKSHEET_ASSETS` R2 binding.
3. The workflow smoke-tests `https://worksheet-assets.willenaenglish.com` with an authenticated-CORS preflight.
4. The `teachers` branch publishes the frontend save and dual-format load changes.

No existing worksheet rows are migrated or deleted by this release.
