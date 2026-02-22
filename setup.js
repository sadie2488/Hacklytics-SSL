let isLevelComplete = false;

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

const goal = { x: 1900, y: groundLevel - 30, size: 20 };

const narrator = new Narrator();

// Ensure paths are correct relative to your index.html
const cacheBust = '?v=' + Date.now();

const caveBackgroundImg = new Image();
caveBackgroundImg.src = 'art/backgrounds/cave/Cave Background.png' + cacheBust;

const caveMiddlegroundImg = new Image();
caveMiddlegroundImg.src = 'art/backgrounds/cave/Cave Middleground.png' + cacheBust;

const caveForegroundImg = new Image();
caveForegroundImg.src = 'art/backgrounds/cave/Cave Foreground 2.png' + cacheBust;

const caveForegroundImg2 = new Image();
caveForegroundImg2.src = 'art/backgrounds/cave/Cave Foreground.png' + cacheBust;


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
