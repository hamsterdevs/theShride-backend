const { getSession } = require('../db/sessions')
const { getToken } = require('../db/tokens')
const { getResume } = require('../db/resumes')

async function getCurrentSession(request, response, next) {
  try {
    const [session, token, resume] = await Promise.all([
      getSession(request.sessionId),
      getToken(request.sessionId),
      getResume(request.sessionId),
    ])

    response.json({
      sessionId: request.sessionId,
      name: session?.name || null,
      googleConnected: Boolean(token),
      googleEmail: token?.email || null,
      resumeUploaded: Boolean(resume),
      resumeFileName: resume?.file_name || null,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = { getCurrentSession }
