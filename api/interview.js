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
                // 👇 یہاں نیا ماڈل اپڈیٹ کر دیا گیا ہے 
                model: "llama-3.3-70b-versatile", 
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
    // 🛡️ CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // 🟢 Direct Browser Testing Mode
    if (req.method === 'GET') {
        return res.status(200).send(`
            <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px; background-color: #f0fdf4; color: #166534;">
                    <h1>✅ System is Live & Running!</h1>
                    <p>Health Jobs AI Backend is perfectly deployed on Vercel.</p>
                </body>
            </html>
        `);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed.' });

    const { action, role, exp, lang, qty, question, answer } = req.body;

    try {
        if (action === 'generate') {
            const prompt = `Act as an expert HR Manager. Generate exactly ${qty} highly professional interview questions for a candidate applying for the role of "${role}" with "${exp}" experience. 
            The questions MUST be completely in the "${lang}" language.
            Return ONLY a JSON object with a "questions" array containing the strings.
            Format: { "questions": ["Q1", "Q2"] }`;

            const result = await callGroqWithFallback([{ role: "user", content: prompt }]);
            return res.status(200).json({ questions: result.questions });
        }

        if (action === 'evaluate') {
            const prompt = `Act as an expert HR Manager evaluating a candidate for the role of "${role}".
            Question Asked: "${question}"
            Candidate's Answer: "${answer}"
            Language: ${lang}
            
            Evaluate this answer realistically and strictly. Return ONLY a JSON object with this exact structure:
            {
                "status": "correct", "incorrect", or "improve",
                "feedback": "Write a helpful 2-line feedback directed to the candidate in ${lang}.",
                "correct_answer": "Write the ideal, highly professional answer the candidate SHOULD have given, in ${lang}."
            }`;

            const evaluation = await callGroqWithFallback([{ role: "user", content: prompt }]);
            return res.status(200).json(evaluation);
        }

        return res.status(400).json({ error: 'Invalid action provided.' });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: "Backend Error: " + error.message });
    }
}
