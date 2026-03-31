export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { foodLog, images } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // Ang updated prompt para maintindihan niya na baka may images
    const systemPrompt = `
        You are an AI Assistant inside a productivity app called FLUX. 
        The user is an engineering student reviewing for board exams.
        Analyze the food they ate today based on this text list: "${foodLog}".
        If there are any images provided, visually identify the food in them.
        
        Combine your visual analysis and text analysis. 
        Keep your response short (2-3 sentences max). Use a friendly, encouraging Taglish tone. 
        Tell them if the food is good fuel for studying, or if they need more nutrition.
    `;

    // 1. I-setup ang parts array natin (uumpisahan sa text prompt)
    let partsArray = [{ text: systemPrompt }];

    // 2. Kung may images na pinadala galing sa frontend, isingit sa array
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

    // Gagamitin na natin ang PRO version na mas powerful at stable
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: partsArray }]
            })
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);
        
        const aiVerdict = data.candidates[0].content.parts[0].text;
        res.status(200).json({ verdict: aiVerdict });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: 'Failed to analyze food.' });
    }
}
