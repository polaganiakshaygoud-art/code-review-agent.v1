const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function generateSolutionFromGroq(errorLog) {
  if (!process.env.GROQ_API_KEY) {
    return "No Groq API key set. Add GROQ_API_KEY in backend/.env to enable AI responses.";
  }

  const prompt = `
You are an incident response assistant.
Given an error log, provide:
1) likely root cause
2) step-by-step fix
3) prevention tip

Error log:
${errorLog}
  `.trim();

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No solution returned by Groq.";
}
