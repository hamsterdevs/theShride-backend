const crypto = require('crypto')
const { addSignup, listSignups } = require('../db/waitlist')

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isAuthorized(authorizationHeader) {
  const match = /^Bearer (.+)$/.exec(authorizationHeader || '')
  const providedToken = match?.[1]
  const expectedToken = process.env.WAITLIST_EXPORT_KEY
  if (!providedToken || !expectedToken) return false

  const providedBuffer = Buffer.from(providedToken)
  const expectedBuffer = Buffer.from(expectedToken)
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

async function joinWaitlist(request, response, next) {
  const { email, source } = request.body || {}
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!emailPattern.test(normalizedEmail)) {
    return response.status(400).json({ error: 'Provide a valid email address.' })
  }
  if (source !== undefined && typeof source !== 'string') {
    return response.status(400).json({ error: 'source must be a string when provided.' })
  }

  try {
    const inserted = await addSignup(normalizedEmail, source?.trim(), request.sessionId)
    return response.status(200).json({ joined: true, alreadyOnList: !inserted })
  } catch (error) {
    return next(error)
  }
}

async function exportSignups(request, response, next) {
  if (!isAuthorized(request.get('Authorization'))) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const signups = await listSignups()
    return response.json(signups)
  } catch (error) {
    return next(error)
  }
}

module.exports = { joinWaitlist, exportSignups }