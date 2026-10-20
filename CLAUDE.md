# my-page

Personal site (GitHub Pages) + server (Cloudflare Worker + D1 database).
File guide: NOTES.md. Update it when you add, move or delete a file.
The owner is a beginner: explain changes in plain words.

## Commands (Windows PowerShell: use npm.cmd, not npm)

- Run the site: `npm.cmd start` → http://localhost:5173 (never open .html files directly)
- Before every commit: `npm.cmd run format`

## Databases: there are two

- `npm.cmd run server:test` = server on this computer + a private test database. Use this for all testing.
- `npm.cmd run server` = server on this computer + the REAL online database. Anything saved or deleted is live.

## How we work

- Work on a new branch, then open a pull request. The owner merges it with "Rebase and merge".
- Verify every change in the browser at localhost:5173 and show proof (screenshot or console).
- Keep changes small: one feature per branch, no edits to unrelated files.
- Build full-featured UI, never "basic version first". Keep ONE Admin link on the public page.

## Project rules

- Form rules live only in js/validation.js (used by both page and server). Change them there.
- Show visitor text with textContent, never innerHTML.
- Everything in index.html, admin.html, css/, js/ is public. Secrets go only in .env / Cloudflare.

## Never do (tell the owner the command instead)

- IMPORTANT: never read, print or commit .env or passwords.
- Don't commit or push to main; use a branch.
- Don't run `npm.cmd run deploy` or `npm.cmd run db:online`. They change the live server.
