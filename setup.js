const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const videoElement = document.getElementById('webcam');

const platforms = [
    { x: 0, y: 350, w: 230, h: 50 },
    { x: 450, y: 350, w: 300, h: 50 },
    { x: 900, y: 300, w: 200, h: 50 }, // The higher platform
    { x: 1300, y: 350, w: 400, h: 50 }
];

const gravity = 0.5;
const jumpForce = -10; 
const speed = 1.7;
const groundY = 350;

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
