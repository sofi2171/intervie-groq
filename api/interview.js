// 🌟 100% ENTERPRISE HYBRID BACKEND (GEMINI FIRST, GROQ FALLBACK) 🌟

function parseJSON(text) {
    let cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    return JSON.parse(cleanText);
}

// Groq ka Direct Fetch function (Vercel Cache se bachne ke liye)
async function callGroqDirect(prompt, keys) {
    for (let i = 0; i < keys.length; i++) {
        try {
            console.log(`⚡ Groq Fallback Activated: Trying Key ${i+1}`);
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${keys[i]}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "system", content: prompt }],
                    temperature: 0.3,
                    response_format: { type: "json_object" }
                })
            });

            const data = await response.json();
            if (response.ok) {
                return JSON.parse(data.choices[0].message.content);
            }
        } catch (error) {
            console.log(`❌ Groq Key ${i+1} failed.`);
        }
    }
    throw new Error("All Groq Backup Keys Failed.");
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { action, name, role, exp, lang, qty, jd, question, answer } = req.body;
    
    const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
    const groqKeys = [
        process.env.GROQ_1, process.env.GROQ_2, process.env.GROQ_3,
        process.env.GROQ_4, process.env.GROQ_5
    ].filter(key => key && key.trim() !== '');

    if (!geminiKey) return res.status(500).json({ error: "Gemini API Key missing!" });

    try {
        let prompt = "";

        if (action === 'generate') {
            const jdContext = jd ? `\nCRITICAL CONTEXT: Base your questions directly on this JD: "${jd}".` : '';

            // 🚀 MAGIC PROMPT: Zabardast Roman Urdu ke liye misalein (examples) add kar di hain
            prompt = `System: You are an expert, friendly HR Manager. Output MUST be valid JSON.
            Task: Generate ${qty} interview questions for "${role}" with "${exp}" experience.${jdContext}
            
            HUMAN TOUCH: First question MUST warmly greet candidate by name ("${name}").
            
            Language Rules (${lang}):
            - If "Roman Urdu": MUST speak like a native Pakistani. DO NOT use formal Hindi words (no 'kripya', 'prayas', 'avashyak'). USE words like 'zaroorat', 'koshish', 'masla', 'bilkul'. 
              Example: 'Assalam o Alaikum ${name}! Aap kese hain? Aaj hum aap ke interview ka aaghaz karte hain. Aap ka pehla sawal hai...'
            - If "Urdu": Use pure Urdu Arabic script ONLY.
            - If "English": Use natural conversational English.
            
            Format: { "questions": ["Greeting & Q1", "Q2", "Q3"] }`;
        }

        if (action === 'evaluate') {
            prompt = `System: You are an expert HR Manager. Output MUST be valid JSON.
            Task: Evaluate answer: "${answer}" to question: "${question}".
            EVALUATION RULES: "correct", "improve", or "incorrect".
            Language: Pure ${lang} ONLY. Be direct and friendly.
            Format: { "status": "correct", "feedback": "2 lines feedback", "correct_answer": "Ideal answer" }`;
        }

        // ==========================================
        // 🌟 STEP 1: TRY GEMINI (FOR BEST QUALITY)
        // ==========================================
        try {
            console.log("🚀 Hitting Gemini First...");
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2 }
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                let text = data.candidates[0].content.parts[0].text;
                return res.status(200).json(parseJSON(text));
            } else {
                throw new Error(data.error?.message || "Gemini Busy");
            }

        } catch (geminiError) {
            console.log(`⚠️ Gemini Failed (${geminiError.message}). Switching to Groq...`);
            
            // ==========================================
            // 🛡️ STEP 2: FALLBACK TO GROQ (FOR 100% RELIABILITY)
            // ==========================================
            if (groqKeys.length > 0) {
                const groqResult = await callGroqDirect(prompt, groqKeys);
                return res.status(200).json(groqResult);
            } else {
                throw new Error("Gemini is busy and no Groq Backup keys found.");
            }
        }

    } catch (error) {
        console.error("System Error:", error.message);
        return res.status(500).json({ error: "System Error: API Traffic is very high. " + error.message });
    }
}
