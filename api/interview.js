import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // فرنٹ اینڈ سے JD اور باقی ڈیٹا وصول کرنا
    const { action, name, role, exp, lang, qty, jd, question, answer } = req.body;

    try {
        // Gemini 1.5 Flash - سب سے تیز اور بہترین ماڈل
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        });

        // ==========================================
        // 1. GENERATE QUESTIONS (JD & Human Touch)
        // ==========================================
        if (action === 'generate') {
            const jdContext = jd ? `\nCRITICAL CONTEXT: The candidate provided this specific Job Description for the role: "${jd}". You MUST base your interview questions directly on the specific skills, requirements, and duties mentioned in this JD.` : '';

            const prompt = `You are an expert, friendly, and professional Human HR Manager conducting a job interview. Output MUST be valid JSON.
            
            Task: Generate exactly ${qty} interview questions for the role of "${role}" with "${exp}" experience.
            ${jdContext}
            
            HUMAN TOUCH REQUIREMENT (CRITICAL): 
            For the VERY FIRST question in your array, you MUST start by greeting the candidate by their name ("${name}"). Ask how they are doing today, warmly welcome them to the interview for the "${role}" position, and then ask the first actual interview question. Behave like a real human.
            
            Language Rules: Must be strictly in ${lang}.
            - If "English": Use natural, professional conversational English.
            - If "Urdu": Use pure Urdu Arabic script ONLY (اردو). No Hindi words.
            - If "Roman Urdu": Use English A-Z alphabets, but speak in a natural Pakistani conversational tone (e.g., 'Assalam o Alaikum ${name}, aap kaise hain?').
            - ABSOLUTELY NO mixed scripts.
            
            Format: { "questions": ["Greeting & Q1", "Q2", "Q3", ...] }`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            return res.status(200).json(JSON.parse(responseText));
        }

        // ==========================================
        // 2. EVALUATE ANSWER (Strict & Honest)
        // ==========================================
        if (action === 'evaluate') {
            const prompt = `You are an expert, honest, and friendly HR Manager. Output MUST be valid JSON.
            
            Task: Evaluate the candidate's answer: "${answer}" to the interview question: "${question}".
            
            STRICT EVALUATION RULES:
            1. status = "correct": ONLY if the answer is factually accurate, highly professional, and hits the main points.
            2. status = "improve": If the answer has the right general idea but lacks detail, uses poor wording, or is incomplete.
            3. status = "incorrect": If the answer is completely wrong, irrelevant, or unprofessional. Do NOT pass a wrong answer. Be strict but polite.
            
            FEEDBACK TONE: Speak directly to the candidate like a human mentor. Be conversational, direct, and honest.
            
            Language Rules: Pure ${lang} ONLY. No foreign scripts.
            
            Format: { 
                "status": "correct|incorrect|improve", 
                "feedback": "2-3 lines of direct, human-like feedback addressing the candidate in ${lang}", 
                "correct_answer": "The ideal professional answer in ${lang}" 
            }`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            return res.status(200).json(JSON.parse(responseText));
        }
    } catch (error) {
        console.error("Gemini API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
