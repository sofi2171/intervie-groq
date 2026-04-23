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
            <h1>✅ System is Live!</h1></body></html>
        `);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed.' });

    const { action, role, exp, lang, qty, question, answer } = req.body;

    try {
        if (action === 'generate') {
            // 🚀 سٹرکٹ پرامپٹ: زبان مکس کرنے سے سختی سے منع کیا گیا ہے
            const prompt = `Act as an expert human HR Manager. Generate exactly ${qty} highly professional interview questions for a candidate applying for the role of "${role}" with "${exp}" experience. 
            CRITICAL INSTRUCTION: The questions MUST be written ENTIRELY and NATURALLY in the "${lang}" language. Use the correct native alphabet and script for ${lang} (e.g., if Urdu, use ONLY pure Urdu Nastaliq script). DO NOT mix English words, Chinese, Hindi, or any other language characters. Sound like a real native human speaker.
            Return ONLY a JSON object with a "questions" array containing the strings.
            Format: { "questions": ["Question 1", "Question 2"] }`;

            const result = await callGroqWithFallback([{ role: "user", content: prompt }]);
            return res.status(200).json({ questions: result.questions });
        }

        if (action === 'evaluate') {
            // 🚀 سٹرکٹ پرامپٹ برائے ایویلیوایشن
            const prompt = `Act as an expert human HR Manager evaluating a candidate for the role of "${role}".
            Question Asked: "${question}"
            Candidate's Answer: "${answer}"
            Language: ${lang}
            
            CRITICAL INSTRUCTION: Your feedback and the correct_answer MUST be written ENTIRELY and NATURALLY in native "${lang}". Do NOT use any Chinese characters, Hindi characters, or English words (unless it is a universally unavoidable medical term). Write naturally like a native human HR manager speaking directly to the candidate.
            
            Evaluate this answer realistically. Return ONLY a JSON object with this exact structure:
            {
                "status": "correct", "incorrect", or "improve",
                "feedback": "Write a helpful, naturally flowing 2-line feedback directed to the candidate in pure ${lang}.",
                "correct_answer": "Write the ideal, highly professional human-like answer the candidate SHOULD have given, in pure ${lang}."
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
