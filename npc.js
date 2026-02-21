const npc = {
    x: 50, y: 320,
    width: 30, height: 30,
    velocityX: 0, velocityY: 0,
    isGrounded: false,
    onMouse: false, 
    state: 'SEEKING',

    update(goalX) {
    let distanceToGoal = goalX - this.x;
    const prevY = this.y;

    // Remove the hardcoded gapStart/gapEnd variables. 
    // Instead, let's look at the actual horizontal distance to the mouse.
    let distToMouse = mouse.x - this.x;
    
    // The NPC is "ready" if the platform is locked and can reach the goal area
    // We check if the goal is to the right of the current platform
    let canReachFinal = (goalX > this.x) && (Math.abs(goalX - this.x) < 1000); 

    let readyToLeapFromMouse = this.onMouse && mouse.isLocked;            
    let readyToJumpToMouse = this.state === 'WAITING' && mouse.active && 
                             Math.abs(distToMouse) < maxJumpDistance && mouse.x > this.x;

    // --- STATE MACHINE ---
    if (this.onMouse) {
        if (readyToLeapFromMouse) {
            this.state = 'JUMPING';
            this.velocityY = jumpForce;
            // Give the NPC a "boost" proportional to your goal direction
            this.velocityX = speed * 1.2;
            this.onMouse = false;
            this.isGrounded = false;
        }
    }
    // ... rest of your state logic
            
            // --- Inside npc.update(goalX) ---
        // --- Inside the SEEKING state logic in npc.js ---
        if (this.state === 'SEEKING') {
        // Walk toward the goal
        let direction = (goalX > this.x) ? 1 : -1;
        let nextX = this.x + (direction * speed);

        // Only move if there is ground, but ignore ledge detection 
        // if we are very close to the goal (to allow the "win" touch)
        let hasGroundAhead = platforms.some(p => 
            nextX + this.width/2 > p.x && 
            nextX + this.width/2 < p.x + p.w &&
            Math.abs((this.y + this.height) - p.y) < 10
        );

        if (hasGroundAhead || Math.abs(goalX - this.x) < 20) {
            this.x = nextX;
        } else {
            this.state = 'WAITING';
        }
    }
        
        if (this.state === 'WAITING') {
            this.velocityX = 0;
        }
 
        
        if (this.state === 'JUMPING') {
            // The velocity is set when the jump starts.
            // The state is reset to 'SEEKING' upon landing (in collision logic).
            // No action needed here while in mid-air.
        }

        // --- PHYSICS ---
        if (this.onMouse) {
            // Instead of snapping to mouse.x (which is screen-based), 
            // we use the processed mouse.x which already has cameraX added.
            this.x = mouse.x + (mouse.width / 2) - (this.width / 2);
            this.y = mouse.y - this.height;

            // Reset velocities so it doesn't build up 'ghost speed'
            this.velocityX = 0;
            this.velocityY = 0;
        }

        this.x += this.velocityX;
        this.y += this.velocityY;

        // Clamp horizontal drift while airborne so hand jumps stay controlled.
        if (!this.onMouse) {
            const maxAirSpeed = speed * 1.5;
            if (this.velocityX > maxAirSpeed) this.velocityX = maxAirSpeed;
            if (this.velocityX < -maxAirSpeed) this.velocityX = -maxAirSpeed;
        }

        // Apply gravity whenever we're not riding the hand platform.
        if (!this.onMouse) {
            this.velocityY += gravity;
            this.isGrounded = false;
        }

        // --- Inside npc.update() in npc.js ---
        this.isGrounded = false;

        // Check collision with the hand platform first
        if (this.velocityY >= 0 && 
            this.x + this.width > mouse.x && this.x < mouse.x + mouse.width &&
            this.y + this.height >= mouse.y && this.y + this.height <= mouse.y + 10) {
            this.y = mouse.y - this.height;
            this.velocityY = 0;
            this.isGrounded = true;
            this.onMouse = true;
        }

        // Check collision with ALL foreground platforms
        platforms.forEach(p => {
            if (this.velocityY >= 0 && 
                this.x + this.width > p.x && 
                this.x < p.x + p.w &&
                this.y + this.height >= p.y && 
                this.y + this.height <= p.y + 15) { // 15px "catch" zone
                
                this.y = p.y - this.height;
                this.velocityY = 0;
                this.isGrounded = true;
                this.onMouse = false;
                if (this.state === 'JUMPING') this.state = 'SEEKING';
            }
        });

        // --- COLLISION LOGIC ---
        // Fall protection: Reset if the NPC falls off the bottom
        if (this.y > canvas.height + 100) {
            this.x = 50; 
            this.y = 320;
            this.velocityX = 0;
            this.velocityY = 0;
            this.onMouse = false;
            this.isGrounded = true;
            this.state = 'SEEKING';
        }
    },

    drawJumpArc() {
        ctx.save();
        ctx.beginPath();
        
        const startX = this.x + this.width / 2;
        const startY = this.y + this.height / 2;
        ctx.moveTo(startX, startY);

        const initialVelocityX = speed;
        const initialVelocityY = jumpForce;
        
        ctx.strokeStyle = 'rgba(255, 100, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        for (let t = 1; t < 60; t++) { 
            const arcX = startX + (initialVelocityX * t);
            const arcY = startY + (initialVelocityY * t) + (0.5 * gravity * t * t);
            ctx.lineTo(arcX, arcY);
            if (arcY > groundY || arcX > levelWidth) break;
        }
        ctx.stroke();
        ctx.restore();
    },

    draw() {
        // Green means the platform is locked and the NPC is ready to leap!
        ctx.fillStyle = (this.onMouse && mouse.isLocked) ? '#2ecc71' : 
                        (this.state === 'JUMPING' ? 'orange' : 'royalblue');
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Only show the jump trajectory if the NPC is on the mouse and it's locked
        if (this.state === 'WAITING' || (this.onMouse && mouse.isLocked)) {
            this.drawJumpArc();
        }
        
        if (mouse.active) {
            // Platform turns dark when locked
            ctx.fillStyle = mouse.isLocked ? '#34495e' : 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(mouse.x, mouse.y, mouse.width, mouse.height);
        }
    }
};
