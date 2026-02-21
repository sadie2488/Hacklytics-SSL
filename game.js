const goal = { x: 1800, y: 320, size: 20 }; // Move goal further right
const levelWidth = 2000; // Define total level length

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Calculate Camera Position
    // This keeps the NPC centered but stops at the edges of the 2000px level
    cameraX = npc.x - canvas.width / 2;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > levelWidth - canvas.width) cameraX = levelWidth - canvas.width;

    // 2. Start Camera Translation
    ctx.save();
    ctx.translate(-cameraX, 0);

    // 3. Draw the World (Static Platforms)
    // --- Inside your gameLoop() ---
    ctx.fillStyle = '#888';
    platforms.forEach(p => {
        ctx.fillRect(p.x, p.y, p.w, p.h);
    });
    
    ctx.fillStyle = 'red';
    ctx.fillRect(goal.x, goal.y, goal.size, goal.size);

    // 4. Update and Draw NPC in "World Space"
    npc.update(goal.x);
    npc.draw();
    
    // 5. End Camera Translation (Anything drawn after this is pinned to the screen)
    ctx.restore();

    mouse.velX = 0;
    mouse.velY = 0;

    requestAnimationFrame(gameLoop);
}
gameLoop();