export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Kinuha na natin lahat ng possible fields mula sa frontend request
        const { action, foodLog, images, title, details, category, userName, coachPersona, currentMood, data: userData } = req.body;
        
        // FIX #1: Tanggalin natin ang invisible spaces sa API key just in case!
        const apiKey = (process.env.GEMINI_API_KEY || '').trim();

        if (!apiKey) {
            return res.status(500).json({ error: 'API Key is missing in Vercel.' });
        }

        // TAMA NA ANG MODEL PANGALAN DITO!
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // ==========================================
        // 🧠 LOGIC 1: TASK ESTIMATOR
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
                console.error("Google API Error details:", data);
                throw new Error(data.error?.message || 'Unknown API Error');
            }

            // Kukunin yung text at tatanggalin ang spaces. Gagawin nating integer.
            const aiResponseText = data.candidates[0].content.parts[0].text.trim();
            const estMins = parseInt(aiResponseText) || 30; // 30 mins default fallback kung sakaling mag-inarte at magbigay ng text

            return res.status(200).json({ estMins: estMins });
        } 
        
        // ==========================================
        // 🤖 LOGIC 2: AI LIFE COACH (BAGONG DAGDAG!)
        // ==========================================
        else if (action === 'getBriefing') {
const prompt = `
Act as a personal life coach with the persona: "${coachPersona}".
The user's name is "${userName}". 
STRICT RULE: DO NOT EVER USE THE WORD "Engineer".

Context right now:
- Pending Tasks (To-Do): ${userData?.pendingTasks || 0} 
- Today's Events (Schedule): ${userData?.todayEvents || 0}
- Current Mood: "${currentMood}"
- Budget Spent: ${userData?.budgetPercent || 0}%
- Total Unpaid Debt: ₱${userData?.totalUnpaidDebt || 0}  <-- DAGDAG ITO
- Nearest Debt Due: ${userData?.nearestDue || 'N/A'}    <-- DAGDAG ITO

STRICT INSTRUCTIONS FOR COUNTING:
1. "Pending Tasks" are things the user needs to ACTUALLY FINISH. 
2. "Today's Events" are just schedules or commitments (like classes or dates). 
3. NEVER sum these two numbers. If there are 2 tasks and 1 event, DO NOT say "You have 3 tasks."
4. If Pending Tasks is 0, congratulate them even if they have 10 Events. 
5. Treat Events as "Calendar items"—mention them as "You have a schedule later," not as a chore.

FINANCIAL INSTRUCTION:
1. If totalUnpaidDebt > 0, include a subtle (or harsh, depending on persona) reminder about it.
2. If budgetPercent is over 80% and they still have debt, the coach should be more concerned.
3. If totalUnpaidDebt is 0, congratulate them for being debt-free!

            
            CRITICAL INSTRUCTION FOR MOOD:
            If the user's mood is "Pakyu", act extremely savage, sarcastic, or match their chaotic/frustrated energy according to your persona. Validate their frustration but remind them to get back on track.

            Speak in conversational Taglish (Tagalog-English) like a peer or close friend.

            Provide a short 2-3 sentence daily briefing (advice/update) and a separate short motivational quote.
            
            You MUST return exactly a valid JSON object (no markdown, no backticks) with this exact structure:
            {
                "briefing": "your 3-4 sentence update here",
                "quote": "your quote here"
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
                console.error("Google API Error details:", responseData);
                throw new Error(responseData.error?.message || 'Unknown API Error');
            }

            let aiText = responseData.candidates[0].content.parts[0].text.trim();
            
            // Lilinisin natin just in case magbigay ang AI ng markdown na ```json ... ```
            if (aiText.startsWith('```json')) {
                aiText = aiText.replace(/^```json/, '').replace(/```$/, '').trim();
            }

            try {
                const parsedResult = JSON.parse(aiText);
                return res.status(200).json(parsedResult);
            } catch (parseError) {
                console.error("JSON Parse Error:", parseError, "Raw AI Text:", aiText);
                // Fallback kung pumalya ang AI sumunod sa JSON format
                return res.status(200).json({ 
                    briefing: `Hey ${userName}, medyo naguluhan ako pero you have ${userData.pendingTasks} tasks left. Kaya mo 'yan!`,
                    quote: "Stay focused."
                });
            }
        }
        
        // ==========================================
        // 🍔 LOGIC 3: FOOD LOG ANALYZER (Original)
        // ==========================================
        else {
            const systemPrompt = `
        You are FLUX, a chill and witty AI assistant. 
        The user just logged their food: "${foodLog}". 
        If there are images, identify the food visually.

        Rules:
        1. Don't be too formal. STRICT RULE: NEVER mention the word "engineering" or "engineer". Call them by their name if needed.
        2. Use a mix of Tagalog and English (Taglish) that sounds like a helpful peer or barkada.
        3. Keep it short (2 sentences).
        4. Give a "Bro Tip" or a funny observation about their meal. 
        5. Be encouraging but real (e.g., if it's all junk food, joke about needing a vegetable once in a while).
        `;
            let partsArray = [{ text: systemPrompt }];

            if (images && images.length > 0) {
                images.forEach(img => {
                    partsArray.push({
                        inlineData: {
                            mimeType: img.mimeType,
                            data: img.data
                        }
                    });
                });
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: partsArray }]
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error("Google API Error details:", data);
                throw new Error(data.error?.message || 'Unknown API Error');
            }
            
            const aiVerdict = data.candidates[0].content.parts[0].text;
            return res.status(200).json({ verdict: aiVerdict });
        }

    } catch (error) {
        console.error("AI Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
}
