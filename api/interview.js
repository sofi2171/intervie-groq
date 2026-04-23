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
                temperature: 0.2, // Keeps AI strict and focused
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
            <h1>✅ System is Live & Language Fixed!</h1></body></html>
        `);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed.' });

    const { action, role, exp, lang, qty, question, answer } = req.body;

    try {
        if (action === 'generate') {
            const prompt = `You are a professional HR Manager. Generate exactly ${qty} interview questions for a "${role}" with "${exp}" experience.
            
            CRITICAL LANGUAGE RULES for ${lang}:
            - If ${lang} is "Urdu": Use ONLY standard Urdu Arabic script. Absolutely NO Chinese, Russian, or Hindi script.
            - If ${lang} is "Roman Urdu": Write EXACTLY how Pakistanis text on WhatsApp using the English alphabet. USE words like 'sehat', 'tafseel', 'zaroorat', 'mareez', 'jaiza'. STRICTLY AVOID Shuddh Hindi words like 'swasthya', 'vistrit', 'avashyakta', 'kripya', 'yojana', 'mulyankan'.
            
            Format: Return ONLY a JSON object: { "questions": ["Q1", "Q2"] }`;

            const result = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json({ questions: result.questions });
        }

        if (action === 'evaluate') {
            const prompt = `You are a professional HR Manager evaluating a candidate for the role of "${role}".
            Question: "${question}"
            Candidate's Answer: "${answer}"
            Target Language: ${lang}
            
            CRITICAL LANGUAGE RULES for ${lang}:
            - If ${lang} is "Urdu": Use ONLY pure Urdu script. No Cyrillic, Chinese, or English mixed.
            - If ${lang} is "Roman Urdu": Write naturally in everyday Pakistani conversational style. USE Pakistani vocabulary (e.g., 'behtar', 'masla', 'hal', 'sahulat', 'mariizon ki dekhbhal'). STRICTLY AVOID any Hindi-specific words like 'swasthya', 'sthiti', 'vistrit', 'yojana', 'mulyankan'.
            
            Return ONLY a JSON object:
            {
                "status": "correct", "incorrect", or "improve",
                "feedback": "2 lines of helpful feedback in pure ${lang} following the rules above",
                "correct_answer": "The ideal professional answer in pure ${lang} following the rules above"
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
