const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { GoogleGenAI, Type } = require("@google/genai");

async function extractResumeText(file) {
  if (
    file.mimetype === "application/pdf" ||
    /\.pdf$/i.test(file.originalname)
  ) {
    const { text } = await pdfParse(file.buffer);
    const extractedText = text.trim();
    console.log("--- EXTRACTED RESUME TEXT START ---");
    console.log(extractedText);
    console.log("--- EXTRACTED RESUME TEXT END ---");
    return extractedText;
  }

  const { value } = await mammoth.extractRawText({ buffer: file.buffer });
  return value.trim();
}

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
          content: `You are a precise JSON extractor. Output valid JSON matching this schema structure: ${JSON.stringify(jsonSchema)}`,
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

async function parseResume(file) {
  if (!process.env.GEMINI_API_KEY && !(process.env.GROQ_API_KEY || process.env.ROQ_API_KEY)) {
    throw new Error("No AI providers configured. Set GEMINI_API_KEY or GROQ_API_KEY.");
  }

  const resumeText = await extractResumeText(file);
  if (!resumeText) {
    throw new Error("No readable text was found in the uploaded resume.");
  }

  const systemInstruction = `Extract candidate details from this resume into JSON: { name, email, phone, title, skills: [], summary, yearsOfExperience }.

Strictly extract only facts explicitly stated in the resume text. Do NOT assume or infer any fields. If phone or email is not explicitly written in the resume text, set its value to null. If no explicit "Summary" section exists in the text, synthesize a concise 2-3 sentence professional summary based directly on the candidate's listed WORK EXPERIENCE, education, and skills. Do NOT invent outside details or companies. Calculate total experience by summing the duration of roles listed in WORK EXPERIENCE up to the current year (2026). Format yearsOfExperience as a string with a plus sign, for example "2+ Years" or "1+ Years". For instance, Jul 2025 to Present plus Feb 2026 to Present spans 2025-2026 and should total "1+ Years" or "2+ Years". If no work dates exist, return "N/A". Do NOT return a plain number for yearsOfExperience.`;

  const jsonSchema = {
    type: "object",
    properties: {
      name: { type: "string", nullable: true },
      email: { type: "string", nullable: true },
      phone: { type: "string", nullable: true },
      title: { type: "string", nullable: true },
      skills: { type: "array", items: { type: "string" }, nullable: true },
      summary: { type: "string" },
      yearsOfExperience: { type: "string" },
    },
    required: ["name", "email", "phone", "title", "skills", "summary", "yearsOfExperience"],
  };

  // 1. Attempt Gemini First
  if (process.env.GEMINI_API_KEY) {
    const primaryModel = `models/${(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim().replace(/^models\//, "")}`;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
      const response = await ai.models.generateContent({
        model: primaryModel,
        contents: resumeText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, nullable: true },
              email: { type: Type.STRING, nullable: true },
              phone: { type: Type.STRING, nullable: true },
              title: { type: Type.STRING, nullable: true },
              skills: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
              summary: { type: Type.STRING },
              yearsOfExperience: { type: Type.STRING },
            },
            required: ["name", "email", "phone", "title", "skills", "summary", "yearsOfExperience"],
            additionalProperties: false,
          },
        },
      });
      return JSON.parse(response.text);
    } catch (err) {
      console.warn(`[ResumeService] Gemini failed (${err.message}). Trying Groq fallback...`);
    }
  }

  // 2. Fallback to Groq
  const fullPrompt = `${systemInstruction}\n\nResume Text:\n${resumeText}`;
  return await parseWithGroq(fullPrompt, jsonSchema);
}

module.exports = { extractResumeText, parseResume };