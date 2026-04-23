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
                temperature: 0.2, // 🚀 CRITICAL FIX: یہ AI کو کنفیوز ہونے اور دوسری زبانیں مکس کرنے سے روکے گا!
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

    if (req.method === 'GET') {
        return res.status(200).send(`
            <html><body style="text-align: center; padding-top: 50px; color: #166534;">
            <h1>✅ System is Live & Fixed!</h1></body></html>
        `);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed.' });

    const { action, role, exp, lang, qty, question, answer } = req.body;

    try {
        if (action === 'generate') {
            const prompt = `You are a professional HR Manager. Generate exactly ${qty} interview questions for a "${role}" with "${exp}" experience.
            CRITICAL RULE: Write the questions EXCLUSIVELY in ${lang}. If ${lang} is Urdu, use ONLY standard Urdu alphabet. Do NOT use any Cyrillic, Chinese, or Japanese characters under any circumstances.
            Format: Return ONLY a JSON object: { "questions": ["Q1", "Q2"] }`;

            const result = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json({ questions: result.questions });
        }

        if (action === 'evaluate') {
            const prompt = `You are a professional HR Manager evaluating a candidate for the role of "${role}".
            Question: "${question}"
            Candidate's Answer: "${answer}"
            Target Language: ${lang}
            
            CRITICAL RULE: Write your feedback and correct_answer EXCLUSIVELY in ${lang}. If ${lang} is Urdu, use ONLY the standard Urdu Arabic script. ABSOLUTELY NO Cyrillic, Russian, Chinese, or Japanese characters are allowed. Keep it simple and strictly professional.
            
            Return ONLY a JSON object:
            {
                "status": "correct", "incorrect", or "improve",
                "feedback": "2 lines of helpful feedback in pure ${lang}",
                "correct_answer": "The ideal professional answer in pure ${lang}"
            }`;

            const evaluation = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json(evaluation);
        }

        return res.status(400).json({ error: 'Invalid action.' });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: "Backend Error: " + error.message });
    }
}
