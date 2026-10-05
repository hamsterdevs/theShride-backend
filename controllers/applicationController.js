const { draftApplicationEmail, sendApplicationEmail } = require('../services/applicationService')

async function draftApplication(request, response, next) {
  const { profile, jobDetails, customTone } = request.body || {}
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return response.status(400).json({ error: 'Provide a profile object.' })
  }
  if (!jobDetails || typeof jobDetails !== 'object' || Array.isArray(jobDetails)) {
    return response.status(400).json({ error: 'Provide a jobDetails object.' })
  }
  if (customTone !== undefined && typeof customTone !== 'string') {
    return response.status(400).json({ error: 'customTone must be a string when provided.' })
  }

  try {
    const draft = await draftApplicationEmail({ profile, jobDetails, customTone })
    return response.status(200).json(draft)
  } catch (error) {
    console.error(`[applications] Unable to draft application email: ${error.message}`)
    return next(error)
  }
}

async function sendApplication(request, response, next) {
  const { to, subject, body, pdfBase64 } = request.body || {}
  if (typeof to !== 'string' || !to.trim()) return response.status(400).json({ error: 'Provide a recipient email address.' })
  if (typeof subject !== 'string' || !subject.trim()) return response.status(400).json({ error: 'Provide an email subject.' })
  if (typeof body !== 'string' || !body.trim()) return response.status(400).json({ error: 'Provide an email body.' })

  try {
    const result = await sendApplicationEmail({ sessionId: request.sessionId, to, subject, body, pdfBase64 })
    return response.status(200).json(result)
  } catch (error) {
    console.error(`[applications] Unable to send application email: ${error.message}`)
    return next(error)
  }
}

module.exports = { draftApplication, sendApplication }
