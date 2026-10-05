const { Pool } = require('pg')

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set. Add your Neon connection string to .env (see .env.example).')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires TLS (sslmode=require in the connection string); this accepts
  // Neon's certificate chain the same way that flag does.
  ssl: { rejectUnauthorized: false },
})

// Runs once, on first import. Every query module awaits this before its first
// real query (via middleware/session.js, which runs on every single request),
// so the schema is guaranteed to exist before anything else touches the tables.
const ready = pool
  .query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      name          TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS google_tokens (
      session_id    TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
      refresh_token TEXT NOT NULL,
      email         TEXT,
      connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS resumes (
      session_id      TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
      file_name       TEXT,
      mime_type       TEXT,
      file_data       BYTEA,
      parsed_profile  TEXT,
      uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  .then(() => console.log('[db] Schema ready.'))
  .catch((error) => {
    console.error('[db] Failed to initialize schema:', error.message)
    throw error
  })

module.exports = { pool, ready }
