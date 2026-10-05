const { GoogleGenAI } = require('@google/genai')

async function generateCoverLetter({ jobUrl, jobDescription, candidateProfile, applyTarget }) {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('Gemini is not configured. Set GEMINI_API_KEY.')
    error.status = 503
    throw error
  }

  const modelName = `models/${(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim().replace(/^models\//, '')}`
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Create a tailored, professional three-paragraph cover letter. Return only JSON matching the schema.\n\nCandidate profile:\n${JSON.stringify(candidateProfile)}\n\nJob URL: ${jobUrl}\n\nJob description:\n${jobDescription}\n\nTarget platform: ${applyTarget}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { coverLetter: { type: 'STRING' } },
        required: ['coverLetter'],
      },
    },
  })

  const content = JSON.parse(response.text)
  if (!content.coverLetter) throw new Error('Gemini returned no cover letter content.')
  return content.coverLetter
}

module.exports = { generateCoverLetter }