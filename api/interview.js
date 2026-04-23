import Groq from "groq-sdk";

// Helper function to cycle through keys
async function callGroqWithFallback(messages) {
    const keys = [
        process.env.GROQ_1, process.env.GROQ_2, process.env.GROQ_3,
        process.env.GROQ_4, process.env.GROQ_5
    ].filter(key => key && key.trim() !== '');

    if (keys.length === 0) throw new Error("No API keys configured.");

    for (let i = 0; i < keys.length; i++) {
        try {
            const groq = new Groq({ apiKey: keys[i] });
            const completion = await groq.chat.completions.create({
                messages: messages,
                model: "llama-3.3-70b-versatile",
                temperature: 0.1, // بہت کم تاکہ AI کوئی غلطی نہ کرے
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error(`Key ${i+1} failed:`, error.message);
        }
    }
    throw new Error("All API keys failed.");
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { action, role, exp, lang, qty, question, answer } = req.body;

    try {
        if (action === 'generate') {
            const prompt = `System: You are an expert HR. Output MUST be valid JSON.
            Task: Generate ${qty} interview questions for "${role}" (${exp}).
            Language: ${lang}.
            Rules: Use PURE ${lang}. No mix of other languages.
            Output JSON Format: { "questions": ["Q1", "Q2"] }`;

            const result = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json({ questions: result.questions });
        }

        if (action === 'evaluate') {
            const prompt = `System: You are an expert HR. Output MUST be valid JSON.
            Evaluate the answer: "${answer}" for question "${question}".
            Rules:
            1. If answer is professional and accurate, status="correct".
            2. If answer is vague or lacks professional terminology, status="improve".
            3. If answer is wrong/irrelevant, status="incorrect".
            Language: PURE ${lang}. No other languages.
            Output JSON Format: { "status": "correct|incorrect|improve", "feedback": "2 lines feedback", "correct_answer": "Model answer" }`;

            const evaluation = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json(evaluation);
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
