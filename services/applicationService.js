const { GoogleGenAI, Type } = require('@google/genai')
const { getAuthorizedClientForSession, google } = require('../config/googleOAuth')
const { getResume } = require('../db/resumes')

async function getResumeAttachment(sessionId, pdfBase64) {
  if (!pdfBase64) {
    const saved = await getResume(sessionId)
    if (saved?.file_data) return { fileName: saved.file_name || 'resume.pdf', data: saved.file_data }

    const error = new Error('Provide pdfBase64 or upload a resume before sending an application.')
    error.status = 400
    throw error
  }

  if (typeof pdfBase64 !== 'string') {
    const error = new Error('pdfBase64 must be a base64-encoded PDF string.')
    error.status = 400
    throw error
  }

  const base64Content = pdfBase64.replace(/^data:application\/pdf;base64,/i, '').replace(/\s/g, '')
  if (!base64Content) {
    const error = new Error('pdfBase64 must contain PDF content.')
    error.status = 400
    throw error
  }

  return { fileName: 'resume.pdf', data: Buffer.from(base64Content, 'base64') }
}

function sanitizeHeader(value) {
  return value.replace(/[\r\n]/g, ' ').trim()
}

async function sendApplicationEmail({ sessionId, to, subject, body, pdfBase64 }) {
  const attachment = await getResumeAttachment(sessionId, pdfBase64)
  const attachmentName = sanitizeHeader(attachment.fileName)
  const boundary = `application-${Date.now()}`
  const rawMime = [
    'From: me',
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${sanitizeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${attachmentName}"`,
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    attachment.data.toString('base64'),
    `--${boundary}--`,
    '',
  ].join('\r\n')
  const encodedMessage = Buffer.from(rawMime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const gmail = google.gmail({ version: 'v1', auth: await getAuthorizedClientForSession(sessionId) })
  const response = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } })
  return { success: true, messageId: response.data.id }
}

async function draftApplicationEmail({ profile, jobDetails, customTone }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini is not configured. Set GEMINI_API_KEY.')

  try {
    const modelName = `models/${(process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim().replace(/^models\//, '')}`
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Candidate profile:\n${JSON.stringify(profile)}\n\nJob details:\n${JSON.stringify(jobDetails)}\n\nRequested tone:\n${customTone || 'professional'}`,
      config: {
        systemInstruction: 'Compare the candidate profile skills, title, and summary against the job title, key requirements, and company. Generate a concise, impactful professional application email aligned directly to the listed requirements. Do not invent experience, qualifications, employers, or recipient details that are not provided. Return a subject and body. Use the provided recipientEmail exactly when present; otherwise return null.',
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
            recipientEmail: { type: Type.STRING, nullable: true },
          },
          required: ['subject', 'body', 'recipientEmail'],
          additionalProperties: false,
        },
      },
    })

    return JSON.parse(response.text)
  } catch (error) {
    const isRateLimited = error.status === 429 || error.code === 429 || error.code === 'RESOURCE_EXHAUSTED' || error.message?.includes('RESOURCE_EXHAUSTED')
    if (!isRateLimited) throw error

    const skills = Array.isArray(profile.skills) ? profile.skills : []
    const fallbackSubject = `Application for ${jobDetails.jobTitle || 'Role'} - ${profile.name || 'Candidate'}`
    const fallbackBody = `Dear Hiring Manager,\n\nI am writing to express my interest in the ${jobDetails.jobTitle || 'Role'} position at ${jobDetails.companyOrIndustry || 'your company'}.\n\nWith experience as a ${profile.title || 'professional'} and a strong background in ${skills.slice(0, 5).join(', ')}, I am confident in my ability to contribute effectively to your team.\n\nSummary of Qualifications:\n${profile.summary || 'N/A'}\n\nThank you for considering my application. I look forward to the opportunity to discuss my experience further.\n\nBest regards,\n${profile.name || 'Candidate'}\n${profile.email || 'N/A'} | ${profile.phone || 'N/A'}`

    return {
      subject: fallbackSubject,
      body: fallbackBody,
      recipientEmail: jobDetails.recipientEmail || null,
      isFallback: true,
    }
  }
}

module.exports = { draftApplicationEmail, sendApplicationEmail }
