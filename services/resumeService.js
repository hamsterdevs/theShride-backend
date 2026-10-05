const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { GoogleGenAI, Type } = require("@google/genai");

// Per-session PDF storage now lives in db/resumes.js (see resumeController.js and
// applicationService.js), so this file is purely about text extraction + Gemini parsing.

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

async function parseResume(file) {
  if (!process.env.GEMINI_API_KEY)
    throw new Error("Gemini is not configured. Set GEMINI_API_KEY.");

  const resumeText = await extractResumeText(file);
  if (!resumeText)
    throw new Error("No readable text was found in the uploaded resume.");

  const modelName = `models/${(process.env.GEMINI_MODEL || "gemini-3.6-flash")
    .trim()
    .replace(/^models\//, "")}`;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: modelName,
    contents: resumeText,
    config: {
      systemInstruction: `Extract candidate details from this resume into JSON: { name, email, phone, title, skills: [], summary, yearsOfExperience }.

Strictly extract only facts explicitly stated in the resume text. Do NOT assume or infer any fields. If phone or email is not explicitly written in the resume text, set its value to null. If no explicit "Summary" section exists in the text, synthesize a concise 2-3 sentence professional summary based directly on the candidate's listed WORK EXPERIENCE, education, and skills. Do NOT invent outside details or companies. Calculate total experience by summing the duration of roles listed in WORK EXPERIENCE up to the current year (2026). Format yearsOfExperience as a string with a plus sign, for example "2+ Years" or "1+ Years". For instance, Jul 2025 to Present plus Feb 2026 to Present spans 2025-2026 and should total "1+ Years" or "2+ Years". If no work dates exist, return "N/A". Do NOT return a plain number for yearsOfExperience.`,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, nullable: true },
          email: { type: Type.STRING, nullable: true },
          phone: { type: Type.STRING, nullable: true },
          title: { type: Type.STRING, nullable: true },
          skills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            nullable: true,
          },
          summary: { type: Type.STRING },
          yearsOfExperience: { type: Type.STRING },
        },
        required: [
          "name",
          "email",
          "phone",
          "title",
          "skills",
          "summary",
          "yearsOfExperience",
        ],
        additionalProperties: false,
      },
    },
  });

  return JSON.parse(response.text);
}

module.exports = { extractResumeText, parseResume };
