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

// One long flat platform
const platforms = [
    { x: 0, y: groundLevel, w: levelWidth, h: 60 }
];

const goal = { x: 1900, y: groundLevel - 92, width: 80, height: 92 };

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
    lastX: 0, lastY: 0, 
    velX: 0, velY: 0, 
    width: 60, 
    height: 10, 
    active: false,
    stillTimer: 0,
    isLocked: false 
};
