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
                temperature: 0.1, // مزید کم کر دیا تاکہ AI اپنی مرضی نہ کرے
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
            // 🚀 سٹرکٹ پرامپٹ: زبان کے معاملے میں کوئی رعایت نہیں
            const prompt = `You are an expert HR Manager. Output must be valid JSON.
            Task: Generate ${qty} questions for "${role}" (${exp}).
            Language: ${lang}.
            STRICT LANGUAGE RULE: If language is "Urdu", use ONLY Urdu Arabic script. If "Roman Urdu", use ONLY English alphabet (A-Z).
            FORBIDDEN: Absolutely NO Chinese, Russian, Japanese, or Hindi characters. Use ONLY the script of the chosen language.
            JSON Format: { "questions": ["Q1", "Q2"] }`;

            const result = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json({ questions: result.questions });
        }

        if (action === 'evaluate') {
            // 🚀 یہاں بھی فلٹر سخت کر دیا ہے
            const prompt = `You are an expert HR Manager. Output must be valid JSON.
            Evaluate: "${answer}" for question "${question}".
            Rules:
            1. If professional: status="correct".
            2. If weak: status="improve".
            3. If wrong: status="incorrect".
            STRICT LANGUAGE RULE: Output MUST be in pure ${lang}. 
            FORBIDDEN: Zero tolerance for Chinese, Russian, Hindi, or mixed scripts. If you use foreign characters, you fail.
            JSON Format: { "status": "correct|incorrect|improve", "feedback": "2 lines feedback", "correct_answer": "Model answer" }`;

            const evaluation = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json(evaluation);
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
