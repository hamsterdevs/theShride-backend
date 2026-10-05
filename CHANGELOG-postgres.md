# SQLite → Postgres (Neon) — what changed

The earlier database upgrade used `better-sqlite3`, which failed to install
on Node 26 (no prebuilt binary existed yet for that ABI — this is now a
separate, resolved issue; see the `npm install` troubleshooting in chat).
Since the plan is to deploy on Vercel anyway — whose functions have an
ephemeral filesystem, meaning a local SQLite file wouldn't survive between
invocations regardless — this swaps straight to Postgres (Neon) instead of
fixing SQLite only to replace it again later.

## Install

```bash
npm install
```

`better-sqlite3` was removed from `package.json`; `pg` (node-postgres) was
added.

## Required: set `DATABASE_URL`

Add to your `.env` (see `.env.example`):

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

Get the real value from your Neon project dashboard → **Connection Details**
→ copy the connection string directly (don't retype it by hand — it's easy
to drop the `:` between username and password, which breaks parsing).

**If you pasted a connection string anywhere outside your own `.env` file**
(chat, a doc, a screenshot) — reset the password in Neon's dashboard
(**Settings → Reset password**) before relying on it. Same rule as the
Google refresh token earlier: anything that left your machine should be
treated as burned.

## The architectural change: synchronous → asynchronous

This is the part that touched more than just `db/`. `better-sqlite3` is
synchronous — every call blocks and returns immediately, like reading a
local variable. Postgres is a network database, so every call through `pg`
returns a Promise. That ripples into every file that ever touched the
database:

| File | What changed |
|---|---|
| `db/index.js` | Now a `pg` `Pool` instead of a `better-sqlite3` instance. Schema creation runs once as an async `ready` promise instead of synchronously at import time. |
| `db/sessions.js`, `db/tokens.js`, `db/resumes.js` | Every exported function is now `async`. Query placeholders changed from SQLite's `?` to Postgres's `$1, $2, ...`. `datetime('now')` → `NOW()`. `BLOB` → `BYTEA`. |
| `middleware/session.js` | Now `async`; awaits `db.ready` first (cheap after the first request — the promise is already resolved), then awaits `touchSession`. |
| `controllers/sessionController.js` | The three lookups (`getSession`, `getToken`, `getResume`) now run concurrently via `Promise.all` instead of three sequential synchronous calls. |
| `config/googleOAuth.js` | `getAuthorizedClientForSession` and `saveRefreshToken` are now `async`. |
| `controllers/authController.js` | One added `await` on the `saveRefreshToken` call. |
| `controllers/resumeController.js` | Added `await` on `saveResume` and `setSessionName`. |
| `services/applicationService.js` | `getResumeAttachment` is now `async` (it calls `getResume`); its call site and the `getAuthorizedClientForSession` call both now `await`. |

**Why this is safe without wrapping everything in try/catch:** your
`package.json` already has Express 5, which auto-forwards a rejected
promise from an `async` route handler or middleware function straight to
the error handler — the same behavior you'd get from manual
`try { ... } catch (e) { next(e) }`, without writing it by hand. The
handlers that already had explicit try/catch (matching your existing style)
keep it; the ones that didn't don't need it added just for this.

## Schema (unchanged in shape, just Postgres syntax)

```sql
sessions (id, name, created_at, last_seen_at)
google_tokens (session_id, refresh_token, email, connected_at)
resumes (session_id, file_name, mime_type, file_data, parsed_profile, uploaded_at)
```

Same three tables, same relationships, same "one row per session" design —
only the engine underneath changed.

## Deploying to Vercel — one more thing to know

`server.js` already has `if (require.main === module) { app.listen(...) }`,
which means it only starts a long-running listener when run directly
(`node server.js`) — exactly the shape Vercel expects: it imports the
exported `app` and calls it per-request as a function, not as a server that
stays running. Nothing further needed there for this change specifically.
Add `DATABASE_URL` (and your existing `GEMINI_API_KEY`,
`GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI`, `CLIENT_ORIGIN`) as Environment
Variables in your Vercel project settings — not in a committed `.env`.
