// 🚀 100% DIRECT DEEPSEEK API - SUPER FAST, BEST ROMAN URDU!

function parseJSON(text) {
    let cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    return JSON.parse(cleanText);
}

export default async function handler(req, res) {
    // Vercel CORS Settings
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { action, name, role, exp, lang, qty, jd, question, answer } = req.body;
    
    // Vercel se DeepSeek ki Key nikal rahe hain
    const apiKey = process.env.DEEPSEEK_API_KEY ? process.env.DEEPSEEK_API_KEY.trim() : null;

    if (!apiKey) {
        return res.status(500).json({ error: "DeepSeek API Key is missing in Vercel!" });
    }

    try {
        let prompt = "";

        if (action === 'generate') {
            const jdContext = jd ? `\nCRITICAL CONTEXT: Base your questions directly on this JD: "${jd}".` : '';

            prompt = `System: You are an expert, highly professional, and friendly HR Manager. Output MUST be valid JSON.
            Task: Generate exactly ${qty} interview questions for "${role}" with "${exp}" experience.${jdContext}
            
            HUMAN TOUCH: First question MUST warmly greet candidate by name ("${name}").
            
            Language Rules (${lang}):
            - If "Roman Urdu": MUST speak like a native Pakistani HR professional. DO NOT use formal Hindi words (no kripya, prabandhak, etc). USE natural words like 'zaroorat', 'koshish', 'masla', 'behtareen'. Example: 'Assalam o Alaikum ${name}! Aap kese hain? Aaj hum aap ke interview ka aaghaz karte hain. Aap ka pehla sawal hai...'
            - If "Urdu": Use pure Urdu Arabic script ONLY.
            - If "English": Use natural conversational English.
            
            Format strictly like this: { "questions": ["Greeting & Q1", "Q2", "Q3"] }`;
        }

        if (action === 'evaluate') {
            prompt = `System: You are an expert HR Manager. Output MUST be valid JSON.
            Task: Evaluate answer: "${answer}" to question: "${question}".
            EVALUATION RULES: "correct", "improve", or "incorrect".
            Language: Pure ${lang} ONLY. Be direct and friendly like a real mentor.
            Format exactly like this: { "status": "correct", "feedback": "2 lines feedback in ${lang}", "correct_answer": "Ideal answer in ${lang}" }`;
        }

        // 🚀 THE MAGIC: DIRECT CALL TO DEEPSEEK V3
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat", // DeepSeek ka super-fast model
                messages: [{ role: "system", content: prompt }],
                temperature: 0.3,
                response_format: { type: "json_object" } // Strictly JSON format
            })
        });

        const data = await response.json();

        if (response.ok) {
            let text = data.choices[0].message.content;
            return res.status(200).json(parseJSON(text));
        } else {
            throw new Error(data.error?.message || "Unknown DeepSeek API Error");
        }

    } catch (error) {
        console.error("System Error:", error.message);
        return res.status(500).json({ error: "System Error: " + error.message });
    }
}
