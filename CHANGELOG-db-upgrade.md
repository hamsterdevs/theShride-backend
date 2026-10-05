# Database upgrade — what changed

Replaces the two shared files (`googleTokens.json`, `lastResume.pdf`) with
a per-session SQLite database, so two people using the app at once stop
overwriting each other's resume and Gmail connection. No login — sessions
are anonymous, identified by a `X-Session-Id` header the frontend generates
and sends on every request.

## Install

```bash
npm install
```

(`better-sqlite3` was added to `package.json`; nothing else new.)

## New files

- `db/index.js` — opens `data/app.db` (creates it + the schema on first run)
- `db/sessions.js`, `db/tokens.js`, `db/resumes.js` — small query modules,
  one per table
- `middleware/session.js` — reads `X-Session-Id`, mints one if missing,
  attaches `req.sessionId`
- `controllers/sessionController.js` + `routes/sessionRoutes.js` —
  `GET /api/session`, returns what the backend actually knows for this
  session (`googleConnected`, `resumeUploaded`, etc.) — useful for the
  frontend to reconcile its local state against reality

## Modified files

| File | Change |
|---|---|
| `server.js` | Mounts `sessionMiddleware` (after `express.json()`, before routes) and `sessionRoutes` at `/api/session`. |
| `config/cors.js` | Added `X-Session-Id` to `allowedHeaders` and `exposedHeaders` — without this, browsers strip the header on cross-origin requests once you're off the dev proxy. |
| `config/googleOAuth.js` | Removed the file-based `loadRefreshToken`/`saveRefreshToken`. `getGoogleOAuthClient()` is now a bare client factory (no credentials attached). New `getAuthorizedClientForSession(sessionId)` is what actually loads a session's token from the database. `saveRefreshToken(sessionId, refreshToken, email)` now takes a session id and writes to `google_tokens`. |
| `controllers/authController.js` | `getAuthUrl` now embeds `request.sessionId` as the OAuth `state` param — this is how the callback (a real redirect, no headers) knows whose token it just received. Also fixed: the "no client ID" mock URL was hardcoded to `localhost:5174`; it now reads `clientOrigin` like everywhere else. `handleCallback` reads `state` back out and saves the token against that session, now including the email in the same write. |
| `controllers/resumeController.js` | After a successful parse, saves the file bytes + parsed profile to `resumes` (keyed by session), and sets the session's `name` from the parsed resume. Removed the old `saveLastResumePdf` call. |
| `services/resumeService.js` | Removed the file-based PDF cache (`saveLastResumePdf`/`getLastResumePdf`) — that's now `db/resumes.js`. Text extraction and the Gemini parsing call are untouched. |
| `services/applicationService.js` | `sendApplicationEmail` now takes `sessionId`. Looks up the resume via `db/resumes.js` instead of the old file cache, and the Gmail client via `getAuthorizedClientForSession(sessionId)` instead of a globally-loaded token. The email attachment now uses the real uploaded filename instead of the hardcoded `Boluwatife_Oladele_Resume.pdf`. |
| `controllers/applicationController.js` | `sendApplication` passes `request.sessionId` through to the service. |
| `.gitignore` | Added `data/` (the SQLite file). |
| `.env.example` | Added optional `DATABASE_PATH`. |

## Deliberately untouched

- `applyController.js` / `playwrightService.js` / `/api/apply` — this is a
  separate stub pipeline your frontend doesn't currently call (it uses
  `/api/applications/draft` and `/send`). Left alone to keep this change
  scoped.
- `geminiService.js`'s `gemini-2.5-flash` default vs. `gemini-3.6-flash`
  elsewhere — the audit flagged this inconsistency; not a database concern,
  separate fix.
- The full resume text still gets logged to the console on every parse
  (`services/resumeService.js`) — real PII in logs, flagged by the earlier
  audit. Also not a database concern; worth a dedicated fix.

## Removed from this delivery (not from your original repo's logic)

`config/googleTokens.json` and `config/lastResume.pdf` were deleted from
this copy before zipping — the code no longer reads or writes either file,
and I wasn't going to ship a (now-revoked) refresh token or a real
candidate's resume back out in a zip. Your original repo still has them on
disk; they're now simply dead weight the app won't touch. Safe to delete
there too, or leave them — nothing imports them anymore.

## What this doesn't fix (by design)

A session id is a UUID, not a password — anyone holding it could act as
that session. That's the normal tradeoff for anonymous/guest identity, not
something to design around before real auth exists. Every lookup here is
already keyed by session id rather than scattered across flat files, so
swapping "id from a header" for "id from a verified login" later is a
contained change, not a rewrite.
