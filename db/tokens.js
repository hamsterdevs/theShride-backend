const { pool } = require('./index')

async function saveToken(sessionId, refreshToken, email) {
  if (!refreshToken) return
  await pool.query(
    `INSERT INTO google_tokens (session_id, refresh_token, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id) DO UPDATE SET
       refresh_token = EXCLUDED.refresh_token,
       email = EXCLUDED.email,
       connected_at = NOW()`,
    [sessionId, refreshToken, email || null]
  )
}

async function getToken(sessionId) {
  const { rows } = await pool.query(
    `SELECT refresh_token, email, connected_at FROM google_tokens WHERE session_id = $1`,
    [sessionId]
  )
  return rows[0] || null
}

module.exports = { saveToken, getToken }
