# CourtIQ — Agent Instructions

## Git Workflow (Mandatory)

When completing any task that involves code changes, you MUST follow these steps before marking the task as done:

1. **Commit** your changes with a clear message.
2. **Push to remote:** Run `git push origin main` (or push your branch and open a PR).
3. **Verify the push:** Run `git log origin/main --oneline -1` and confirm your commit hash appears on the remote.

A task is **NOT done** until your commit exists on `origin/main`. If the push fails, report the error — do not silently mark the task complete.

## Commit Co-authorship

All commits must end with:
```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```
