goal.x = 1800;
goal.y = groundLevel - 92;

// Level progression (per-biome)
// maxUnlockedLevel goes up to 5: 1-4 = next unlocked level, 5 = biome fully completed
let currentLevel = 1;
let maxUnlockedLevel = { cave: 1, forest: 1, mountain: 1, finale: 1 };
let devMode = false;

// Win animation state
let winGlow = 0;
let winFade = 0;
let winPhase = 'none'; // 'none' | 'glow' | 'fade' | 'done'

// Delta-time: keeps game speed constant regardless of frame rate
let lastFrameTime = 0;
let dt = 1; // 1 = perfect 60fps frame, 2 = running at 30fps, etc.

// Pause state
let gamePaused = false;

// Tutorial state
let tutorialPlaying = false;
let tutorialAudio = null;

// Subtitle timings — adjust text and start/end (seconds) to match tutorial.mp3
const tutorialSubtitles = [
    { start: 0, end: 4, text: "Welcome to A Spark in the Dark." },
    { start: 4, end: 7, text: "Move your open hand to control the shadow" },
    { start: 7, end: 10, text: "and pick up Ember the Spark." },
    { start: 10, end: 13, text: "Close your fist to solidify the platform" },
    { start: 13, end: 15, text: "and make Ember jump." },
    { start: 15, end: 19, text: "Make sure she doesn't fall into the pit" },
    { start: 19, end: 22, text: "and get her to the gates safely." },
    { start: 22, end: 25, text: "Good luck on your travels." }
];

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

const endOfLevelAudio = new Audio('Assets/end_of_level.mp3');
endOfLevelAudio.volume = 0.35;

function showWinScreen() {
    // Snap NPC to center of the door
    npc.x = goal.x + goal.width / 2 - npc.width / 2;
    npc.y = goal.y + goal.height - npc.height;
    npc.velocityX = 0;
    npc.velocityY = 0;
    winPhase = 'glow';
    winGlow = 0;
    winFade = 0;
    endOfLevelAudio.currentTime = 0;
    endOfLevelAudio.play().catch(function () {});
}

function updateLevelButtons() {
    const biome = biomeList[currentBiomeIndex];
    const isFinale = biome === 'finale';
    const grid = document.querySelector('.level-grid');

    if (isFinale) {
        grid.classList.add('finale-grid');
    } else {
        grid.classList.remove('finale-grid');
    }

    document.querySelectorAll('.level-btn').forEach(function (btn, index) {
        const lvl = parseInt(btn.getAttribute('data-level'));
        if (isFinale) {
            if (index === 0) {
                btn.classList.remove('locked');
                btn.classList.add('finale-gold');
                btn.style.display = '';
            } else {
                btn.style.display = 'none';
            }
        } else {
            btn.style.display = '';
            btn.classList.remove('finale-gold');
            if (lvl <= maxUnlockedLevel[biome]) {
                btn.classList.remove('locked');
            } else {
                btn.classList.add('locked');
            }
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
        maxUnlockedLevel[biome] = Math.min(currentLevel + 1, 5); // 5 = biome complete
    }
    updateLevelButtons();
    updateBiomeArrows();
}

function updateBiomeArrows() {
    const leftBtn = document.getElementById('biome-left');
    const rightBtn = document.getElementById('biome-right');
    leftBtn.style.opacity = (currentBiomeIndex === 0) ? '0.2' : '1';
    leftBtn.style.pointerEvents = (currentBiomeIndex === 0) ? 'none' : 'auto';

    // Lock right arrow if at last biome OR current biome isn't fully completed (unless dev mode)
    const currentBiome = biomeList[currentBiomeIndex];
    const atEnd = currentBiomeIndex === biomeList.length - 1;
    const biomeComplete = devMode || maxUnlockedLevel[currentBiome] >= 5;
    const lockRight = atEnd || !biomeComplete;
    rightBtn.style.opacity = lockRight ? '0.2' : '1';
    rightBtn.style.pointerEvents = lockRight ? 'none' : 'auto';
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
        // Spider & Bramble Gauntlet: ground brambles force jumping, spiders guard the gaps
        levelHole = [
            { x: 400, w: 150 },   // Gap 1 — spider overhead
            { x: 850, w: 200 },   // Gap 2 — wider, spider patrolling
            { x: 1400, w: 180 }   // Gap 3 — spider + bramble on landing
        ];
        platforms.length = 0;
        platforms.push(
            // Ground-level platforms (brambles sit on these)
            { x: 0,    y: platY, w: 400, h: 60 },   // Start — bramble at 280
            { x: 550,  y: platY, w: 300, h: 60 },   // Mid 1 — bramble at 750
            { x: 1050, y: platY, w: 350, h: 60 },   // Mid 2 — bramble at 1250
            { x: 1580, y: platY, w: 420, h: 60 }     // End — bramble at 1680, goal ahead
        );
        goal.x = 1900;
        goal.y = platY - goal.height;
    } else if (biomeName === 'forest' && currentLevel === 1) {
        // Gentle Path: one gap, a couple brambles
        levelHole = [
            { x: 700, w: 150 }
        ];
        platforms.length = 0;
        platforms.push(
            { x: 0,   y: platY, w: 700, h: 60 },
            { x: 850, y: platY, w: 1150, h: 60 }
        );
        goal.x = 1800;
        goal.y = platY - goal.height;
    } else if (biomeName === 'forest' && currentLevel === 2) {
        // Bramble Run: two gaps, brambles on landing platforms
        levelHole = [
            { x: 500, w: 180 },
            { x: 1050, w: 200 }
        ];
        platforms.length = 0;
        platforms.push(
            { x: 0,    y: platY, w: 500, h: 60 },
            { x: 680,  y: platY, w: 370, h: 60 },
            { x: 1250, y: platY, w: 750, h: 60 }
        );
        goal.x = 1800;
        goal.y = platY - goal.height;
    } else if (biomeName === 'forest' && currentLevel === 3) {
        // Thorny Crossing: three gaps with brambles on every platform
        levelHole = [
            { x: 350, w: 160 },
            { x: 750, w: 200 },
            { x: 1250, w: 180 }
        ];
        platforms.length = 0;
        platforms.push(
            { x: 0,    y: platY, w: 350, h: 60 },
            { x: 510,  y: platY, w: 240, h: 60 },
            { x: 950,  y: platY, w: 300, h: 60 },
            { x: 1430, y: platY, w: 570, h: 60 }
        );
        goal.x = 1850;
        goal.y = platY - goal.height;
    } else if (biomeName === 'forest' && currentLevel === 4) {
        // Gauntlet: four gaps, dense brambles, narrow platforms
        levelHole = [
            { x: 300, w: 150 },
            { x: 650, w: 180 },
            { x: 1050, w: 200 },
            { x: 1450, w: 160 }
        ];
        platforms.length = 0;
        platforms.push(
            { x: 0,    y: platY, w: 300, h: 60 },
            { x: 450,  y: platY, w: 200, h: 60 },
            { x: 830,  y: platY, w: 220, h: 60 },
            { x: 1250, y: platY, w: 200, h: 60 },
            { x: 1610, y: platY, w: 390, h: 60 }
        );
        goal.x = 1900;
        goal.y = platY - goal.height;
    } else if (biomeName === 'mountain' && currentLevel === 3) {
        // Icicle Passage: medium difficulty — 3 gaps with icicles dropping between platforms
        levelHole = [
            { x: 350, w: 180 },   // Gap 1 — icicle at x=480
            { x: 800, w: 200 },   // Gap 2 — icicle at x=950
            { x: 1300, w: 200 }   // Gap 3 — icicle at x=1450
        ];
        platforms.length = 0;
        platforms.push(
            { x: 0,    y: platY, w: 350, h: 60 },   // Start platform
            { x: 530,  y: platY, w: 270, h: 60 },   // Mid platform 1
            { x: 1000, y: platY, w: 300, h: 60 },   // Mid platform 2
            { x: 1500, y: platY, w: 500, h: 60 }     // End platform — safe runway to goal
        );
        goal.x = 1850;
        goal.y = platY - goal.height;
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

function startTutorial() {
    tutorialPlaying = true;
    document.getElementById('pause-btn').style.display = 'none';
    var overlay = document.getElementById('tutorial-overlay');
    var subtitleEl = document.getElementById('tutorial-subtitle');
    overlay.style.display = 'flex';
    subtitleEl.style.opacity = '0';

    tutorialAudio = new Audio('Assets/tutorial.mp3');

    tutorialAudio.addEventListener('timeupdate', function () {
        var t = tutorialAudio.currentTime;
        var activeText = '';
        for (var i = 0; i < tutorialSubtitles.length; i++) {
            if (t >= tutorialSubtitles[i].start && t < tutorialSubtitles[i].end) {
                activeText = tutorialSubtitles[i].text;
                break;
            }
        }
        if (activeText) {
            subtitleEl.textContent = activeText;
            subtitleEl.style.opacity = '1';
        } else {
            subtitleEl.style.opacity = '0';
        }
    });

    tutorialAudio.addEventListener('ended', function () {
        endTutorial();
    });

    tutorialAudio.play().catch(function () {
        // If audio fails, end tutorial after a short delay
        setTimeout(endTutorial, 3000);
    });

    gameLoop();
}

function endTutorial() {
    tutorialPlaying = false;
    var overlay = document.getElementById('tutorial-overlay');
    var subtitleEl = document.getElementById('tutorial-subtitle');
    subtitleEl.style.opacity = '0';
    setTimeout(function () {
        overlay.style.display = 'none';
    }, 500);
    document.getElementById('pause-btn').style.display = '';
    if (tutorialAudio) {
        tutorialAudio.pause();
        tutorialAudio = null;
    }
}

// Level select button handlers
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.level-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.classList.contains('locked')) return;
            currentLevel = parseInt(btn.getAttribute('data-level'));

            // Finale biome — launch cinematic instead of a game level
            if (biomeList[currentBiomeIndex] === 'finale') {
                hideLevelSelect();
                setTimeout(function () {
                    startFinaleSequence();
                }, 900);
                return;
            }

            hideLevelSelect();
            setTimeout(function () {
                document.querySelector('.game-container').style.visibility = 'visible';
                resetGame();
                // Cave level 1 is the tutorial — freeze and play tutorial audio first
                if (biomeList[currentBiomeIndex] === 'cave' && currentLevel === 1) {
                    startTutorial();
                } else {
                    gameLoop();
                }
            }, 900);
        });
    });

    // Biome navigation arrows
    document.getElementById('biome-left').addEventListener('click', function () { switchBiome(-1); });
    document.getElementById('biome-right').addEventListener('click', function () { switchBiome(1); });
    updateBiomeArrows();

    // Dev button: unlock all levels and biomes
    document.getElementById('dev-unlock-btn').addEventListener('click', function () {
        devMode = true;
        biomeList.forEach(function (b) { maxUnlockedLevel[b] = 5; });
        updateLevelButtons();
        updateBiomeArrows();
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
        if (tutorialPlaying) endTutorial();
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

// =============================================
// FINALE CINEMATIC SEQUENCE
// =============================================
function startFinaleSequence() {
    var overlay = document.getElementById('finale-overlay');
    overlay.style.display = 'block';

    var fCanvas = document.getElementById('finaleCanvas');
    fCanvas.width = window.innerWidth;
    fCanvas.height = window.innerHeight;
    var fCtx = fCanvas.getContext('2d');
    var W = fCanvas.width;
    var H = fCanvas.height;

    // Load resources
    var finaleImg = new Image();
    finaleImg.src = 'art/backgrounds/finale.png';
    var music = new Audio('Assets/The Dragon Boy (From Spirited Away Original Motion Picture Soundtrack).mp3');
    music.volume = 0.7;

    // Snow particles
    var snowParticles = [];

    // Animation state
    var currentScale = 1.8;
    var zoomSpeed = 0.0015;
    var creditsActive = false;
    var creditsY = H + 60;
    var darkenAlpha = 0;
    var fadeToBlack = 0;
    var fading = false;
    var musicFading = false;
    var lastTime = 0;

    // Credits content
    var creditLines = [
        { text: 'Thank you for playing', size: 24, italic: false, color: '#e8e0d0' },
        { text: 'A Spark in the Dark', size: 38, italic: true, color: '#ffd6a0' },
        { text: '', size: 20, spacer: true },
        { text: '', size: 20, spacer: true },
        { text: 'Programmed by', size: 17, italic: false, color: '#8a8aaa' },
        { text: 'Sarah Spellman, Shayaan Nesargi,', size: 21, italic: false, color: '#e8e0d0' },
        { text: 'and Lalitha Kantam', size: 21, italic: false, color: '#e8e0d0' },
        { text: '', size: 20, spacer: true },
        { text: 'Art done by', size: 17, italic: false, color: '#8a8aaa' },
        { text: 'Lalitha Kantam and Sarah Spellman', size: 21, italic: false, color: '#e8e0d0' },
        { text: '', size: 20, spacer: true },
        { text: 'Voices done by', size: 17, italic: false, color: '#8a8aaa' },
        { text: 'ElevenLabs', size: 21, italic: false, color: '#e8e0d0' },
        { text: '', size: 20, spacer: true },
        { text: 'Music by', size: 17, italic: false, color: '#8a8aaa' },
        { text: 'Joe Hisaishi', size: 21, italic: false, color: '#e8e0d0' },
        { text: '', size: 20, spacer: true },
        { text: '', size: 20, spacer: true },
        { text: 'We hope you enjoyed', size: 26, italic: false, color: '#e8e0d0' }
    ];

    // Calculate total credits height
    var totalCreditsH = 0;
    for (var i = 0; i < creditLines.length; i++) {
        totalCreditsH += creditLines[i].spacer ? 30 : creditLines[i].size + 28;
    }

    function spawnSnow() {
        if (snowParticles.length < 120) {
            snowParticles.push({
                x: Math.random() * W,
                y: -10,
                vx: (Math.random() - 0.5) * 0.8,
                vy: 0.5 + Math.random() * 1.5,
                size: 1 + Math.random() * 3,
                opacity: 0.3 + Math.random() * 0.5,
                wobble: Math.random() * Math.PI * 2
            });
        }
    }

    function updateSnow(frameDt) {
        for (var i = snowParticles.length - 1; i >= 0; i--) {
            var s = snowParticles[i];
            s.x += s.vx * frameDt;
            s.y += s.vy * frameDt;
            s.wobble += 0.02 * frameDt;
            s.x += Math.sin(s.wobble) * 0.3 * frameDt;
            if (s.y > H + 10) snowParticles.splice(i, 1);
        }
    }

    function drawSnow() {
        fCtx.save();
        fCtx.fillStyle = '#fff';
        for (var i = 0; i < snowParticles.length; i++) {
            var s = snowParticles[i];
            fCtx.globalAlpha = s.opacity;
            fCtx.beginPath();
            fCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            fCtx.fill();
        }
        fCtx.restore();
    }

    function drawCredits() {
        fCtx.save();
        fCtx.textAlign = 'center';
        var y = creditsY;
        for (var i = 0; i < creditLines.length; i++) {
            var line = creditLines[i];
            if (line.spacer) {
                y += 30;
                continue;
            }
            var fontStr = (line.italic ? 'italic ' : '') + line.size + 'px "Cinzel Decorative", serif';
            fCtx.font = fontStr;
            fCtx.fillStyle = line.color;
            fCtx.shadowColor = 'rgba(200, 200, 255, 0.3)';
            fCtx.shadowBlur = 10;
            fCtx.fillText(line.text, W / 2, y);
            y += line.size + 28;
        }
        fCtx.restore();
    }

    function animate(timestamp) {
        if (!timestamp) timestamp = performance.now();
        if (lastTime === 0) lastTime = timestamp;
        var elapsed = timestamp - lastTime;
        lastTime = timestamp;
        var frameDt = elapsed / (1000 / 60);
        if (frameDt > 3) frameDt = 3;
        if (frameDt < 0.1) frameDt = 0.1;

        fCtx.clearRect(0, 0, W, H);
        fCtx.fillStyle = '#000';
        fCtx.fillRect(0, 0, W, H);

        // Draw finale image at current zoom
        if (finaleImg.complete && finaleImg.naturalWidth > 0) {
            var imgW = finaleImg.naturalWidth;
            var imgH = finaleImg.naturalHeight;
            var baseScale = Math.max(W / imgW, H / imgH);
            var drawScale = baseScale * currentScale;
            var drawW = imgW * drawScale;
            var drawH = imgH * drawScale;
            var drawX = (W - drawW) / 2;
            var drawY = (H - drawH) / 2;
            fCtx.drawImage(finaleImg, drawX, drawY, drawW, drawH);
        }

        // Spawn and draw snow
        for (var s = 0; s < 2; s++) spawnSnow();
        updateSnow(frameDt);
        drawSnow();

        // Zoom out
        if (currentScale > 1.0) {
            currentScale -= zoomSpeed * frameDt;
            if (currentScale <= 1.0) {
                currentScale = 1.0;
                creditsActive = true;
            }
        }

        // Credits phase
        if (creditsActive) {
            // Fade in the 15% black overlay
            if (darkenAlpha < 0.65) {
                darkenAlpha += 0.003 * frameDt;
                if (darkenAlpha > 0.65) darkenAlpha = 0.65;
            }
            fCtx.save();
            fCtx.globalAlpha = darkenAlpha;
            fCtx.fillStyle = '#000';
            fCtx.fillRect(0, 0, W, H);
            fCtx.restore();

            drawCredits();
            creditsY -= 0.7 * frameDt;

            // Start fading once "We hope you enjoyed" reaches mid-screen
            if (creditsY + totalCreditsH < H / 2) {
                fading = true;
            }
        }

        // Fade to black
        if (fading) {
            fadeToBlack += 0.01 * frameDt;

            if (!musicFading) {
                musicFading = true;
                var fadeInt = setInterval(function () {
                    if (music.volume > 0.03) {
                        music.volume = Math.max(0, music.volume - 0.012);
                    } else {
                        music.volume = 0;
                        music.pause();
                        clearInterval(fadeInt);
                    }
                }, 80);
            }

            fCtx.save();
            fCtx.globalAlpha = Math.min(fadeToBlack, 1);
            fCtx.fillStyle = '#000';
            fCtx.fillRect(0, 0, W, H);
            fCtx.restore();

            if (fadeToBlack >= 1.2) {
                // Return to the very first start screen
                overlay.style.display = 'none';
                location.reload();
                return;
            }
        }

        requestAnimationFrame(animate);
    }

    // Start when image is ready
    var finaleStarted = false;
    function beginFinale() {
        if (finaleStarted) return;
        finaleStarted = true;
        music.play().catch(function () {});
        requestAnimationFrame(animate);
    }
    finaleImg.onload = beginFinale;
    if (finaleImg.complete && finaleImg.naturalWidth > 0) beginFinale();
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

    // During tutorial, freeze everything — no hand platform, no NPC movement
    if (tutorialPlaying) {
        mouse.active = false;
    } else {
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
    }

    if (!isLevelComplete && !tutorialPlaying) {
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
