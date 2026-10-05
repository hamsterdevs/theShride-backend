const { google } = require('googleapis')
const { saveToken, getToken } = require('../db/tokens')

// Bare client: client_id/secret/redirect only, no credentials attached.
// Used for generating the consent URL and for exchanging the auth code.
function getGoogleOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    const error = new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.')
    error.status = 503
    throw error
  }

  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
}

// Client with this session's refresh token attached. Used wherever we actually
// need to call a Google API on the user's behalf (e.g. sending Gmail).
// async now: the token lookup is a Postgres query, not a synchronous file read.
async function getAuthorizedClientForSession(sessionId) {
  const row = await getToken(sessionId)
  if (!row) {
    const error = new Error('Google account is not connected for this session.')
    error.status = 401
    throw error
  }

  const oauthClient = getGoogleOAuthClient()
  oauthClient.setCredentials({ refresh_token: row.refresh_token })
  return oauthClient
}

async function saveRefreshToken(sessionId, refreshToken, email) {
  await saveToken(sessionId, refreshToken, email)
}

module.exports = { getGoogleOAuthClient, getAuthorizedClientForSession, google, saveRefreshToken }