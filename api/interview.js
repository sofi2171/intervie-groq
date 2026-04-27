// 100% DIRECT FETCH OPENROUTER API - USING FREE GEMINI 2.0 🚀

function parseJSON(text) {
    let cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    return JSON.parse(cleanText);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { action, name, role, exp, lang, qty, jd, question, answer } = req.body;
    
    const apiKey = process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.trim() : null;

    if (!apiKey) {
        return res.status(500).json({ error: "OpenRouter API Key is missing in Vercel!" });
    }

    try {
        let prompt = "";

        if (action === 'generate') {
            const jdContext = jd ? `\nCRITICAL CONTEXT: The candidate provided this Job Description: "${jd}". Base your questions directly on this JD.` : '';

            prompt = `System: You are an expert, highly empathetic, and professional HR Manager. Output MUST be strictly valid JSON without markdown.
            
            Task: Generate ${qty} interview questions for "${role}" with "${exp}" experience.
            ${jdContext}
            
            HUMAN TOUCH: For the first question, warmly greet the candidate by name ("${name}"). Ask how they are doing, welcome them to the interview, and ask the first question naturally.
            
            Language Rules (${lang}):
            - If "Roman Urdu": USE HIGHLY NATURAL, FLUENT PAKISTANI ROMAN URDU. Speak like a real Pakistani HR professional. (e.g., 'Assalam o Alaikum ${name}, aap kaise hain?'). Do not use overly formal Hindi words.
            - If "Urdu": Use pure Urdu Arabic script ONLY.
            - If "English": Use professional conversational English.
            
            Format strictly like this: { "questions": ["Greeting & Q1", "Q2", "Q3"] }`;
        }

        if (action === 'evaluate') {
            prompt = `System: You are an expert HR Manager. Output MUST be strictly valid JSON without markdown.
            
            Task: Evaluate candidate's answer: "${answer}" to the question: "${question}".
            
            EVALUATION RULES:
            1. "correct": If answer is accurate and professional.
            2. "improve": If correct but lacks detail.
            3. "incorrect": If totally wrong or irrelevant.
            
            FEEDBACK TONE: Direct, conversational, human-like mentor.
            Language: Pure ${lang} ONLY.
            
            Format exactly like this: { 
                "status": "correct|improve|incorrect", 
                "feedback": "2-3 lines of direct feedback in ${lang}", 
                "correct_answer": "Ideal professional answer in ${lang}" 
            }`;
        }

        const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://healthjobs-portal.web.app', 
                'X-Title': 'HealthJobs Portal'
            },
            body: JSON.stringify({
                // 🚀 AB HUM OPENROUTER KE ZARIYE GOOGLE GEMINI 2.0 USE KARENGE (FREE & FAST!)
                model: "google/gemini-2.0-flash:free", 
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "Unknown OpenRouter API Error");
        }

        let text = data.choices[0].message.content;
        return res.status(200).json(parseJSON(text));

    } catch (error) {
        console.error("API Error:", error.message);
        return res.status(500).json({ error: "System Error: " + error.message });
    }
}
