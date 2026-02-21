goal.x = 1800;
goal.y = groundLevel - 92;

// Level progression
let currentLevel = 1;
let maxUnlockedLevel = 1;

// Win animation state
let winGlow = 0;
let winFade = 0;
let winPhase = 'none'; // 'none' | 'glow' | 'fade' | 'done'

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

function showWinScreen() {
    // Snap NPC to center of the door
    npc.x = goal.x + goal.width / 2 - npc.width / 2;
    npc.y = goal.y + goal.height - npc.height;
    npc.velocityX = 0;
    npc.velocityY = 0;
    winPhase = 'glow';
    winGlow = 0;
    winFade = 0;
}

function unlockNextLevel() {
    if (currentLevel >= maxUnlockedLevel) {
        maxUnlockedLevel = Math.min(currentLevel + 1, 8);
    }
    // Update button states in the DOM
    document.querySelectorAll('.level-btn').forEach(function (btn) {
        const lvl = parseInt(btn.getAttribute('data-level'));
        if (lvl <= maxUnlockedLevel) {
            btn.classList.remove('locked');
        }
    });
}

function showLevelSelect() {
    unlockNextLevel();
    const ls = document.getElementById('level-select');
    ls.style.display = 'flex';
    ls.style.opacity = '0';
    requestAnimationFrame(function () {
        ls.style.opacity = '1';
    });
}

function hideLevelSelect() {
    const ls = document.getElementById('level-select');
    ls.style.opacity = '0';
    setTimeout(function () {
        ls.style.display = 'none';
    }, 800);
}

function resetGame() {
    isLevelComplete = false;
    winPhase = 'none';
    winGlow = 0;
    winFade = 0;
    npc.x = 50;
    npc.y = 140;
    npc.velocityX = 0;
    npc.velocityY = 0;
    npc.stamina = 100;
    npc.isGrounded = false;
    npc.onMouse = false;
    npc.state = 'SEEKING';
    cameraX = 0;
}

// Level select button handlers
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.level-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.classList.contains('locked')) return;
            currentLevel = parseInt(btn.getAttribute('data-level'));
            hideLevelSelect();
            setTimeout(function () {
                resetGame();
                gameLoop();
            }, 900);
        });
    });
});

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

    // Draw the Goal (exit door)
    if (exitDoorImg.complete && exitDoorImg.naturalWidth > 0) {
        ctx.drawImage(exitDoorImg, goal.x, goal.y, goal.width, goal.height);
    } else {
        ctx.fillStyle = 'red';
        ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
    }

    // Door glow effect during win
    if (winPhase === 'glow' || winPhase === 'fade') {
        ctx.save();
        const glowAlpha = Math.min(winGlow, 1);
        const cx = goal.x + goal.width / 2;
        const cy = goal.y + goal.height / 2;
        const radius = 80 + winGlow * 40;
        const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
        glow.addColorStop(0, 'rgba(255, 255, 255, ' + (glowAlpha * 0.9) + ')');
        glow.addColorStop(0.5, 'rgba(255, 255, 255, ' + (glowAlpha * 0.4) + ')');
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    if (!isLevelComplete) {
        npc.update(goal.x);
    }
    npc.draw();

    drawForegroundPlatforms();

    drawForeground2();

    // --- WIN CONDITION CHECK ---
    if (!isLevelComplete &&
        npc.x + npc.width > goal.x &&
        npc.x < goal.x + goal.width &&
        npc.y + npc.height > goal.y &&
        npc.y < goal.y + goal.height) {

        isLevelComplete = true;
        showWinScreen();
    }

    ctx.restore();

    // Full-screen white fade overlay (drawn outside world-space transform)
    if (winPhase === 'fade') {
        ctx.save();
        ctx.globalAlpha = Math.min(winFade, 1);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // Advance win animation
    if (winPhase === 'glow') {
        winGlow += 0.02;
        if (winGlow >= 1) {
            winPhase = 'fade';
        }
    } else if (winPhase === 'fade') {
        winFade += 0.02;
        if (winFade >= 1) {
            winPhase = 'done';
            showLevelSelect();
            return; // Stop the game loop
        }
    }

    if (winPhase !== 'done') {
        requestAnimationFrame(gameLoop);
    }
}

// gameLoop() is called by start-screen.js after the intro sequence
