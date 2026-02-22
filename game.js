function drawParallaxLayer(img, parallaxFactor) {
    if (!img.complete || img.naturalWidth === 0) return;
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
            ctx.fillStyle = '#555'; 
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }
    });
}

function gameLoop() {
    // Camera follows NPC with a slight offset
    cameraX = npc.x - 200;
    if (cameraX < 0) cameraX = 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. BACKGROUNDS
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawParallaxLayer(caveBackgroundImg, 0.2);
    drawParallaxLayer(caveMiddlegroundImg, 0.5);

    // 2. WORLD SPACE
    ctx.save();
    ctx.translate(-cameraX, 0);

    // Goal
    ctx.fillStyle = 'red';
    ctx.fillRect(goal.x, goal.y, goal.size, goal.size);

    if (!isLevelComplete) {
        npc.update(goal.x);
    }
    npc.draw();
    drawForegroundPlatforms();

    // 3. WIN CONDITION
    if (!isLevelComplete &&
        npc.x + npc.width > goal.x &&
        npc.x < goal.x + goal.size &&
        npc.y + npc.height > goal.y &&
        npc.y < goal.y + goal.size) {

        isLevelComplete = true;
        narrator.trigger("The NPC reached the goal! You actually did it.");
        if (typeof showWinScreen === 'function') showWinScreen();
    }

    ctx.restore();

    // 4. OVERLAY (Foreground 2 stays on top)
    if (caveForegroundImg2.complete) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.drawImage(caveForegroundImg2, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    requestAnimationFrame(gameLoop);
}

// Start Game
gameLoop();