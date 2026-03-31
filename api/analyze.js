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
            You are an AI Assistant inside a productivity app called FLUX. 
            The user is an engineering student reviewing for board exams.
            Analyze the food they ate today based on this text list: "${foodLog}".
            If there are images, visually identify the food in them.
            Keep your response short (2-3 sentences max). Use a friendly, encouraging Taglish tone. 
            Tell them if the food is good fuel for studying.
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
