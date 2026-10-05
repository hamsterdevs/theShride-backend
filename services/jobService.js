const { GoogleGenAI, Type } = require('@google/genai')

async function parseJobDescription(rawText) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini is not configured. Set GEMINI_API_KEY.')

  const modelName = `models/${(process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim().replace(/^models\//, '')}`
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const response = await ai.models.generateContent({
    model: modelName,
    contents: rawText,
    config: {
      systemInstruction: 'Extract job parameters strictly from the provided text. Look specifically for application email addresses, for example janeokorie.hr@gmail.com. If an email or field is not explicitly present, set its value to null. Do not invent details.',
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          jobTitle: { type: Type.STRING, nullable: true },
          companyOrIndustry: { type: Type.STRING, nullable: true },
          recipientEmail: { type: Type.STRING, nullable: true },
          location: { type: Type.STRING, nullable: true },
          remuneration: { type: Type.STRING, nullable: true },
          employmentType: { type: Type.STRING, nullable: true },
          keyRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['jobTitle', 'companyOrIndustry', 'recipientEmail', 'location', 'remuneration', 'employmentType', 'keyRequirements'],
        additionalProperties: false,
      },
    },
  })

  return JSON.parse(response.text)
}

module.exports = { parseJobDescription }
