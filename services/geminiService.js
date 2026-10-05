async function generateCoverLetter({ jobUrl, jobDescription, candidateProfile, applyTarget }) {
  const apiKey = process.env.GROQ_API_KEY || process.env.ROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured in environment variables.");
  }

  const prompt = `Create a tailored, professional three-paragraph cover letter. Return only JSON matching: {"coverLetter": "string"}\n\nCandidate profile:\n${JSON.stringify(candidateProfile)}\n\nJob URL: ${jobUrl}\n\nJob description:\n${jobDescription}\n\nTarget platform: ${applyTarget}`;

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
          content: 'You are a professional cover letter generator. Output valid JSON format: {"coverLetter": "string"}',
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
  if (!content.coverLetter) throw new Error("Groq returned no cover letter content.");
  return content.coverLetter;
}

module.exports = { generateCoverLetter };