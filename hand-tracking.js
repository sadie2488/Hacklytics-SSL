function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        const wrist = hand[0];
        const knuckle = hand[5];
        const indexTip = hand[8];
        const indexKnuckle = hand[5];

        // Fist Detection: Tip is "lower" (higher Y value) than the knuckle
        const isFist = indexTip.y > indexKnuckle.y;
        
        // Solidify platform when fist is closed
        mouse.isLocked = isFist;
        
        // Only allow the hand to be "active" if the NPC has some stamina
        if (npc.stamina > 10) { 
            mouse.active = true;
            
        } else {
            mouse.active = false;
        }


        // --- Inside your onResults function ---
        if (!mouse.isLocked) {
            // Sensitivity > 1 means less physical hand movement covers more screen
            const sensitivity = 1.5;
            const handX = 1 - ((wrist.x + knuckle.x) / 2);
            const handY = (wrist.y + knuckle.y) / 2;
            const targetX = (0.5 + (handX - 0.5) * sensitivity) * canvas.width;
            const targetY = (0.5 + (handY - 0.5) * sensitivity) * canvas.height;

            const smoothing = 0.5;
            // Store screen-space position (no cameraX here — converted to world-space in game loop)
            mouse.screenX += (targetX - (mouse.width / 2) - mouse.screenX) * smoothing;
            mouse.screenY += (targetY - mouse.screenY) * smoothing;
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
    modelComplexity: 0,          // lite model — much faster, minimal quality loss
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.4    // slightly lower to reduce re-detection stalls
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 320,
    height: 240
});
camera.start();
