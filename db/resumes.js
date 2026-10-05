const { pool } = require('./index')

async function saveResume(sessionId, { fileName, mimeType, fileData, parsedProfile }) {
  await pool.query(
    `INSERT INTO resumes (session_id, file_name, mime_type, file_data, parsed_profile)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id) DO UPDATE SET
       file_name = EXCLUDED.file_name,
       mime_type = EXCLUDED.mime_type,
       file_data = EXCLUDED.file_data,
       parsed_profile = EXCLUDED.parsed_profile,
       uploaded_at = NOW()`,
    [sessionId, fileName || null, mimeType || null, fileData, JSON.stringify(parsedProfile || {})]
  )
}

async function getResume(sessionId) {
  const { rows } = await pool.query(
    `SELECT file_name, mime_type, file_data, parsed_profile, uploaded_at FROM resumes WHERE session_id = $1`,
    [sessionId]
  )
  if (!rows[0]) return null
  return { ...rows[0], parsedProfile: JSON.parse(rows[0].parsed_profile || '{}') }
}

module.exports = { saveResume, getResume }
