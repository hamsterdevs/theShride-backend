const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

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
      model: "openai/gpt-oss-120b",
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

async function parseResume(file) {
  const resumeText = await extractResumeText(file);
  if (!resumeText) {
    throw new Error("No readable text was found in the uploaded resume.");
  }

  const systemInstruction = `Extract candidate details from this resume into JSON: { name, email, phone, title, skills: [], summary, yearsOfExperience }.

Strictly extract only facts explicitly stated in the resume text. Do NOT assume or infer any fields. If phone or email is not explicitly written in the resume text, set its value to null. If no explicit "Summary" section exists in the text, synthesize a concise 2-3 sentence professional summary based directly on the candidate's listed WORK EXPERIENCE, education, and skills. Do NOT invent outside details or companies. Calculate total experience by summing the duration of roles listed in WORK EXPERIENCE up to the current year (2026). Format yearsOfExperience as a string with a plus sign, for example "2+ Years" or "1+ Years". If no work dates exist, return "N/A". Do NOT return a plain number for yearsOfExperience.`;

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

  const fullPrompt = `${systemInstruction}\n\nResume Text:\n${resumeText}`;
  return await parseWithGroq(fullPrompt, jsonSchema);
}

module.exports = { extractResumeText, parseResume };