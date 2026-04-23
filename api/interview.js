import Groq from "groq-sdk";

async function callGroqWithFallback(messages) {
    const keys = [
        process.env.GROQ_1, process.env.GROQ_2, process.env.GROQ_3,
        process.env.GROQ_4, process.env.GROQ_5
    ].filter(key => key && key.trim() !== '');

    if (keys.length === 0) throw new Error("No Groq API keys found.");

    let lastError = null;
    for (let i = 0; i < keys.length; i++) {
        try {
            const groq = new Groq({ apiKey: keys[i] });
            const completion = await groq.chat.completions.create({
                messages: messages,
                model: "llama-3.3-70b-versatile",
                temperature: 0.2,
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error(`Key GROQ_${i + 1} Failed:`, error.message);
            lastError = error;
        }
    }
    throw new Error("All API keys failed. Last error: " + lastError.message);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed.' });

    const { action, role, exp, lang, qty, question, answer } = req.body;

    try {
        if (action === 'generate') {
            // 🚀 پرامپٹ میں 'JSON' کا لفظ بار بار اور واضح کر دیا ہے
            const prompt = `You are a professional HR Manager. 
            You MUST return the output in JSON format.
            Generate exactly ${qty} interview questions for a "${role}" with "${exp}" experience.
            Rules: Use ${lang}. NO Hindi/Cyrillic.
            Format: Return ONLY a JSON object with this structure: { "questions": ["Q1", "Q2"] }`;

            const result = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json({ questions: result.questions });
        }

        if (action === 'evaluate') {
            // 🚀 یہاں بھی 'JSON' کو واضح کر دیا ہے
            const prompt = `You are a professional HR Manager. 
            You MUST return the output in JSON format.
            Evaluate this: 
            Question: "${question}"
            Answer: "${answer}"
            Language: ${lang}
            
            Rules: Use pure ${lang}. NO foreign script.
            Return ONLY a JSON object with this structure:
            {
                "status": "correct", "incorrect", or "improve",
                "feedback": "2 lines feedback in pure ${lang}",
                "correct_answer": "Model answer in pure ${lang}"
            }`;

            const evaluation = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json(evaluation);
        }

        return res.status(400).json({ error: 'Invalid action.' });

    } catch (error) {
        return res.status(500).json({ error: "Backend Error: " + error.message });
    }
}
