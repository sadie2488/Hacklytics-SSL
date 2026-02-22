export default async function handler(req, res) {
    const { context } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY; // Managed in Vercel Dashboard

    if (!geminiKey) {
        console.error("GEMINI_API_KEY is not set");
        return res.status(500).json({ error: "API key not configured" });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `You are a calm, centered narrator. The event is: "${context}". Write one witty, sarcastic, or encouraging sentence which is something your character would say (max 10 words) without using asterisks, exclamation points, or emojis.` }]
                }],
                generationConfig: {
                    thinkingConfig: { thinkingBudget: 0 }
                }
            })
        });

        const data = await response.json();
        console.log("Gemini response:", JSON.stringify(data));

        if (!response.ok) {
            console.error("Gemini API error:", JSON.stringify(data));
            return res.status(200).json({ text: "I'm speechless." });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "I'm speechless.";
        res.status(200).json({ text });
    } catch (error) {
        console.error("Failed to reach Gemini:", error.message);
        res.status(500).json({ error: "Failed to reach Gemini" });
    }
}
