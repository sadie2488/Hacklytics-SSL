goal.x = 1800;
goal.y = groundLevel - 92;

// Level progression (per-biome)
let currentLevel = 1;
let maxUnlockedLevel = { cave: 1, forest: 1, mountain: 1 };

// Win animation state
let winGlow = 0;
let winFade = 0;
let winPhase = 'none'; // 'none' | 'glow' | 'fade' | 'done'

// --- Standard parallax tiling (cave) ---
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

// --- Forest: ping-pong mirror tiling for seamless blending ---
function drawForestParallaxLayer(img, parallaxFactor) {
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return;

    const dh = canvas.height;
    const dw = (img.naturalWidth / img.naturalHeight) * dh;

    // How far the layer has scrolled (positive value)
    const offset = cameraX * parallaxFactor;
    // Which tile sits at the left edge of the screen
    const firstTile = Math.floor(offset / dw);
    // How far into that tile the screen starts
    const startX = -(offset - firstTile * dw);

    let tileIndex = firstTile;
    for (let x = startX; x < canvas.width; x += dw) {
        ctx.save();
        if (tileIndex % 2 === 1) {
            // Mirror this tile so edges blend seamlessly
            ctx.translate(x + dw, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, dw, dh);
        } else {
            ctx.drawImage(img, x, 0, dw, dh);
        }
        ctx.restore();
        tileIndex++;
    }
}

// --- Mountain: section-based viewport per level ---
function drawMountainLayer(img, parallaxFactor) {
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return;

    const numLevels = 8;
    const sectionSrcW = img.naturalWidth / numLevels;
    const sectionSrcStart = (currentLevel - 1) * sectionSrcW;

    // Scale section to screen, maintaining aspect ratio
    const scale = canvas.height / img.naturalHeight;
    const sectionDrawW = sectionSrcW * scale;

    // Apply parallax scrolling within the section
    const drawX = -cameraX * parallaxFactor;

    ctx.drawImage(img,
        sectionSrcStart, 0, sectionSrcW, img.naturalHeight,
        drawX, 0, sectionDrawW, canvas.height
    );
}

// --- Biome-aware parallax dispatcher ---
function drawBiomeParallaxLayer(img, parallaxFactor) {
    const biomeName = biomeList[currentBiomeIndex];
    if (biomeName === 'mountain' || biomeName === 'forest') {
        drawForestParallaxLayer(img, parallaxFactor);
    } else {
        drawParallaxLayer(img, parallaxFactor);
    }
}

// --- Foreground layer (behind player, world space) ---
function drawForegroundLayer() {
    const biome = getCurrentBiome();
    const img = biome.foreground;
    if (!img.complete || img.naturalWidth === 0) return;

    // Extend past the door for a cleaner look on all biomes
    ctx.drawImage(img, 0, 0, levelWidth + canvas.width, canvas.height);
}

// --- Foreground 2 overlay (in front of player, world space) ---
function drawOverlayLayer() {
    const biome = getCurrentBiome();
    const img = biome.foreground2;
    if (!img.complete || img.naturalWidth === 0) return;

    ctx.save();
    if (biomeList[currentBiomeIndex] === 'cave') {
        ctx.globalAlpha = 0.55;
        ctx.filter = 'brightness(0.7) saturate(0.5)';
    } else if (biomeList[currentBiomeIndex] === 'forest') {
        ctx.globalAlpha = 0.55;
        ctx.filter = 'brightness(0.5)';
    } else {
        ctx.globalAlpha = 0.65;
    }
    ctx.drawImage(img, 0, 0, levelWidth + canvas.width, canvas.height);
    ctx.restore();
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

function updateLevelButtons() {
    const biome = biomeList[currentBiomeIndex];
    document.querySelectorAll('.level-btn').forEach(function (btn) {
        const lvl = parseInt(btn.getAttribute('data-level'));
        if (lvl <= maxUnlockedLevel[biome]) {
            btn.classList.remove('locked');
        } else {
            btn.classList.add('locked');
        }
    });
}

function unlockNextLevel() {
    const biome = biomeList[currentBiomeIndex];
    if (currentLevel >= maxUnlockedLevel[biome]) {
        maxUnlockedLevel[biome] = Math.min(currentLevel + 1, 8);
    }
    updateLevelButtons();
}

function updateBiomeArrows() {
    const leftBtn = document.getElementById('biome-left');
    const rightBtn = document.getElementById('biome-right');
    leftBtn.style.opacity = (currentBiomeIndex === 0) ? '0.2' : '1';
    leftBtn.style.pointerEvents = (currentBiomeIndex === 0) ? 'none' : 'auto';
    rightBtn.style.opacity = (currentBiomeIndex === biomeList.length - 1) ? '0.2' : '1';
    rightBtn.style.pointerEvents = (currentBiomeIndex === biomeList.length - 1) ? 'none' : 'auto';
}

function switchBiome(delta) {
    const newIndex = currentBiomeIndex + delta;
    if (newIndex < 0 || newIndex >= biomeList.length) return;
    currentBiomeIndex = newIndex;
    const biome = biomeList[currentBiomeIndex];
    document.getElementById('biome-name').textContent = '- ' + biomeNames[biome] + ' -';
    document.getElementById('level-select').style.background = biomeMenuBgs[biome];
    updateBiomeArrows();
    updateLevelButtons();
}

function showLevelSelect() {
    unlockNextLevel();
    const ls = document.getElementById('level-select');
    ls.style.background = biomeMenuBgs[biomeList[currentBiomeIndex]];
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
    npc.velocityX = 0;
    npc.velocityY = 0;
    npc.stamina = 100;
    npc.isGrounded = false;
    npc.onMouse = false;
    npc.state = 'SEEKING';
    npc.animFrame = 0;
    npc.animTimer = 0;
    npc.facingRight = true;
    cameraX = 0;

    // Adjust ground level per biome so sprite sits on the terrain art
    const biomeName = biomeList[currentBiomeIndex];
    const biomeGroundOffset = (biomeName === 'mountain') ? 20 : (biomeName === 'cave') ? 40 : 0;
    platforms[0].y = groundLevel + biomeGroundOffset;
    goal.y = platforms[0].y - goal.height;
    npc.y = platforms[0].y - npc.height;
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

    // Biome navigation arrows
    document.getElementById('biome-left').addEventListener('click', function () { switchBiome(-1); });
    document.getElementById('biome-right').addEventListener('click', function () { switchBiome(1); });
    updateBiomeArrows();
});

function gameLoop() {
    cameraX = npc.x - 200;
    if (cameraX < 0) cameraX = 0;

    const biome = getCurrentBiome();
    const biomeName = biomeList[currentBiomeIndex];

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Background fill + parallax layers (screen space)
    ctx.fillStyle = biomeFills[biomeName];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBiomeParallaxLayer(biome.background, 0.2);
    drawBiomeParallaxLayer(biome.middleground, 0.5);

    // 2. WORLD SPACE (Camera affects these)
    ctx.save();
    ctx.translate(-cameraX, 0);

    // 3. Foreground layer (behind player)
    drawForegroundLayer();

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

    // 4. Foreground 2 overlay (in front of player)
    drawOverlayLayer();

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
