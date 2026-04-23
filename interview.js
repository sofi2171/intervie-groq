import Groq from "groq-sdk";

// 🧠 Smart Helper Function: یہ فنکشن باری باری 5 کیز ٹرائی کرے گا
async function callGroqWithFallback(messages) {
    // Vercel Environment Variables سے 5 کیز پکڑنا (جو خالی ہوں گی وہ خود ہی فلٹر ہو جائیں گی)
    const keys = [
        process.env.GROQ_1,
        process.env.GROQ_2,
        process.env.GROQ_3,
        process.env.GROQ_4,
        process.env.GROQ_5
    ].filter(key => key && key.trim() !== '');

    if (keys.length === 0) {
        throw new Error("Server Setup Error: No Groq API keys found.");
    }

    let lastError = null;

    // ایک ایک کر کے Key ٹرائی کرنے کا لوپ (Loop)
    for (let i = 0; i < keys.length; i++) {
        try {
            // ہر دفعہ نئی Key کے ساتھ Groq کو انیشلائز کرنا
            const groq = new Groq({ apiKey: keys[i] });
            
            const completion = await groq.chat.completions.create({
                messages: messages,
                model: "llama3-70b-8192", // Groq's high-speed and accurate model
                response_format: { type: "json_object" }
            });

            // اگر ڈیٹا صحیح آ جائے، تو اسے پارس کر کے فوراً ریٹرن کر دو (لوپ یہیں رک جائے گا)
            return JSON.parse(completion.choices[0].message.content);
            
        } catch (error) {
            console.error(`⚠️ Key GROQ_${i + 1} Failed:`, error.message);
            lastError = error;
            // اگر ایرر آیا تو ٹینشن نہیں، لوپ خود بخود اگلی Key پر چلا جائے گا!
        }
    }

    // اگر تمام 5 کیز فیل ہو جائیں (جو کہ بہت مشکل ہے)
    throw new Error("All API keys failed. Last error: " + lastError.message);
}


// 🌐 MAIN API HANDLER
export default async function handler(req, res) {
    // 🛡️ CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });

    const { action, role, exp, lang, qty, question, answer } = req.body;

    try {
        // ==========================================
        // 📝 ACTION 1: Generate Questions
        // ==========================================
        if (action === 'generate') {
            const prompt = `Act as an expert HR Manager. Generate exactly ${qty} highly professional interview questions for a candidate applying for the role of "${role}" with "${exp}" experience. 
            The questions MUST be completely in the "${lang}" language.
            Return ONLY a JSON object with a "questions" array containing the strings. Do not add any conversational text.
            Format: { "questions": ["Q1", "Q2", "Q3"] }`;

            // Smart Fallback فنکشن کو کال کرنا
            const result = await callGroqWithFallback([{ role: "user", content: prompt }]);
            
            return res.status(200).json({ questions: result.questions });
        }

        // ==========================================
        // ⚖️ ACTION 2: Evaluate User's Answer
        // ==========================================
        if (action === 'evaluate') {
            const prompt = `Act as an expert HR Manager evaluating a candidate for the role of "${role}".
            Question Asked: "${question}"
            Candidate's Answer: "${answer}"
            Language: ${lang}
            
            Evaluate this answer realistically and strictly. Return ONLY a JSON object with this exact structure:
            {
                "status": "correct" (if excellent), "incorrect" (if totally wrong/irrelevant), or "improve" (if okay but needs more professional terms),
                "feedback": "Write a helpful 2-line feedback directed to the candidate in ${lang}.",
                "correct_answer": "Write the ideal, highly professional answer the candidate SHOULD have given, in ${lang}."
            }`;

            // Smart Fallback فنکشن کو کال کرنا
            const evaluation = await callGroqWithFallback([{ role: "user", content: prompt }]);
            
            return res.status(200).json(evaluation);
        }

        return res.status(400).json({ error: 'Invalid action provided.' });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: "AI Server is currently busy. Please try again in a moment." });
    }
}
