function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        const wrist = hand[0];
        const indexTip = hand[8];
        const indexKnuckle = hand[5];

        // Robust fist detection: Tip is "lower" (higher Y) than the knuckle
        mouse.isLocked = indexTip.y > indexKnuckle.y;

        if (!mouse.isLocked) {
            const knuckle = hand[9];
            const targetX = (1 - ((wrist.x + knuckle.x) / 2)) * canvas.width;
            const targetY = ((wrist.y + knuckle.y) / 2) * canvas.height;

            mouse.lastX = mouse.x;
            mouse.lastY = mouse.y;
            
            const smoothing = 0.1;
            mouse.x += (targetX - (mouse.width / 2) - mouse.x) * smoothing;
            mouse.y += (targetY - mouse.y) * smoothing;

            mouse.velX = mouse.x - mouse.lastX;
            mouse.velY = mouse.y - mouse.lastY;
        } 
        // We don't need to force stillTimer here anymore because 
        // we are going to use isLocked directly in the NPC logic
        mouse.active = true;
    } else {
        mouse.active = false;
        mouse.isLocked = false;
    }
}

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
});
camera.start();