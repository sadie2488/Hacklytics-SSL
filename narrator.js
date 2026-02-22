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

    // Replace your old generateText method
    async generateText(context) {
    // Call your Vercel proxy instead of the Gemini API directly
    const response = await fetch('/api/generateText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context })
    });

    if (!response.ok) {
        console.error("Vercel Proxy Error");
        return null;
    }

    const data = await response.json();
    return data.text;
}

    // Replace your old generateAudio method
    async generateAudio(text) {
        const response = await fetch('/api/generateAudio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        const blob = await response.blob();
        this.playAudio(blob);
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