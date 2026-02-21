goal.x = 1800; // Move goal further right
goal.y = 320;

function drawParallaxLayer(img, parallaxFactor) {
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return;

    const drawHeight = canvas.height;
    const drawWidth = (img.naturalWidth / img.naturalHeight) * drawHeight;
    let startX = (-cameraX * parallaxFactor) % drawWidth;

    if (startX > 0) startX -= drawWidth;

    for (let x = startX; x < canvas.width; x += drawWidth) {
        ctx.drawImage(img, x, 0, drawWidth, drawHeight);
    }
}

function drawForegroundPlatforms() {
    platforms.forEach(p => {
        if (caveForegroundImg.complete && caveForegroundImg.naturalWidth > 0) {
            ctx.drawImage(caveForegroundImg, p.x, p.y, p.w, p.h);
        } else {
            // If the image fails, use a "Rock" color so it's not black-on-black
            ctx.fillStyle = '#555'; 
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }
    });
}

function drawForeground2() {
    if (caveForegroundImg2.complete && caveForegroundImg2.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.drawImage(caveForegroundImg2, 0, 0, levelWidth, canvas.height);
        ctx.restore();
    }
}

// --- In game.js ---
function gameLoop() {
    cameraX = npc.x - 200;
    if (cameraX < 0) cameraX = 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. BACK LAYERS (Static & Parallax)
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawParallaxLayer(caveBackgroundImg, 0.2);
    drawParallaxLayer(caveMiddlegroundImg, 0.5);

    // 2. PARALLAX LAYERS
    drawParallaxLayer(caveBackgroundImg, 0.2);
    drawParallaxLayer(caveMiddlegroundImg, 0.5);


    // 3. WORLD SPACE (Camera affects these)
    ctx.save();
    ctx.translate(-cameraX, 0);
    // Draw the Goal
    ctx.fillStyle = 'red';
    ctx.fillRect(goal.x, goal.y, goal.size, goal.size);

    if (!isLevelComplete) {
        npc.update(goal.x);
    }
    npc.draw();

    drawForegroundPlatforms();

    drawForeground2();

    // --- WIN CONDITION CHECK (after foregrounds are drawn) ---
    if (!isLevelComplete &&
        npc.x + npc.width > goal.x &&
        npc.x < goal.x + goal.size &&
        npc.y + npc.height > goal.y &&
        npc.y < goal.y + goal.size) {

        isLevelComplete = true;
        if (typeof showWinScreen === 'function') showWinScreen();
    }

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

gameLoop();
