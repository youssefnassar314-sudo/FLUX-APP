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
                console.error("Google API Error details:", data);
                throw new Error(data.error?.message || 'Unknown API Error');
            }

            // Kukunin yung text at tatanggalin ang spaces. Gagawin nating integer.
            const aiResponseText = data.candidates[0].content.parts[0].text.trim();
            const estMins = parseInt(aiResponseText) || 30; // 30 mins default fallback kung sakaling mag-inarte at magbigay ng text

            return res.status(200).json({ estMins: estMins });
        } 
        
        // ==========================================
        // 🤖 LOGIC 2: DAILY AI MOTIVATION
        // ==========================================
        else if (action === 'getBriefing') {
            const prompt = `
The user's name is "${userName}". They currently feel "${currentMood}".
They have ${userData?.pendingTasks || 0} pending tasks to finish today.

Provide a short, 2-sentence motivational advice in conversational Taglish (Tagalog-English). 
Acknowledge their current mood and remind them to tackle their pending tasks.
Then, provide a separate, highly motivational quote.

STRICT RULE: DO NOT use the word "Engineer". Be a supportive and chill AI assistant.

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
                    briefing: `Hey ${userName}, may ${userData.pendingTasks || 0} tasks ka pa today. Kayang-kaya mo yan!`,
                    quote: "Stay focused."
                });
            }
        }
            
        // ==========================================
        // 🥗 LOGIC 4: DAILY FOOD SUMMARY (Calories + Grade)
        // ==========================================
        // MOVED THIS UP BEFORE THE FINAL ELSE
        else if (action === 'getFoodSummary') {
            const { foodItems } = req.body;

            if (!foodItems || foodItems.length === 0) {
                return res.status(200).json({ calories: 0, grade: 'N/A', summary: 'Wala pang kinain today.' });
            }

            const foodList = foodItems.map(f => `${f.meal}: ${f.item}`).join('\n');

            const prompt = `
You are a nutrition analyst AI. Based on the food log below, estimate the total calories and give a nutrition grade for the day.

Food log:
${foodList}

Rules:
1. Estimate total calories as realistically as possible based on typical Filipino/common food portions.
2. Grade the overall nutrition of the day using a school-style grade: A+, A, B+, B, C+, C, D, F.
   - A+/A = very balanced, enough protein, veggies, good carbs
   - B+/B = decent but missing something (e.g., no veggies, too much carbs)
   - C+/C = mostly junk or unbalanced
   - D/F = almost no nutritional value or severely lacking
3. Write a 1-sentence Taglish summary/tip about their eating today. Be honest but chill, like a barkada.
4. DO NOT use the word "engineer".

Return ONLY a valid JSON object (no markdown, no backticks):
{
  "calories": <number>,
  "grade": "<letter grade>",
  "summary": "<1 sentence Taglish tip>"
}
`;

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

            let aiText = data.candidates[0].content.parts[0].text.trim();
            if (aiText.startsWith('```json')) {
                aiText = aiText.replace(/^```json/, '').replace(/```$/, '').trim();
            }

            try {
                const parsed = JSON.parse(aiText);
                return res.status(200).json(parsed);
            } catch (e) {
                return res.status(200).json({ calories: 0, grade: '?', summary: 'Hindi ko ma-analyze ang food log mo ngayon.' });
            }
        }

        // ==========================================
        // 🍔 LOGIC 3: FOOD LOG ANALYZER (Original)
        // ==========================================
        // THIS IS NOW THE FINAL FALLBACK
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
