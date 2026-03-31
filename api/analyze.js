export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { foodLog, images } = req.body;
        
        // FIX #1: Tanggalin natin ang invisible spaces sa API key just in case!
        const apiKey = (process.env.GEMINI_API_KEY || '').trim();

        if (!apiKey) {
            return res.status(500).json({ error: 'API Key is missing in Vercel.' });
        }

        const systemPrompt = `
    You are FLUX, a chill and witty AI assistant. 
    The user just logged their food: "${foodLog}". 
    If there are images, identify the food visually.

    Rules:
    1. Don't be too formal. Avoid mentioning "engineering" or "board exams" unless the user says so.
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

        // TAMA NA ANG MODEL PANGALAN DITO!
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: partsArray }]
            })
        });

        const data = await response.json();
        
        // FIX #3: Dagdag debugging para kung sakaling mag-inarte ulit, sasabihin niya eksakto kung bakit
        if (!response.ok) {
            console.error("Google API Error details:", data);
            throw new Error(data.error?.message || 'Unknown API Error');
        }
        
        const aiVerdict = data.candidates[0].content.parts[0].text;
        res.status(200).json({ verdict: aiVerdict });

    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({ error: error.message });
    }
}
