const { GoogleGenAI, Type } = require('@google/genai')

async function parseWithGroq(prompt, jsonSchema) {
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
          content: `You are a precise JSON extractor. Output valid JSON matching this schema: ${JSON.stringify(jsonSchema)}`,
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

async function parseJobDescription(rawText) {
  if (!process.env.GEMINI_API_KEY && !(process.env.GROQ_API_KEY || process.env.ROQ_API_KEY)) {
    throw new Error('No AI providers configured. Set GEMINI_API_KEY or GROQ_API_KEY.')
  }

  const systemInstruction = 'Extract job parameters strictly from the provided text. Look specifically for application email addresses, for example janeokorie.hr@gmail.com. If an email or field is not explicitly present, set its value to null. Do not invent details.'

  const jsonSchema = {
    type: "object",
    properties: {
      jobTitle: { type: "string", nullable: true },
      companyOrIndustry: { type: "string", nullable: true },
      recipientEmail: { type: "string", nullable: true },
      location: { type: "string", nullable: true },
      remuneration: { type: "string", nullable: true },
      employmentType: { type: "string", nullable: true },
      keyRequirements: { type: "array", items: { type: "string" } },
    },
    required: ['jobTitle', 'companyOrIndustry', 'recipientEmail', 'location', 'remuneration', 'employmentType', 'keyRequirements'],
  };

  // 1. Attempt Gemini First
  if (process.env.GEMINI_API_KEY) {
    try {
      const modelName = `models/${(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim().replace(/^models\//, '')}`
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
      const response = await ai.models.generateContent({
        model: modelName,
        contents: rawText,
        config: {
          systemInstruction,
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
    } catch (err) {
      console.warn(`[JobService] Gemini failed (${err.message}). Trying Groq fallback...`);
    }
  }

  // 2. Fallback to Groq
  const fullPrompt = `${systemInstruction}\n\nJob Text:\n${rawText}`;
  return await parseWithGroq(fullPrompt, jsonSchema);
}

module.exports = { parseJobDescription }