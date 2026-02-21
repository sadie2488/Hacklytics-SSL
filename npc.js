const npc = {
    x: 50, y: 140,
    width: 82, height: 100,
    velocityX: 0, velocityY: 0,
    stamina: 100,
    isGrounded: false,
    onMouse: false,
    // Maximum pixels the shadow can move the NPC per frame
    maxShadowSpeed: 14,
    state: 'SEEKING',
    // Running animation state
    facingRight: true,
    animFrame: 0,
    animTimer: 0,
    animSpeed: 5, // frames between animation switches

    update(goalX) {
    let distanceToGoal = goalX - this.x;
    const prevY = this.y;

    // Remove the hardcoded gapStart/gapEnd variables. 
    let distToMouse = mouse.x - this.x;
    
    let canReachFinal = (goalX > this.x) && (Math.abs(goalX - this.x) < 1000); 

    let readyToLeapFromMouse = this.onMouse && mouse.isLocked;
    if (readyToLeapFromMouse) {
        // Apply jump force
        this.velocityY = jumpForce; 
        
        // Give a forward boost based on current speed + a little extra "leap" momentum
        this.velocityX = speed * 1.2; 
        
        // Change state and break the "onMouse" attachment
        this.onMouse = false;
        this.isGrounded = false;
        this.state = 'JUMPING';
    }

    // Inside npc.update(goalX)
    if (this.onMouse) {
        this.stamina -= staminaDepleteRate;

        if (this.stamina <= 0) {
            this.stamina = 0;
            this.onMouse = false;
            mouse.active = false; // Effectively "hides" the platform
            this.velocityY = 2;   // Start the fall
        }
    } else {
        // Regenerate stamina only when safely on a ground platform
        if (this.isGrounded) {
            this.stamina = Math.min(maxStamina, this.stamina + staminaRegenRate);
        }
    }

    // Death Logic: If the NPC falls below the screen
    if (this.y > canvas.height + 100) {
        this.reset();
    }

    if (this.state === 'SEEKING') {
        // Walk toward the goal
        let direction = (goalX > this.x) ? 1 : -1;
        this.facingRight = direction === 1;
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
            // Advance running animation
            this.animTimer++;
            if (this.animTimer >= this.animSpeed) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % 3;
            }
        } else {
            this.state = 'WAITING';
            this.animFrame = 0;
            this.animTimer = 0;
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
            const desiredX = mouse.x + (mouse.width / 2) - (this.width / 2);
            const desiredY = mouse.y - this.height;
            const rawDelta = desiredX - this.x;
            const distToPlat = Math.abs(rawDelta);
            const maxMove = this.maxShadowSpeed;

            // If the hand moved too far away, snap directly to it instead of lerping
            let newX;
            if (distToPlat > maxMove * 3) {
                newX = desiredX;
            } else {
                const followLerp = 0.75;
                let deltaX = rawDelta * followLerp;
                if (deltaX > maxMove) deltaX = maxMove;
                if (deltaX < -maxMove) deltaX = -maxMove;
                newX = this.x + deltaX;
            }
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
                const overlapX = Math.min(npcRight, pRight) - Math.max(npcLeft, pLeft);
                const overlapY = Math.min(npcBottom, pBottom) - Math.max(npcTop, pTop);
                const minOverlap = 4;
                return (overlapX > minOverlap && overlapY > minOverlap);
            });

            if (collidedPlatform) {
                if (rawDelta > 0) {
                    this.x = collidedPlatform.x - this.width - 0.5;
                } else {
                    this.x = collidedPlatform.x + collidedPlatform.w + 0.5;
                }
                this.onMouse = false;
                this.isGrounded = false;
                this.velocityY = 1;
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
                prevY + this.height <= p.y) { // swept collision: feet crossed platform top
                
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
        // Determine if we should use the running animation
        const isRunning = this.state === 'SEEKING' && this.isGrounded && !this.onMouse
            && this.runFramesLoaded === 3;

        // Determine if we should use the jumping animation
        const isJumping = !this.isGrounded && !this.onMouse && this.jumpFramesLoaded === 2;

        if (isJumping) {
            // Jump 1 while rising, Jump 2 while falling
            const frame = this.velocityY < 0 ? this.jumpFrames[0] : this.jumpFrames[1];
            ctx.save();
            if (!this.facingRight) {
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(frame, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(frame, this.x, this.y, this.width, this.height);
            }
            ctx.restore();
        } else if (isRunning) {
            const frame = this.runFrames[this.animFrame];
            // Bob up and down: middle frame is raised, first and last are grounded
            const bobOffsets = [0, -3, -1];
            const drawY = this.y + bobOffsets[this.animFrame];
            ctx.save();
            if (!this.facingRight) {
                ctx.translate(this.x + this.width, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(frame, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(frame, this.x, drawY, this.width, this.height);
            }
            ctx.restore();
        } else if (this.spriteLoaded && this.sprite) {
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
            ctx.fillStyle = mouse.isLocked ? '#0a0a1a' : 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(mouse.x, mouse.y, mouse.width, mouse.height);
        }

        // --- Inside npc.draw() ---
        if (this.stamina < maxStamina) {
            const barWidth = this.width;
            const barHeight = 8;
            const healthPercent = this.stamina / maxStamina;

            // Background of the bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(this.x, this.y - 15, barWidth, barHeight);

            // Stamina color (green to red)
            ctx.fillStyle = healthPercent > 0.3 ? '#2ecc71' : '#e74c3c';
            ctx.fillRect(this.x, this.y - 15, barWidth * healthPercent, barHeight);
        }

        // Inside npc.draw()
        if (mouse.active && this.stamina > 0) {
            // Only draw the platform if there is stamina left
            ctx.fillStyle = mouse.isLocked ? '#0a0a1a' : 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(mouse.x, mouse.y, mouse.width, mouse.height);
        }
    }
};

// Load a PNG sprite for the NPC. Place `player.png` inside the `assets/` folder.
npc.sprite = new Image();
npc.spriteLoaded = false;
npc.sprite.src = 'Assets/Sprite/player.png';
npc.sprite.onload = () => { npc.spriteLoaded = true; };

// Load running animation frames
npc.runFrames = [];
npc.runFramesLoaded = 0;
for (let i = 1; i <= 3; i++) {
    const img = new Image();
    img.src = 'Assets/Sprite/Running/Run ' + i + '.png';
    img.onload = () => { npc.runFramesLoaded++; };
    npc.runFrames.push(img);
}

// Load jumping animation frames
npc.jumpFrames = [];
npc.jumpFramesLoaded = 0;
for (let i = 1; i <= 2; i++) {
    const img = new Image();
    img.src = 'Assets/Sprite/Jumping/Jump ' + i + '.png';
    img.onload = () => { npc.jumpFramesLoaded++; };
    npc.jumpFrames.push(img);
}
