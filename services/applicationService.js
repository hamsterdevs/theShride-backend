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

async function parseWithGroq(prompt, jsonSchema) {
  const apiKey = process.env.GROQ_API_KEY || process.env.ROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured in environment variables.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a professional application writer. Output valid JSON matching this schema: ${JSON.stringify(jsonSchema)}`,
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function draftApplicationEmail({ profile, jobDetails, customTone }) {
  const systemInstruction = 'Compare the candidate profile skills, title, and summary against the job title, key requirements, and company. Generate a concise, impactful professional application email aligned directly to the listed requirements. Do not invent experience, qualifications, employers, or recipient details that are not provided. Return a subject and body. Use the provided recipientEmail exactly when present; otherwise return null.'
  const prompt = `Candidate profile:\n${JSON.stringify(profile)}\n\nJob details:\n${JSON.stringify(jobDetails)}\n\nRequested tone:\n${customTone || 'professional'}`

  const jsonSchema = {
    type: "object",
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
      recipientEmail: { type: "string", nullable: true },
    },
    required: ['subject', 'body', 'recipientEmail'],
  }

  try {
    return await parseWithGroq(`${systemInstruction}\n\n${prompt}`, jsonSchema)
  } catch (error) {
    console.warn(`[ApplicationService] Groq failed (${error.message}). Returning template fallback...`)
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