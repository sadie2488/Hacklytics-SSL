export default async function handler(req, res) {
    const { text } = req.body;
    const elevenKey = process.env.ELEVEN_LABS_KEY;
    const voiceId = 'jfIS2w2yJi0grJZPyEsk'; // Your chosen voice
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'xi-api-key': elevenKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_monolingual_v1",
                voice_settings: { stability: 0.5, similarity_boost: 0.5 }
            })
        });

        if (!response.ok) throw new Error('ElevenLabs error');

        // Convert the audio stream into an ArrayBuffer to send back
        const audioBuffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioBuffer));
    } catch (error) {
        res.status(500).json({ error: "Audio generation failed" });
    }
}