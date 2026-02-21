const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const videoElement = document.getElementById('webcam');

const gravity = 0.5;
const jumpForce = -10; 
const speed = 2;
const groundY = 350;

const timeInAir = (Math.abs(jumpForce) * 2) / gravity;
const maxJumpDistance = speed * timeInAir;

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