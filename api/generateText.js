export default async function handler(req, res) {
    const { context } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY; // Managed in Vercel Dashboard
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ 
                    parts: [{ text: `You are a platformer narrator. The event is: "${context}". Write one witty, sarcastic sentence (max 10 words).` }] 
                }]
            })
        });
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm speechless.";
        res.status(200).json({ text });
    } catch (error) {
        res.status(500).json({ error: "Failed to reach Gemini" });
    }
}