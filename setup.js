let isLevelComplete = false;
let gameStarted = false;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const videoElement = document.getElementById('webcam');

const maxStamina = 100;
const staminaDepleteRate = 0.5; // How fast stamina drops while being carried
const staminaRegenRate = 1.0;   // How fast stamina recovers on the ground

const speed = 3.5;
const gravity = 0.8;
const jumpForce = -15;
const groundLevel = 350;
const groundY = groundLevel;
const levelWidth = 2000;

// Platforms (rebuilt per level in resetGame)
let platforms = [
    { x: 0, y: groundLevel, w: levelWidth, h: 60 }
];

// Hole definitions for the current level (array of {x, w} objects)
let levelHole = [];

// Wall definitions for the current level (array of {x, y, w, h} objects)
let walls = [];

const goal = { x: 1900, y: groundLevel - 92, width: 80, height: 92 };

const narrator = new Narrator();

// Ensure paths are correct relative to your index.html
const cacheBust = '?v=' + Date.now();

const exitDoorImg = new Image();
exitDoorImg.src = 'assets/Exit door.png' + cacheBust;

// Biome system
const biomeList = ['cave', 'forest', 'mountain'];
const biomeNames = { cave: 'CAVES', forest: 'FOREST', mountain: 'MOUNTAIN' };
const biomeFills = { cave: '#1e1e1e', forest: '#0e1e0e', mountain: '#1a1e2a' };
const biomeMenuBgs = {
    cave: 'radial-gradient(ellipse at center, #1a1a3a 0%, #0a0a18 60%, #050510 100%)',
    forest: 'radial-gradient(ellipse at center, #0a2a0a 0%, #061806 60%, #030f03 100%)',
    mountain: 'radial-gradient(ellipse at center, #1a2535 0%, #0a1520 60%, #050d15 100%)'
};
let currentBiomeIndex = 0;

const biomes = {};
biomeList.forEach(function(biome) {
    const cap = biome.charAt(0).toUpperCase() + biome.slice(1);
    biomes[biome] = {
        background: new Image(),
        middleground: new Image(),
        foreground: new Image(),
        foreground2: new Image()
    };
    biomes[biome].background.src = 'art/backgrounds/' + biome + '/' + cap + ' Background.png' + cacheBust;
    biomes[biome].middleground.src = 'art/backgrounds/' + biome + '/' + cap + ' Middleground.png' + cacheBust;
    biomes[biome].foreground.src = 'art/backgrounds/' + biome + '/' + cap + ' Foreground.png' + cacheBust;
    biomes[biome].foreground2.src = 'art/backgrounds/' + biome + '/' + cap + ' Foreground 2.png' + cacheBust;
});

function getCurrentBiome() {
    return biomes[biomeList[currentBiomeIndex]];
}


const timeInAir = (Math.abs(jumpForce) * 2) / gravity;
const maxJumpDistance = speed * timeInAir;

let cameraX = 0;

// Mouse Tracking with Velocity and Stillness Timer
let mouse = {
    x: 0, y: 0,
    screenX: 0, screenY: 0,
    lastX: 0, lastY: 0,
    velX: 0, velY: 0,
    width: 60,
    height: 10,
    active: false,
    stillTimer: 0,
    isLocked: false
};

// --- Danger Blocks ---
let dangerBlocks = [];

// Returns danger blocks for a given biome and level number
function getLevelDangerBlocks(biome, level) {
    if (biome === 'cave') {
        return getCaveDangerBlocks(level);
    }
    // Other biomes can be added later
    return [];
}

function getCaveDangerBlocks(level) {
    const gY = groundLevel + 20; // cave ground offset
    switch (level) {
        case 1: return []; // tutorial — no spiders
        case 2: return [
            { type: 'spider', x: 600, ceilingY: 0, maxY: gY - 60, speed: 1.2, width: 50, height: 50 }
        ];
        case 3: return [
            { type: 'spider', x: 1000, ceilingY: 0, maxY: gY - 60, speed: 1.3, width: 50, height: 50 }
        ];
        case 4: return [
            { type: 'spider', x: 300, ceilingY: 0, maxY: gY - 40, speed: 1.6, width: 50, height: 50 },
            { type: 'spider', x: 550, ceilingY: 0, maxY: gY - 70, speed: 1.2, width: 50, height: 50 },
            { type: 'spider', x: 850, ceilingY: 0, maxY: gY - 50, speed: 2.0, width: 50, height: 50 },
            { type: 'spider', x: 1150, ceilingY: 0, maxY: gY - 80, speed: 1.4, width: 50, height: 50 },
            { type: 'spider', x: 1450, ceilingY: 0, maxY: gY - 60, speed: 1.8, width: 50, height: 50 }
        ];
        default: return [];
    }
}

// Spider sprite
const spiderImg = new Image();
spiderImg.src = 'Assets/Spider.png';

// Initialize a danger block with runtime state
function initDangerBlock(block) {
    if (block.type === 'spider') {
        block.y = block.ceilingY;       // start at the top
        block.direction = 1;            // 1 = descending, -1 = ascending
        block.pauseTimer = 0;           // brief pause at top/bottom
        block.descendSpeed = block.speed * 3;   // fast drop
        block.ascendSpeed = block.speed * 0.6;  // slow climb back up
        block.bottomPause = 90;         // ~1.5 seconds at bottom (at 60fps)
        block.topPause = 80;            // longer wait at ceiling before next drop
    }
    return block;
}

// Update a danger block each frame
function updateDangerBlock(block) {
    if (block.type === 'spider') {
        if (block.pauseTimer > 0) {
            block.pauseTimer -= dt;
            return;
        }
        // Fast descent, slow ascent
        const currentSpeed = block.direction === 1 ? block.descendSpeed : block.ascendSpeed;
        block.y += currentSpeed * block.direction * dt;
        // Reached the bottom — long pause then reverse
        if (block.y >= block.maxY) {
            block.y = block.maxY;
            block.direction = -1;
            block.pauseTimer = block.bottomPause;
        }
        // Reached the ceiling — pause then drop again
        if (block.y <= block.ceilingY) {
            block.y = block.ceilingY;
            block.direction = 1;
            block.pauseTimer = block.topPause;
        }
    }
}

// Draw a danger block
function drawDangerBlock(block) {
    if (block.type === 'spider') {
        const cx = block.x + block.width / 2;

        // --- White string from ceiling to spider ---
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, block.ceilingY);
        ctx.lineTo(cx, block.y + 4);
        ctx.stroke();
        ctx.restore();

        // --- Spider sprite ---
        if (spiderImg.complete && spiderImg.naturalWidth > 0) {
            ctx.drawImage(spiderImg, block.x, block.y, block.width, block.height);
        } else {
            // Fallback rectangle if image hasn't loaded
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(block.x, block.y, block.width, block.height);
        }
    }
}
