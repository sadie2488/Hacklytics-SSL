const npc = {
    x: 50, y: 140,
    width: 60, height: 60,
    velocityX: 0, velocityY: 0,
    isGrounded: false,
    onMouse: false,
    // Maximum pixels the shadow can move the NPC per frame
    maxShadowSpeed: 6,
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
            // Smooth follow: lerp toward the smoothed mouse position to reduce jitter
            const desiredX = mouse.x + (mouse.width / 2) - (this.width / 2);
            const desiredY = mouse.y - this.height;
            const followLerp = 0.42; // 0-1 where smaller is smoother/slower
            const rawDelta = desiredX - this.x;
            let deltaX = rawDelta * followLerp;
            const maxMove = this.maxShadowSpeed || 6;
            if (deltaX > maxMove) deltaX = maxMove;
            if (deltaX < -maxMove) deltaX = -maxMove;
            const newX = this.x + deltaX;
            const newY = desiredY;

            // Check for intersection with any platform at the new position
            const collidedPlatform = platforms.find(p => {
                const npcLeft = newX;
                const npcRight = newX + this.width;
                const npcTop = newY;
                const npcBottom = newY + this.height;
                const pLeft = p.x;
                const pRight = p.x + p.w;
                const pTop = p.y;
                const pBottom = p.y + p.h;
                // AABB overlap amounts
                const overlapX = Math.min(npcRight, pRight) - Math.max(npcLeft, pLeft);
                const overlapY = Math.min(npcBottom, pBottom) - Math.max(npcTop, pTop);
                const minOverlap = 2; // ignore tiny overlaps that cause jitter
                return (overlapX > minOverlap && overlapY > minOverlap);
            });

            if (collidedPlatform) {
                // Slide the NPC off the shadow at the platform edge and drop
                if (rawDelta > 0) {
                    this.x = collidedPlatform.x - this.width - 0.5;
                } else {
                    this.x = collidedPlatform.x + collidedPlatform.w + 0.5;
                }
                this.onMouse = false;
                this.isGrounded = false;
                this.velocityY = 1; // start falling
                // give a small horizontal push based on hand movement, capped
                const handVel = mouse.velX || 0;
                this.velocityX = Math.max(-maxMove, Math.min(maxMove, handVel));
            } else {
                this.x = newX;
                this.y = newY;
                this.velocityX = 0;
                this.velocityY = 0;
            }
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
            this.y = 140;
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
        // Draw sprite if available, otherwise fallback to colored rectangle
        if (this.spriteLoaded && this.sprite) {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = (this.onMouse && mouse.isLocked) ? '#2ecc71' : 
                            (this.state === 'JUMPING' ? 'orange' : 'royalblue');
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        
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

// Load a PNG sprite for the NPC. Place `player.png` inside the `assets/` folder.
npc.sprite = new Image();
npc.spriteLoaded = false;
npc.sprite.src = 'assets/player.png';
npc.sprite.onload = () => { npc.spriteLoaded = true; };
