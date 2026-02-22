goal.x = 1800;
goal.y = groundLevel - 92;

// Level progression (per-biome)
let currentLevel = 1;
let maxUnlockedLevel = { cave: 1, forest: 1, mountain: 1 };

// Win animation state
let winGlow = 0;
let winFade = 0;
let winPhase = 'none'; // 'none' | 'glow' | 'fade' | 'done'

// Delta-time: keeps game speed constant regardless of frame rate
let lastFrameTime = 0;
let dt = 1; // 1 = perfect 60fps frame, 2 = running at 30fps, etc.

// Pause state
let gamePaused = false;

// --- Standard parallax tiling (cave) ---
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

    const numLevels = 4;
    const sectionSrcW = img.naturalWidth / numLevels;
    const sectionSrcStart = (currentLevel - 1) * sectionSrcW;

    // Scale section to screen height, ensuring it's at least canvas-wide
    const scale = canvas.height / img.naturalHeight;
    let sectionDrawW = sectionSrcW * scale;
    if (sectionDrawW < canvas.width) sectionDrawW = canvas.width;

    // Clamp scroll so the section always covers the visible area:
    //   drawX=0 at start (left edge aligned), drawX=-maxScroll at end (right edge aligned)
    const maxScroll = sectionDrawW - canvas.width;
    const drawX = Math.max(-maxScroll, Math.min(0, -cameraX * parallaxFactor));

    ctx.drawImage(img,
        sectionSrcStart, 0, sectionSrcW, img.naturalHeight,
        drawX, 0, sectionDrawW, canvas.height
    );
}

// --- Biome-aware parallax dispatcher ---
function drawBiomeParallaxLayer(img, parallaxFactor) {
    const biomeName = biomeList[currentBiomeIndex];
    if (biomeName === 'mountain') {
        drawMountainLayer(img, parallaxFactor);
    } else if (biomeName === 'forest') {
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

    const totalW = levelWidth + canvas.width;
    const totalH = canvas.height;

    if (levelHole.length > 0) {
        // Draw foreground with holes cut out using even-odd clipping
        ctx.save();
        ctx.beginPath();
        // Outer rect (clockwise)
        ctx.moveTo(0, 0);
        ctx.lineTo(totalW, 0);
        ctx.lineTo(totalW, totalH);
        ctx.lineTo(0, totalH);
        ctx.closePath();
        // Each hole rect (counter-clockwise to subtract)
        levelHole.forEach(h => {
            ctx.moveTo(h.x, 0);
            ctx.lineTo(h.x, totalH);
            ctx.lineTo(h.x + h.w, totalH);
            ctx.lineTo(h.x + h.w, 0);
            ctx.closePath();
        });
        ctx.clip('evenodd');
        ctx.drawImage(img, 0, 0, totalW, totalH);
        ctx.restore();
    } else {
        ctx.drawImage(img, 0, 0, totalW, totalH);
    }
}

// --- Foreground 2 overlay (in front of player, world space) ---
function drawOverlayLayer() {
    const biome = getCurrentBiome();
    const img = biome.foreground2;
    if (!img.complete || img.naturalWidth === 0) return;

    const totalW = levelWidth + canvas.width;
    const totalH = canvas.height;

    ctx.save();
    // Use globalAlpha only — ctx.filter is extremely expensive and causes lag
    if (biomeList[currentBiomeIndex] === 'cave') {
        ctx.globalAlpha = 0.3;
    } else if (biomeList[currentBiomeIndex] === 'forest') {
        ctx.globalAlpha = 0.25;
    } else {
        ctx.globalAlpha = 0.45;
    }

    if (levelHole.length > 0) {
        // Draw overlay with holes cut out using even-odd clipping
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(totalW, 0);
        ctx.lineTo(totalW, totalH);
        ctx.lineTo(0, totalH);
        ctx.closePath();
        levelHole.forEach(h => {
            ctx.moveTo(h.x, 0);
            ctx.lineTo(h.x, totalH);
            ctx.lineTo(h.x + h.w, totalH);
            ctx.lineTo(h.x + h.w, 0);
            ctx.closePath();
        });
        ctx.clip('evenodd');
    }

    ctx.drawImage(img, 0, 0, totalW, totalH);
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
    // Show "Tutorial" label only on caves biome
    const tutLabel = document.querySelector('.tutorial-label');
    if (tutLabel) {
        tutLabel.style.display = (biome === 'cave') ? 'block' : 'none';
    }
}

function unlockNextLevel() {
    const biome = biomeList[currentBiomeIndex];
    if (currentLevel >= maxUnlockedLevel[biome]) {
        maxUnlockedLevel[biome] = Math.min(currentLevel + 1, 4);
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
    updateLevelButtons();
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
    lastFrameTime = 0; // reset so first frame gets dt=1
    npc.x = 50;
    npc.velocityX = 0;
    npc.velocityY = 0;
    npc.stamina = 100;
    npc.isGrounded = true;
    npc.onMouse = false;
    npc.state = 'IDLE';
    npc.waitTimer = 90; // ~1.5 seconds at 60fps before NPC starts running
    npc.animFrame = 0;
    npc.animTimer = 0;
    npc.facingRight = true;
    cameraX = 0;

    // Adjust ground level per biome so sprite sits on the terrain art
    const biomeName = biomeList[currentBiomeIndex];
    const biomeGroundOffset = (biomeName === 'mountain') ? 20 : (biomeName === 'cave') ? 20 : 0;
    const platY = groundLevel + biomeGroundOffset;

    // Reset walls
    walls.length = 0;

    // Set up platforms and hole based on biome/level
    if (biomeName === 'cave' && currentLevel === 1) {
        const holeStart = 900;
        const holeWidth = 200;
        levelHole = [{ x: holeStart, w: holeWidth }];
        platforms.length = 0;
        platforms.push(
            { x: 0, y: platY, w: holeStart, h: 60 },
            { x: holeStart + holeWidth, y: platY, w: levelWidth - holeStart - holeWidth, h: 60 }
        );
        goal.x = 1800;
        goal.y = platY - goal.height;
    } else if (biomeName === 'cave' && currentLevel === 3) {
        // Complex level: multiple platforms, holes, a wall, elevated platforms
        levelHole = [
            { x: 300, w: 200 },
            { x: 750, w: 150 },
            { x: 1150, w: 250 },
            { x: 1600, w: 150 }
        ];
        platforms.length = 0;
        platforms.push(
            // Ground-level platforms
            { x: 0, y: platY, w: 300, h: 60 },
            { x: 500, y: platY, w: 250, h: 60 },
            { x: 900, y: platY, w: 250, h: 60 },
            { x: 1400, y: platY, w: 200, h: 60 },
            { x: 1750, y: platY, w: 250, h: 60 },
            // Elevated platforms (ascending to goal)
            { x: 1150, y: 280, w: 130, h: 20 },
            { x: 1450, y: 200, w: 180, h: 20 },
            { x: 1780, y: 130, w: 220, h: 20 }
        );
        walls.push({ x: 1300, y: 150, w: 50, h: platY - 150 });
        goal.x = 1850;
        goal.y = 130 - goal.height;
    } else {
        levelHole = [];
        platforms.length = 0;
        platforms.push({ x: 0, y: platY, w: levelWidth, h: 60 });
        goal.x = 1800;
        goal.y = platY - goal.height;
    }

    npc.y = platY - npc.height;

    // Boundary walls: left edge and right edge (past the door)
    walls.push({ x: -50, y: -500, w: 50, h: 2000, boundary: true });
    walls.push({ x: goal.x + goal.width + 120, y: -500, w: 50, h: 2000, boundary: true });

    // Load danger blocks for this level
    dangerBlocks = getLevelDangerBlocks(biomeName, currentLevel).map(b => initDangerBlock(Object.assign({}, b)));
}

// Level select button handlers
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.level-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.classList.contains('locked')) return;
            currentLevel = parseInt(btn.getAttribute('data-level'));
            hideLevelSelect();
            setTimeout(function () {
                document.querySelector('.game-container').style.visibility = 'visible';
                resetGame();
                gameLoop();
            }, 900);
        });
    });

    // Biome navigation arrows
    document.getElementById('biome-left').addEventListener('click', function () { switchBiome(-1); });
    document.getElementById('biome-right').addEventListener('click', function () { switchBiome(1); });
    updateBiomeArrows();

    // Dev button: unlock all levels in every biome
    document.getElementById('dev-unlock-btn').addEventListener('click', function () {
        biomeList.forEach(function (b) { maxUnlockedLevel[b] = 4; });
        updateLevelButtons();
    });

    // Pause button
    document.getElementById('pause-btn').addEventListener('click', function () {
        gamePaused = true;
        document.getElementById('pause-menu').style.display = 'flex';
        document.getElementById('pause-btn').style.display = 'none';
    });

    // Resume button
    document.getElementById('resume-btn').addEventListener('click', function () {
        gamePaused = false;
        lastFrameTime = 0; // reset so first frame after unpause gets dt=1
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('pause-btn').style.display = '';
    });

    // Return to menu button
    document.getElementById('menu-btn').addEventListener('click', function () {
        gamePaused = false;
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('pause-btn').style.display = '';
        document.querySelector('.game-container').style.visibility = 'hidden';
        showLevelSelect();
    });
});

// Draw a cave-styled block (for elevated platforms and walls)
function drawCaveBlock(x, y, w, h) {
    // Dark indigo/purple rock body matching cave foreground
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#2d2840');
    grad.addColorStop(0.4, '#1a1928');
    grad.addColorStop(1, '#0d0c14');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Subtle rocky texture: faint horizontal bands
    ctx.fillStyle = 'rgba(60, 50, 80, 0.15)';
    for (let ty = y + 8; ty < y + h - 4; ty += 7) {
        ctx.fillRect(x + 2, ty, w - 4, 2);
    }

    // Lighter top edge highlight (subtle purple glow like light hitting rock)
    ctx.fillStyle = '#35305a';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = '#413a66';
    ctx.fillRect(x + 1, y, w - 2, 1);

    // Dark outline
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// Draw elevated platforms and walls as visible blocks
function drawLevelBlocks() {
    const biomeName = biomeList[currentBiomeIndex];
    const biomeGroundOffset = (biomeName === 'mountain') ? 20 : (biomeName === 'cave') ? 20 : 0;
    const platY = groundLevel + biomeGroundOffset;
    // Draw elevated platforms (non-ground-level)
    platforms.forEach(p => {
        if (p.y !== platY) {
            drawCaveBlock(p.x, p.y, p.w, p.h);
        }
    });
    // Draw walls (skip invisible boundary walls)
    walls.forEach(w => {
        if (!w.boundary) drawCaveBlock(w.x, w.y, w.w, w.h);
    });
}

function gameLoop(timestamp) {
    if (gamePaused) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Compute delta-time (normalized so dt=1 at 60fps)
    if (!timestamp) timestamp = performance.now();
    if (lastFrameTime === 0) lastFrameTime = timestamp;
    const elapsed = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    dt = elapsed / (1000 / 60);
    if (dt > 3) dt = 3;   // cap after tab-switch or long pause
    if (dt < 0.1) dt = 0.1; // floor to avoid near-zero

    // --- UPDATE PHASE (all logic before any drawing) ---

    // Convert screen-space mouse to world-space using previous frame's camera
    mouse.lastX = mouse.x;
    mouse.lastY = mouse.y;
    mouse.x = mouse.screenX + cameraX;
    // Clamp shadow platform so it cannot go below the ground surface
    const biomeName_loop = biomeList[currentBiomeIndex];
    const groundSurface = groundLevel + ((biomeName_loop === 'mountain' || biomeName_loop === 'cave') ? 20 : 0);
    if (mouse.screenY > groundSurface) mouse.screenY = groundSurface;
    mouse.y = mouse.screenY;
    mouse.velX = mouse.x - mouse.lastX;
    mouse.velY = mouse.y - mouse.lastY;

    if (!isLevelComplete) {
        if (deathAnimating) {
            updateDeathParticles();
            deathTimer -= dt;
            if (deathTimer <= 0) {
                deathAnimating = false;
                deathParticles = [];
                resetGame();
            }
        } else {
            dangerBlocks.forEach(updateDangerBlock);
            npc.update(goal.x);
        }
    }

    // Update camera AFTER NPC so both use the same position this frame
    if (!deathAnimating) {
        const targetCam = Math.max(0, npc.x - 200);
        if (npc.onMouse) {
            // Smooth camera follow while carrying to prevent feedback oscillation
            cameraX += (targetCam - cameraX) * 0.08;
        } else {
            cameraX = targetCam;
        }
        cameraX = Math.round(cameraX);
    }

    // --- WIN CONDITION CHECK (before drawing so win visuals appear immediately) ---
    if (!isLevelComplete &&
        npc.x + npc.width > goal.x &&
        npc.x < goal.x + goal.width &&
        npc.y + npc.height > goal.y &&
        npc.y < goal.y + goal.height) {

        isLevelComplete = true;
        unlockNextLevel();
        showWinScreen();
    }

    // --- DRAW PHASE ---

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

    // 3.5. Draw elevated platforms and walls
    drawLevelBlocks();

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

    // Draw danger blocks (behind NPC, in world space)
    dangerBlocks.forEach(drawDangerBlock);

    npc.draw();

    // Death explosion particles (world space)
    if (deathAnimating) {
        drawDeathParticles();
    }

    // 4. Foreground 2 overlay (in front of player)
    drawOverlayLayer();

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
        winGlow += 0.02 * dt;
        if (winGlow >= 1) {
            winPhase = 'fade';
        }
    } else if (winPhase === 'fade') {
        winFade += 0.02 * dt;
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
