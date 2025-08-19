// backend/llm.js
require('dotenv').config()
const OpenAI = require('openai')
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function buildPrompt(text, params) {
  // params: { totalQuestions, difficultySplit, types: {mcq: n, tf: n, fill: n}, timePerQ }
  const { totalQuestions, types, difficultySplit, timePerQ } = params
  return `
You are a quiz generator. Use only the content from the notes below to make a quiz.

Notes:
${text.slice(0, 20000)}

Parameters:
- Total questions: ${totalQuestions}
- Types and counts: ${JSON.stringify(types)}
- Difficulty splits: ${JSON.stringify(difficultySplit)}
- Time per question (seconds): ${timePerQ}

Requirements:
1. For MCQs provide exactly 4 options and indicate the correct option index (0-3).
2. For True/False give the statement and the correct boolean.
3. For Fill-in-the-blank provide the sentence with a blank like "The ____ is ..." and the correct phrase.
4. Label each question with difficulty (Easy/Medium/Hard).
5. Output JSON only with fields: quiz (array), summary (string).
Example item:
{
 "type":"MCQ",
 "difficulty":"Easy",
 "question":"...?",
 "options":["a","b","c","d"],
 "correct": 1
}

Return only JSON.
`
}

async function generateQuiz(text, params) {
  const prompt = buildPrompt(text, params)
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini", // change to available model if needed
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500
  })
  const raw = resp.choices?.[0]?.message?.content || ''
  // try parse JSON
  try {
    return JSON.parse(raw)
  } catch (e) {
    // fallback: try to extract first JSON substring
    const match = raw.match(/\{[\s\S]*\}$/)
    if (match) return JSON.parse(match[0])
    throw new Error("LLM returned non-JSON response: " + raw.slice(0,500))
  }
}

module.exports = { generateQuiz }
