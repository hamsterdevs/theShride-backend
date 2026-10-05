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

async function parseResume(file) {
  if (!process.env.GEMINI_API_KEY)
    throw new Error("Gemini is not configured. Set GEMINI_API_KEY.");

  const resumeText = await extractResumeText(file);
  if (!resumeText)
    throw new Error("No readable text was found in the uploaded resume.");

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Primary model and active stable fallback model
  const primaryModel = `models/${(process.env.GEMINI_MODEL || "gemini-2.5-flash")
    .trim()
    .replace(/^models\//, "")}`;
  const fallbackModel = "models/gemini-1.5-flash";

  const config = {
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
  };

  // Helper function to handle execution with exponential backoff on 503
  async function generateWithRetry(modelToUse, retries = 2, delay = 1500) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await ai.models.generateContent({
          model: modelToUse,
          contents: resumeText,
          config,
        });
      } catch (err) {
        const is503 =
          err.status === 503 ||
          err.code === 503 ||
          (err.message && err.message.includes("503")) ||
          (err.message && err.message.includes("UNAVAILABLE"));

        if (is503 && attempt < retries) {
          console.warn(
            `[Gemini] ${modelToUse} 503 overloaded. Retrying in ${delay}ms (Attempt ${attempt}/${retries})...`
          );
          await new Promise((res) => setTimeout(res, delay));
          delay *= 2;
        } else {
          throw err;
        }
      }
    }
  }

  let response;
  try {
    // 1. Try Primary Model (gemini-2.5-flash) with retry
    response = await generateWithRetry(primaryModel);
  } catch (err) {
    const is503 =
      err.status === 503 ||
      err.code === 503 ||
      (err.message && err.message.includes("503")) ||
      (err.message && err.message.includes("UNAVAILABLE"));

    if (is503) {
      console.warn(
        `[Gemini] Primary model (${primaryModel}) failed with 503. Switching to fallback (${fallbackModel})...`
      );
      // 2. Fall back to gemini-1.5-flash if Primary fails completely
      response = await generateWithRetry(fallbackModel);
    } else {
      throw err;
    }
  }

  return JSON.parse(response.text);
}

module.exports = { extractResumeText, parseResume };