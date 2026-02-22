class Narrator {
    constructor() {
        this.audioQueue = [];
        this.isSpeaking = false;
        this.lastEventTime = 0;
        this.cooldown = 10000; // Minimum 3 seconds between new generations
        
        // You can hardcode these for testing, or set them via the UI inputs I added to index.html
        this.geminiKey = 'AIzaSyCyFPEPWOxOPRKia7Jks6LcO9pIY6UwQN4'; 
        this.elevenLabsKey = 'sk_179d6c3ca441c796723bdc3dd4ed1cf656dbdc8e5cd4749c';
        this.voiceId = 'jfIS2w2yJi0grJZPyEsk'; // "Rachel" voice ID (default)
    }

    setKeys(gemini, eleven) {
        this.geminiKey = gemini;
        this.elevenLabsKey = eleven;
    }

    async trigger(eventContext) {
        const now = Date.now();
        if (now - this.lastEventTime < this.cooldown || this.isSpeaking) return;
        this.lastEventTime = now;

        console.log(`Narrator Triggered: ${eventContext}`);

        try {
            const text = await this.generateText(eventContext);
            if (text) {
                await this.generateAudio(text);
            }
        } catch (error) {
            console.error("Narrator Error:", error);
        }
    }

    async generateText(context) {
    // Ensure you have your key here if not using the input boxes
        if (!this.geminiKey) {
            console.error("Missing Gemini API Key!");
            return null;
        }

        const prompt = `
            You are the narrator of a platformer game where a giant hand helps a tiny NPC.
            The current event is: "${context}".
            Write a SINGLE, witty, sarcastic, or encouraging sentence (max 10 words) reacting to this. 
            Do not use hashtags, asterisks,, exclamation marks, or emojis.
        `;

        // Corrected URL format
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${this.geminiKey}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Gemini API Error:", errorData);
                return null;
            }

            const data = await response.json();
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log("Gemini says:", generatedText);
            return generatedText;
        } catch (error) {
            console.error("Fetch failed:", error);
            return null;
        }
    }

    async generateAudio(text) {
        if (!this.elevenLabsKey) return;

        // Double check that this.elevenLabsKey doesn't have accidental spaces
        const cleanKey = this.elevenLabsKey.trim();
        const voiceId = 'jfIS2w2yJi0grJZPyEsk'; 
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'xi-api-key': cleanKey, // Must be exactly this
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_monolingual_v1",
                voice_settings: { 
                    stability: 0.5, 
                    similarity_boost: 0.5 
                }
            })
        });

        if (response.status === 401) {
            console.error("ElevenLabs 401: Your API key is invalid. Check for typos or extra spaces.");
            return;
        }

        if (!response.ok) {
            const err = await response.json();
            console.error("ElevenLabs Error:", err);
            return;
        }

        const audioBlob = await response.blob();
        this.playAudio(audioBlob);
    }

    playAudio(blob) {
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        this.isSpeaking = true;
        audio.play();

        audio.onended = () => {
            this.isSpeaking = false;
            URL.revokeObjectURL(audioUrl); // Cleanup
        };
    }
}