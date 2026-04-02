# CourtIQ — Agent Instructions

## Build Verification (Mandatory)

Before marking ANY task involving code changes as done, you MUST pass every step below. If any step fails, fix it before reporting the task as complete. No exceptions.

1. **Install dependencies:** Run `npm ci` from the repo root. This is what Docker runs — if it fails locally, it will fail in Docker.
2. **Build:** Run `npx turbo build --filter=@courtiq/api...` — if the build fails, the deploy will fail.
3. **Deploy test (when touching deployment config):** If the task touches Dockerfile, fly.toml, or any deployment-related config, run `fly deploy --app courtiq-api` or at minimum `docker build .` to verify the image builds.
4. **Commit** your changes with a clear message.
5. **Push to remote:** Run `git push origin main` (or push your branch and open a PR).
6. **Verify the push:** Run `git log origin/main --oneline -1` and confirm your commit hash appears on the remote.

A task is **NOT done** until your commit exists on `origin/main` and the build passes. If the push or build fails, report the error — do not silently mark the task complete.

## Commit Co-authorship

All commits must end with:
```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```
