const { clientOrigin } = require('../config/environment')
const { getGoogleOAuthClient, google, saveRefreshToken } = require('../config/googleOAuth')

function getAuthUrl(request, response, next) {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.info('[oauth] Google client ID is unavailable. Returning mock consent URL.')
      // Was hardcoded to localhost:5174 regardless of environment — now reads the real config.
      return response.json({ url: `${clientOrigin}?google_connected=true`, mock: true })
    }
    const authorizationUrl = getGoogleOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.send',
      ],
      // Carries the guest session through Google's redirect, since the callback
      // is a real browser navigation and can't carry our X-Session-Id header.
      state: request.sessionId,
    })
    console.info('[oauth] Generated Google consent URL.')
    return response.json({ url: authorizationUrl })
  } catch (error) {
    return next(error)
  }
}

async function handleCallback(request, response, next) {
  const { code, state: sessionId } = request.query
  if (!code) return response.status(400).json({ error: 'Missing Google OAuth authorization code.' })
  if (!sessionId) return response.status(400).json({ error: 'Missing session state on Google OAuth callback.' })

  try {
    const oauthClient = getGoogleOAuthClient()
    const { tokens } = await oauthClient.getToken(code)
    oauthClient.setCredentials(tokens)
    const { data: profile } = await google.oauth2({ version: 'v2', auth: oauthClient }).userinfo.get()
    await saveRefreshToken(sessionId, tokens.refresh_token, profile.email)
    console.info(`[oauth] Google account connected for ${profile.email || 'authenticated user'}.`)
    return response.redirect(`${clientOrigin}?google_connected=true`)
  } catch (error) {
    return next(error)
  }
}

module.exports = { getAuthUrl, handleCallback }