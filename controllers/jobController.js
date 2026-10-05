const { parseJobDescription } = require('../services/jobService')

async function parseJob(request, response, next) {
  const { rawText = '' } = request.body || {}
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return response.status(400).json({ error: 'Provide a non-empty rawText value.' })
  }

  try {
    const job = await parseJobDescription(rawText.trim())
    return response.status(200).json(job)
  } catch (error) {
    console.error(`[jobs] Unable to parse job description: ${error.message}`)
    return next(error)
  }
}

module.exports = { parseJob }
