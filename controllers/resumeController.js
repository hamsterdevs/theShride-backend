const { parseResume } = require('../services/resumeService')
const { saveResume } = require('../db/resumes')
const { setSessionName } = require('../db/sessions')

async function parseResumeUpload(request, response, next) {
  if (!request.file) return response.status(400).json({ error: 'Attach a PDF or DOCX resume using the "resume" form field.' })

  try {
    console.info(`[resume] Parsing ${request.file.originalname}.`)
    const parsedResume = await parseResume(request.file)

    // One row per session: a new upload (PDF or DOCX) just overwrites the old one,
    // so there's no separate "delete the old PDF on a DOCX upload" step anymore.
    await saveResume(request.sessionId, {
      fileName: request.file.originalname,
      mimeType: request.file.mimetype,
      fileData: request.file.buffer,
      parsedProfile: parsedResume,
    })
    if (parsedResume.name) await setSessionName(request.sessionId, parsedResume.name)

    return response.status(200).json({
      fileName: request.file.originalname,
      parsedAt: new Date().toISOString(),
      ...parsedResume,
    })
  } catch (error) {
    console.error(`[resume] Unable to parse ${request.file.originalname}: ${error.message}`)
    return response.status(500).json({ error: 'Unable to parse the uploaded resume.' })
  }
}

module.exports = { parseResume: parseResumeUpload }