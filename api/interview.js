import Groq from "groq-sdk";

async function callGroqWithFallback(messages) {
    // 5 Keys ka Bulletproof System
    const keys = [
        process.env.GROQ_1, process.env.GROQ_2, process.env.GROQ_3,
        process.env.GROQ_4, process.env.GROQ_5
    ].filter(key => key && key.trim() !== '');

    if (keys.length === 0) throw new Error("No API keys found in Vercel.");

    for (let i = 0; i < keys.length; i++) {
        try {
            const groq = new Groq({ apiKey: keys[i] });
            const completion = await groq.chat.completions.create({
                messages: messages,
                model: "llama-3.3-70b-versatile", // Duniya ka behtareen open-source model
                temperature: 0.3, 
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error(`Groq Key ${i+1} failed:`, error.message);
        }
    }
    throw new Error("All Groq API keys failed or limit reached.");
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { action, name, role, exp, lang, qty, jd, question, answer } = req.body;

    try {
        if (action === 'generate') {
            const jdContext = jd ? `\nCRITICAL CONTEXT: The candidate provided this specific Job Description for the role: "${jd}". You MUST base your interview questions directly on the specific skills, requirements, and duties mentioned in this JD.` : '';

            const prompt = `System: You are an expert, friendly, and professional Human HR Manager conducting a job interview. Output MUST be valid JSON.
            
            Task: Generate exactly ${qty} interview questions for the role of "${role}" with "${exp}" experience.
            ${jdContext}
            
            HUMAN TOUCH REQUIREMENT (CRITICAL): 
            For the VERY FIRST question in your array, you MUST start by greeting the candidate by their name ("${name}"). Ask how they are doing today, warmly welcome them to the interview for the "${role}" position, and then ask the first actual interview question. Behave like a real human.
            
            Language Rules: Must be strictly in ${lang}.
            - If "Roman Urdu": USE NATURAL PAKISTANI STREET STYLE ROMAN URDU. Do not use overly formal or pure Hindi words. Use common words like 'koshish', 'zaroorat', 'masla', 'hal'. (e.g., 'Assalam o Alaikum ${name}, aap kaise hain? Aaj hum aapka interview start karte hain.').
            - If "English": Use natural, professional conversational English.
            - ABSOLUTELY NO mixed scripts.
            
            Format: { "questions": ["Greeting & Q1", "Q2", "Q3", ...] }`;

            const result = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json(result);
        }

        if (action === 'evaluate') {
            const prompt = `System: You are an expert, honest, and friendly HR Manager. Output MUST be valid JSON.
            
            Task: Evaluate the candidate's answer: "${answer}" to the interview question: "${question}".
            
            STRICT EVALUATION RULES:
            1. status = "correct": ONLY if the answer is factually accurate, highly professional, and hits the main points.
            2. status = "improve": If the answer has the right general idea but lacks detail, uses poor wording, or is incomplete.
            3. status = "incorrect": If the answer is completely wrong, irrelevant, or unprofessional. Do NOT pass a wrong answer. Be strict but polite.
            
            FEEDBACK TONE: Speak directly to the candidate like a human mentor. Be conversational, direct, and honest.
            
            Language Rules: Pure ${lang} ONLY. Natural phrasing.
            
            Format: { 
                "status": "correct|incorrect|improve", 
                "feedback": "2-3 lines of direct, human-like feedback addressing the candidate in ${lang}", 
                "correct_answer": "The ideal professional answer in ${lang}" 
            }`;

            const evaluation = await callGroqWithFallback([{ role: "system", content: prompt }]);
            return res.status(200).json(evaluation);
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
