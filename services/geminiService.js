const { GoogleGenAI } = require('@google/genai')

async function parseWithGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY || process.env.ROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");

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
          content: 'You are a professional cover letter generator. Output JSON format: {"coverLetter": "string"}',
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
  const content = JSON.parse(data.choices[0].message.content);
  return content.coverLetter;
}

async function generateCoverLetter({ jobUrl, jobDescription, candidateProfile, applyTarget }) {
  if (!process.env.GEMINI_API_KEY && !(process.env.GROQ_API_KEY || process.env.ROQ_API_KEY)) {
    const error = new Error('No AI providers configured. Set GEMINI_API_KEY or GROQ_API_KEY.')
    error.status = 503
    throw error
  }

  const prompt = `Create a tailored, professional three-paragraph cover letter. Return only JSON matching: {"coverLetter": "string"}\n\nCandidate profile:\n${JSON.stringify(candidateProfile)}\n\nJob URL: ${jobUrl}\n\nJob description:\n${jobDescription}\n\nTarget platform: ${applyTarget}`

  // 1. Attempt Gemini First
  if (process.env.GEMINI_API_KEY) {
    try {
      const modelName = `models/${(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim().replace(/^models\//, '')}`
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
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
      if (content.coverLetter) return content.coverLetter
    } catch (err) {
      console.warn(`[GeminiService] Gemini failed (${err.message}). Trying Groq fallback...`)
    }
  }

  // 2. Fallback to Groq
  return await parseWithGroq(prompt);
}

module.exports = { generateCoverLetter }