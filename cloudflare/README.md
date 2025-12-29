Cloudflare branch scaffold

This folder contains example files and notes to help you create a `cloudflare` branch safely.

What you can do next (recommended):
1. Create the branch locally and switch to it (commands below).
2. Review these example files and edit secrets locally (do NOT commit secrets).
3. Commit and push the branch to GitHub.

Files in this folder (examples only):
- `wrangler.toml.example` - example config for publishing the worker.
- `publish-action-example.yml` - example GitHub Actions workflow (kept here as an example; copy to `.github/workflows/` if you want automated publishing on this branch).

Important: Do not enable rollout=100 on `main`. Keep changes isolated to the `cloudflare` branch until you have validated routing and cookies.

Local git commands (PowerShell):
```powershell
# Ensure you're on main and up-to-date
git checkout main
git pull origin main
# Create cloudflare branch from current state
git checkout -b cloudflare
# Add the scaffold files
git add cloudflare/README.md cloudflare/wrangler.toml.example cloudflare/publish-action-example.yml
git commit -m "chore: add cloudflare scaffold files"
# Push the new branch to origin
git push -u origin cloudflare
```

If you want me to prepare a PR or additional files to be merged into this branch, tell me what you want included (wrangler secrets, CI steps — I will not create secrets).