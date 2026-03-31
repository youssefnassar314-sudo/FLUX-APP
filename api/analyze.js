

export default async function handler(req, res) {
    // Siguraduhing POST request lang ang tinatanggap natin
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { foodLog } = req.body;
    
    // Ito yung API Key na itatago natin sa Vercel settings mamaya
    const apiKey = process.env.GEMINI_API_KEY; 

    // Ang instruction natin para kay Gemini AI (Naka-customize para sa'yo!)
    const systemPrompt = `
        You are an AI Assistant inside a productivity app called FLUX. 
        The user is an ECE engineering student reviewing for board exams.
        Analyze the food they ate today based on this list: "${foodLog}".
        
        Keep your response short (2-3 sentences max). 
        Use a friendly, encouraging Taglish tone. 
        Determine if it's healthy fuel for studying, or if they need to eat better.
    `;

    // Ang URL ng Google Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
            })
        });

        const data = await response.json();
        
        // Kukunin natin yung sagot ni Gemini at ibabato pabalik sa frontend
        const aiVerdict = data.candidates[0].content.parts[0].text;
        res.status(200).json({ verdict: aiVerdict });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: 'Failed to analyze food.' });
    }
}
