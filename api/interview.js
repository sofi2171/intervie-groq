import Groq from "groq-sdk";

async function callGroqWithFallback(messages) {
    const keys = [
        process.env.GROQ_1, process.env.GROQ_2, process.env.GROQ_3,
        process.env.GROQ_4, process.env.GROQ_5
    ].filter(key => key && key.trim() !== '');

    if (keys.length === 0) throw new Error("No API keys found.");

    for (let i = 0; i < keys.length; i++) {
        try {
            const groq = new Groq({ apiKey: keys[i] });
            const completion = await groq.chat.completions.create({
                messages: messages,
                model: "llama-3.3-70b-versatile",
                temperature: 0.1,
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

    const { action, name, role, exp, lang, qty, question, answer } = req.body;

    try {
        if (action === 'generate') {
            const prompt = `System: You are an expert HR Manager. Output MUST be valid JSON.
            Task: Start by professionally greeting ${name} and acknowledging their interest in the "${role}" role. Then, generate exactly ${qty} interview questions.
            Language: ${lang}. 
            STRICT RULES:
            - If "Urdu": Use pure Urdu Arabic script. 
            - If "Roman Urdu": Use English A-Z, Pakistani conversational style (e.g., 'sehat', 'mareez').
            - ABSOLUTELY NO mixed scripts (Chinese, Russian, Hindi). If you use a non-target script, the evaluation is a failure.
            Format: { "greeting": "Professional welcome message in ${lang}", "questions": ["Q1", "Q2", ...] }`;

            const result = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json(result);
        }

        if (action === 'evaluate') {
            const prompt = `System: You are an expert HR Manager. Output MUST be valid JSON.
            Task: Evaluate the answer: "${answer}" for the question: "${question}".
            Rules:
            1. If the answer is accurate, factually correct, and professional, status="correct".
            2. If the answer is partially incomplete but has the right idea, status="improve".
            3. If the answer is wrong or harmful, status="incorrect".
            Language: Pure ${lang}. No foreign scripts. Use ONLY target language.
            Format: { "status": "correct|incorrect|improve", "feedback": "2 lines of direct feedback in ${lang}", "correct_answer": "Model professional answer in ${lang}" }`;

            const evaluation = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json(evaluation);
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
