// 100% DIRECT FETCH GEMINI API - WITH AUTO-RETRY & MULTI-MODEL FALLBACK 🛡️

// Helper Function: 2 second wait karne ke liye
const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { action, name, role, exp, lang, qty, jd, question, answer } = req.body;
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

    if (!apiKey) {
        return res.status(500).json({ error: "Gemini API Key is missing in Vercel!" });
    }

    try {
        let prompt = "";

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
            - If "Roman Urdu": Use English A-Z alphabets, but speak in a natural Pakistani conversational tone.
            - ABSOLUTELY NO mixed scripts.
            
            Format exactly like this: { "questions": ["Greeting & Q1", "Q2", "Q3"] }`;
        }

        if (action === 'evaluate') {
            prompt = `You are an expert, honest, and friendly HR Manager. Output MUST be strictly valid JSON without any markdown formatting.
            
            Task: Evaluate the candidate's answer: "${answer}" to the interview question: "${question}".
            
            STRICT EVALUATION RULES:
            1. status = "correct": ONLY if the answer is factually accurate, highly professional, and hits the main points.
            2. status = "improve": If the answer has the right general idea but lacks detail, uses poor wording, or is incomplete.
            3. status = "incorrect": If the answer is completely wrong, irrelevant, or unprofessional. Do NOT pass a wrong answer. Be strict but polite.
            
            Language Rules: Pure ${lang} ONLY. No foreign scripts.
            
            Format exactly like this: { 
                "status": "correct", 
                "feedback": "2-3 lines of direct, human-like feedback addressing the candidate in ${lang}", 
                "correct_answer": "The ideal professional answer in ${lang}" 
            }`;
        }

        // 🛡️ THE MAGIC: FALLBACK & RETRY LOGIC
        // Google ke best models ki list. Agar ek busy hoga, to code agle par chala jaye ga.
        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
        let lastError = "";

        for (let model of modelsToTry) {
            let retries = 2; // Har model par 2 baar try karega
            
            while (retries > 0) {
                try {
                    console.log(`🚀 Trying model: ${model} (Retries left: ${retries})`);
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    
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
                        // SUCCESS! Mark-down hata kar JSON bhejo
                        let text = data.candidates[0].content.parts[0].text;
                        let cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
                        return res.status(200).json(JSON.parse(cleanText));
                    } else {
                        const errorMsg = data.error?.message || "Unknown API Error";
                        lastError = errorMsg;

                        if (errorMsg.toLowerCase().includes("high demand") || response.status === 503) {
                            console.log(`⚠️ ${model} is busy. Waiting 2.5 seconds to retry...`);
                            await delay(2500); // Wait 2.5 seconds before retrying
                            retries--;
                        } else if (errorMsg.toLowerCase().includes("not found") || response.status === 404) {
                            console.log(`❌ ${model} not found for this key. Switching to next model...`);
                            break; // Yeh while loop torey ga, aur agle model (for loop) par chala jaye ga
                        } else {
                            throw new Error(errorMsg); // Agar API key ghalat ho ya koi aur masla ho
                        }
                    }
                } catch (err) {
                    if (retries === 1) {
                        lastError = err.message;
                        break; 
                    }
                    retries--;
                }
            }
        }

        // Agar saare models aur saari retries fail ho jayen
        return res.status(500).json({ error: "System Error: Google servers are highly congested right now. We tried multiple times. Please try again after 5 minutes." });

    } catch (error) {
        return res.status(500).json({ error: "Fatal API Error: " + error.message });
    }
}
