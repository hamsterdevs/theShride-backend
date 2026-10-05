const { generateCoverLetter } = require('../services/geminiService')
const { executePlaywrightApplication } = require('../services/playwrightService')

async function generateAndApply(request, response, next) {
  const { jobUrl = '', jobDescription = '', candidateProfile, applyTarget = 'Auto-Detect' } = request.body || {}
  if (!jobUrl.trim() && !jobDescription.trim()) return response.status(400).json({ error: 'Provide a jobUrl or jobDescription.' })
  if (!candidateProfile || typeof candidateProfile !== 'object') return response.status(400).json({ error: 'Provide a candidateProfile object.' })

  try {
    console.info('[pipeline] Generating tailored cover letter with Gemini.')
    const coverLetter = await generateCoverLetter({ jobUrl, jobDescription, candidateProfile, applyTarget })
    console.info('[pipeline] Cover letter generated. Starting browser automation stub.')
    const automation = await executePlaywrightApplication({ jobUrl, applyTarget, candidateProfile })
    console.info('[pipeline] Application pipeline completed successfully.')
    return response.status(200).json({ coverLetter, automation })
  } catch (error) {
    return next(error)
  }
}

module.exports = { generateAndApply }