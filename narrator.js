class Narrator {
    constructor() {
        this.audioQueue = [];
        this.isSpeaking = false;
        this.lastEventTime = 0;
        this.cooldown = 10000; // Minimum 3 seconds between new generations
        
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