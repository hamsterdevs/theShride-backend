const { pool } = require('./index')

async function addSignup(email, source, sessionId) {
  const { rows } = await pool.query(
    `INSERT INTO waitlist_signups (email, source, session_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [email, source || null, sessionId || null]
  )
  return rows.length > 0
}

async function listSignups() {
  const { rows } = await pool.query(
    `SELECT id, email, source, session_id, created_at
     FROM waitlist_signups
     ORDER BY created_at DESC`
  )
  return rows
}

module.exports = { addSignup, listSignups }