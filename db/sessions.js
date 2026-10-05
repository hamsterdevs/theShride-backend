const { pool } = require('./index')

async function touchSession(sessionId) {
  await pool.query(
    `INSERT INTO sessions (id) VALUES ($1)
     ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW()`,
    [sessionId]
  )
}

async function setSessionName(sessionId, name) {
  if (!name) return
  await pool.query(`UPDATE sessions SET name = $1 WHERE id = $2`, [name, sessionId])
}

async function getSession(sessionId) {
  const { rows } = await pool.query(`SELECT id, name, created_at FROM sessions WHERE id = $1`, [sessionId])
  return rows[0] || null
}

module.exports = { touchSession, setSessionName, getSession }
