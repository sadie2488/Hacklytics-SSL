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
const biomeList = ['cave', 'forest', 'mountain', 'finale'];
const biomeNames = { cave: 'CAVES', forest: 'FOREST', mountain: 'MOUNTAIN', finale: 'FINALE' };
const biomeFills = { cave: '#1e1e1e', forest: '#0e1e0e', mountain: '#1a1e2a', finale: '#0a0a0a' };
const biomeMenuBgs = {
    cave: 'radial-gradient(ellipse at center, #1a1a3a 0%, #0a0a18 60%, #050510 100%)',
    forest: 'radial-gradient(ellipse at center, #0a2a0a 0%, #061806 60%, #030f03 100%)',
    mountain: 'radial-gradient(ellipse at center, #1a2535 0%, #0a1520 60%, #050d15 100%)',
    finale: 'radial-gradient(ellipse at center, #2a1a00 0%, #140a00 60%, #0a0500 100%)'
};
let currentBiomeIndex = 0;

const biomes = {};
biomeList.forEach(function(biome) {
    biomes[biome] = {
        background: new Image(),
        middleground: new Image(),
        foreground: new Image(),
        foreground2: new Image()
    };
    if (biome === 'finale') return; // finale has no game backgrounds
    const cap = biome.charAt(0).toUpperCase() + biome.slice(1);
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
    if (biome === 'forest') {
        return getForestDangerBlocks(level);
    }
    if (biome === 'mountain') {
        return getMountainDangerBlocks(level);
    }
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
            // Spiders — drop from ceiling at key crossing points
            { type: 'spider', x: 520,  ceilingY: 0, maxY: gY - 60, speed: 1.4, width: 50, height: 50 },
            { type: 'spider', x: 1050, ceilingY: 0, maxY: gY - 50, speed: 1.6, width: 50, height: 50 },
            { type: 'spider', x: 1500, ceilingY: 0, maxY: gY - 70, speed: 1.2, width: 50, height: 50 },
            // Brambles — ground obstacles the NPC must jump over
            { type: 'bramble', x: 280,  groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 750,  groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 1250, groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 1680, groundY: gY, width: 45, height: 40 }
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

function getForestDangerBlocks(level) {
    const gY = groundLevel; // forest has no ground offset
    switch (level) {
        case 1: return [
            // Gentle intro: a couple brambles to jump over
            { type: 'bramble', x: 400,  groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 1100, groundY: gY, width: 45, height: 40 }
        ];
        case 2: return [
            // More brambles scattered across platforms
            { type: 'bramble', x: 280,  groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 800,  groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 1500, groundY: gY, width: 45, height: 40 }
        ];
        case 3: return [
            // Brambles on every platform — must jump over each before the next gap
            { type: 'bramble', x: 200,  groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 600,  groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 1080, groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 1600, groundY: gY, width: 45, height: 40 }
        ];
        case 4: return [
            // Dense bramble gauntlet — tight spacing on narrow platforms
            { type: 'bramble', x: 150,  groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 530,  groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 930,  groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 1350, groundY: gY, width: 45, height: 40 },
            { type: 'bramble', x: 1750, groundY: gY, width: 45, height: 40 }
        ];
        default: return [];
    }
}

function getMountainDangerBlocks(level) {
    const gY = groundLevel + 20; // mountain ground offset
    switch (level) {
        case 1: return []; // tutorial — no hazards
        case 2: return [
            { type: 'icicle', x: 650, ceilingY: 0, groundY: gY, speed: 5, delay: 150, width: 40, height: 55 }
        ];
        case 3: return [
            // Medium difficulty: 4 icicles over platforms, staggered drop timers
            // They fall, land, and become permanent ground obstacles
            { type: 'icicle', x: 200,  ceilingY: 0, groundY: gY, speed: 5, delay: 90,  width: 40, height: 55 },
            { type: 'icicle', x: 650,  ceilingY: 0, groundY: gY, speed: 6, delay: 200, width: 40, height: 55 },
            { type: 'icicle', x: 1150, ceilingY: 0, groundY: gY, speed: 5, delay: 320, width: 40, height: 55 },
            { type: 'icicle', x: 1700, ceilingY: 0, groundY: gY, speed: 6, delay: 420, width: 40, height: 55 }
        ];
        case 4: return [
            { type: 'icicle', x: 150,  ceilingY: 0, groundY: gY, speed: 6, delay: 60,  width: 40, height: 55 },
            { type: 'icicle', x: 400,  ceilingY: 0, groundY: gY, speed: 7, delay: 120, width: 40, height: 55 },
            { type: 'icicle', x: 650,  ceilingY: 0, groundY: gY, speed: 5, delay: 180, width: 40, height: 55 },
            { type: 'icicle', x: 900,  ceilingY: 0, groundY: gY, speed: 7, delay: 240, width: 40, height: 55 },
            { type: 'icicle', x: 1150, ceilingY: 0, groundY: gY, speed: 6, delay: 300, width: 40, height: 55 },
            { type: 'icicle', x: 1500, ceilingY: 0, groundY: gY, speed: 5, delay: 360, width: 40, height: 55 },
            { type: 'icicle', x: 1750, ceilingY: 0, groundY: gY, speed: 7, delay: 400, width: 40, height: 55 }
        ];
        default: return [];
    }
}

// Spider sprite
const spiderImg = new Image();
spiderImg.src = 'Assets/Spider.png';

// Bramble sprite (ground obstacle the NPC must jump over)
const brambleImg = new Image();
brambleImg.src = 'Assets/Bramble.png';

// Cache a feathered version of the bramble so edges aren't harsh
let brambleFeathered = null;
brambleImg.addEventListener('load', function () {
    const size = 64; // render at a fixed size, draw scaled
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const oc = off.getContext('2d');
    oc.drawImage(brambleImg, 0, 0, size, size);
    oc.globalCompositeOperation = 'destination-in';
    const r = size / 2;
    const grad = oc.createRadialGradient(r, r, r * 0.38, r, r, r);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    oc.fillStyle = grad;
    oc.fillRect(0, 0, size, size);
    brambleFeathered = off;
});

// Icicle sprite (ceiling danger for mountain biome)
const icicleImg = new Image();
icicleImg.src = 'Assets/Icicle.png';

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
    if (block.type === 'bramble') {
        // Brambles are static ground obstacles — no runtime movement state needed
        block.y = block.groundY - block.height; // sit on top of the ground
    }
    if (block.type === 'icicle') {
        block.y = block.ceilingY;       // start hanging from ceiling
        block.fallen = false;           // true once landed on ground
        block.falling = false;          // true while actively dropping
        block.waitTimer = block.delay || 0; // frames before dropping
        block.fallSpeed = block.speed;  // pixels per frame while falling
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
    if (block.type === 'icicle') {
        if (block.fallen) return; // already on the ground — static obstacle
        if (!block.falling) {
            // Waiting at ceiling before dropping
            block.waitTimer -= dt;
            if (block.waitTimer <= 0) block.falling = true;
            return;
        }
        // Falling
        block.y += block.fallSpeed * dt;
        if (block.y >= block.groundY - block.height) {
            block.y = block.groundY - block.height;
            block.fallen = true;
            block.falling = false;
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
    if (block.type === 'bramble') {
        if (brambleFeathered) {
            ctx.drawImage(brambleFeathered, block.x, block.y, block.width, block.height);
        } else if (brambleImg.complete && brambleImg.naturalWidth > 0) {
            ctx.drawImage(brambleImg, block.x, block.y, block.width, block.height);
        } else {
            ctx.fillStyle = '#3a2a1a';
            ctx.fillRect(block.x, block.y, block.width, block.height);
        }
    }
    if (block.type === 'icicle') {
        const cx = block.x + block.width / 2;

        // --- Icy thread from ceiling while still hanging or falling ---
        if (!block.fallen) {
            ctx.save();
            ctx.strokeStyle = 'rgba(180, 220, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, block.ceilingY);
            ctx.lineTo(cx, block.y + 4);
            ctx.stroke();
            ctx.restore();
        }

        // --- Icicle sprite ---
        if (icicleImg.complete && icicleImg.naturalWidth > 0) {
            ctx.drawImage(icicleImg, block.x, block.y, block.width, block.height);
        } else {
            ctx.fillStyle = '#a0d0f0';
            ctx.fillRect(block.x, block.y, block.width, block.height);
        }
    }
}
