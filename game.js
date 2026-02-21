const goal = { x: 500, y: 320, size: 20 };

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#888';
    ctx.fillRect(0, groundY, 230, 50); 
    ctx.fillRect(450, groundY, 150, 50); 
    ctx.fillStyle = 'red';
    ctx.fillRect(goal.x, goal.y, goal.size, goal.size);

    npc.update(goal.x);
    npc.draw();
    
    mouse.velX = 0;
    mouse.velY = 0;

    requestAnimationFrame(gameLoop);
}
gameLoop();