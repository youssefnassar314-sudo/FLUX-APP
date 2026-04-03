export default async function handler(req, res) {
    // 1. Siguraduhing POST request lang ang tatanggapin
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Kunin ang mga pinasang data mula sa frontend (app.js)
        // Note: Tinanggal na natin ang 'images', 'currentMood', at 'userData' para mas malinis
        const { action, foodLog, title, details, category, userName } = req.body;
        
        // 3. Setup ng Gemini API Key
        const apiKey = (process.env.GEMINI_API_KEY || '').trim();

        if (!apiKey) {
            return res.status(500).json({ error: 'API Key is missing in Vercel.' });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // ==========================================
        // 🚀 LOGIC 1: TASK ESTIMATOR
        // ==========================================
        if (action === 'estimateTask') {
            const prompt = `Isa kang AI productivity assistant. I-estimate mo kung ilang minuto aabutin ang task na ito.
            Title: ${title}
            Details: ${details || 'Wala'}
            Category: ${category}
            
            MAGBIGAY KA LANG NG NUMBER IN MINUTES (halimbawa: 45, 60, 120). Bawal ang ibang text, bawal ang words. Pure number lang.`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Google API Error:", data);
                throw new Error(data.error?.message || 'Unknown API Error');
            }

            const aiResponseText = data.candidates[0].content.parts[0].text.trim();
            const estMins = parseInt(aiResponseText) || 30;

            return res.status(200).json({ estMins: estMins });
        } 
        
        // ==========================================
        // 🤖 LOGIC 2: PURE DAILY MOTIVATION
        // ==========================================
        else if (action === 'getBriefing') {
            const prompt = `
The user's name is "${userName}". 

Provide a short, 2-sentence highly motivational advice for the day in conversational Taglish (Tagalog-English). 
Be positive, uplifting, and chill like a supportive friend. Do not mention tasks or moods. Just pure motivation.
Then, provide a separate, impactful motivational quote.

STRICT RULE: DO NOT use the word "Engineer". 

You MUST return exactly a valid JSON object (no markdown, no backticks) with this exact structure:
{
    "briefing": "your 2-sentence advice here",
    "quote": "your motivational quote here"
}
`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.error?.message || 'Unknown API Error');
            }

            let aiText = responseData.candidates[0].content.parts[0].text.trim();
            if (aiText.startsWith('```json')) {
                aiText = aiText.replace(/^```json/, '').replace(/```$/, '').trim();
            }

            try {
                const parsedResult = JSON.parse(aiText);
                return res.status(200).json(parsedResult);
            } catch (parseError) {
                return res.status(200).json({ 
                    briefing: `Good morning, ${userName}! Have an amazing day ahead.`,
                    quote: "One step at a time."
                });
            }
        }

        // ==========================================
        // 🥗 LOGIC 3: ALL-IN-ONE DAILY FOOD ANALYZER
        // ==========================================
        else if (action === 'analyzeDailyFood') {
            const prompt = `
You are FLUX, a chill and witty AI nutrition assistant.
The user (${userName}) logged their food for today: "${foodLog}".

Rules:
1. "verdict": Give a funny, short (2 sentences) Taglish observation or Bro Tip about their meal today. Be encouraging but real.
2. "calories": Estimate the total calories realistically based on typical Filipino/common food portions. Provide a NUMBER only.
3. "grade": Grade the overall nutrition for the day using: A+, A, B+, B, C+, C, D, F.
4. STRICT RULE: NEVER mention the word "engineer" or "engineering". 

Return ONLY a valid JSON object (no markdown, no backticks):
{
  "verdict": "<funny taglish tip>",
  "calories": <number>,
  "grade": "<letter grade>"
}
`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    // STRICT MODE: Pinipigilan natin si AI na mag-iba-iba ng Kcal estimate
                    generationConfig: { temperature: 0.1 }
                })
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error("Google API Error:", responseData);
                throw new Error(responseData.error?.message || 'Unknown API Error');
            }

            let aiText = responseData.candidates[0].content.parts[0].text.trim();
            if (aiText.startsWith('```json')) {
                aiText = aiText.replace(/^```json/, '').replace(/```$/, '').trim();
            }

            try {
                const parsedResult = JSON.parse(aiText);
                return res.status(200).json(parsedResult);
            } catch (parseError) {
                return res.status(200).json({ 
                    verdict: `Solid eats today, ${userName}! Stay hydrated.`,
                    calories: 0,
                    grade: "?"
                });
            }
        }

        // ==========================================
        // 🚫 FALLBACK: KUNG WALANG TUMAMANG ACTION
        // ==========================================
        else {
            return res.status(400).json({ error: 'Invalid action provided.' });
        }

    } catch (error) {
        console.error("AI Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
