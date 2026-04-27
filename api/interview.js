// 100% DIRECT FETCH API - NO GOOGLE PACKAGE NEEDED!

function parseGeminiJSON(text) {
    let cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    return JSON.parse(cleanText);
}

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { action, name, role, exp, lang, qty, jd, question, answer } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Gemini API Key is missing in Vercel Environment Variables!" });
    }

    try {
        let prompt = "";

        // ==========================================
        // 1. GENERATE QUESTIONS
        // ==========================================
        if (action === 'generate') {
            const jdContext = jd ? `\nCRITICAL CONTEXT: The candidate provided this specific Job Description for the role: "${jd}". You MUST base your interview questions directly on the specific skills, requirements, and duties mentioned in this JD.` : '';

            prompt = `You are an expert, friendly, and professional Human HR Manager conducting a job interview. Output MUST be strictly valid JSON without any markdown formatting.
            
            Task: Generate exactly ${qty} interview questions for the role of "${role}" with "${exp}" experience.
            ${jdContext}
            
            HUMAN TOUCH REQUIREMENT (CRITICAL): 
            For the VERY FIRST question in your array, you MUST start by greeting the candidate by their name ("${name}"). Ask how they are doing today, warmly welcome them to the interview for the "${role}" position, and then ask the first actual interview question. Behave like a real human.
            
            Language Rules: Must be strictly in ${lang}.
            - If "English": Use natural, professional conversational English.
            - If "Urdu": Use pure Urdu Arabic script ONLY (اردو). No Hindi words.
            - If "Roman Urdu": Use English A-Z alphabets, but speak in a natural Pakistani conversational tone (e.g., 'Assalam o Alaikum ${name}, aap kaise hain?').
            - ABSOLUTELY NO mixed scripts.
            
            Format exactly like this: { "questions": ["Greeting & Q1", "Q2", "Q3"] }`;
        }

        // ==========================================
        // 2. EVALUATE ANSWER
        // ==========================================
        if (action === 'evaluate') {
            prompt = `You are an expert, honest, and friendly HR Manager. Output MUST be strictly valid JSON without any markdown formatting.
            
            Task: Evaluate the candidate's answer: "${answer}" to the interview question: "${question}".
            
            STRICT EVALUATION RULES:
            1. status = "correct": ONLY if the answer is factually accurate, highly professional, and hits the main points.
            2. status = "improve": If the answer has the right general idea but lacks detail, uses poor wording, or is incomplete.
            3. status = "incorrect": If the answer is completely wrong, irrelevant, or unprofessional. Do NOT pass a wrong answer. Be strict but polite.
            
            FEEDBACK TONE: Speak directly to the candidate like a human mentor. Be conversational, direct, and honest.
            
            Language Rules: Pure ${lang} ONLY. No foreign scripts.
            
            Format exactly like this: { 
                "status": "correct", 
                "feedback": "2-3 lines of direct, human-like feedback addressing the candidate in ${lang}", 
                "correct_answer": "The ideal professional answer in ${lang}" 
            }`;
        }

        // 🚀 THE MAGIC: DIRECT API CALL (Bypassing Vercel Package Issues)
        // ہم v1beta استعمال کر رہے ہیں جو 1.5 flash کو 100% سپورٹ کرتا ہے
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            })
        });

        const data = await response.json();

        // اگر API نے کوئی ایرر دیا تو اسے پکڑیں گے
        if (!response.ok) {
            throw new Error(data.error?.message || "Unknown Gemini Direct Fetch Error");
        }

        const responseText = data.candidates[0].content.parts[0].text;
        return res.status(200).json(parseGeminiJSON(responseText));

    } catch (error) {
        // اب اگر ایرر آئے گا تو اس پر "Direct Fetch API Error" لکھا ہوگا
        console.error("Direct Fetch API Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
