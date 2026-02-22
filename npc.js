const npc = {
    x: 50, y: 140,
    width: 82, height: 100,
    velocityX: 0, velocityY: 0,
    stamina: 100,
    isGrounded: false,
    onMouse: false,
    maxShadowSpeed: 14,
    state: 'SEEKING',
    hasFallen: false, // Prevents narration spam during death

    update(goalX) {
        let distanceToGoal = goalX - this.x;

        // --- JUMP LOGIC ---
        let readyToLeapFromMouse = this.onMouse && mouse.isLocked;
        if (readyToLeapFromMouse) {
            this.velocityY = jumpForce; 
            this.velocityX = speed * 1.2; 
            this.onMouse = false;
            this.isGrounded = false;
            this.state = 'JUMPING';
            
            // Trigger Narrator: Jump
            narrator.trigger("The NPC just leaped off the hand!");
        }

        // --- STAMINA LOGIC ---
        if (this.onMouse) {
            let prevStamina = this.stamina;
            this.stamina -= staminaDepleteRate;

            // Trigger Narrator: Low Stamina warning (only once when crossing the 30% threshold)
            if (prevStamina >= 30 && this.stamina < 30) {
                narrator.trigger("The NPC is getting tired of being carried.");
            }

            if (this.stamina <= 0) {
                this.stamina = 0;
                this.onMouse = false;
                mouse.active = false;
                this.velocityY = 2;
                narrator.trigger("The NPC ran out of stamina and fell.");
            }
        } else if (this.isGrounded) {
            this.stamina = Math.min(maxStamina, this.stamina + staminaRegenRate);
        }

        // --- STATE MACHINE ---
        if (this.state === 'SEEKING') {
            let direction = (goalX > this.x) ? 1 : -1;
            let nextX = this.x + (direction * speed);
            let hasGroundAhead = platforms.some(p => 
                nextX + this.width/2 > p.x && 
                nextX + this.width/2 < p.x + p.w &&
                Math.abs((this.y + this.height) - p.y) < 10
            );

            if (hasGroundAhead || Math.abs(goalX - this.x) < 20) {
                this.x = nextX;
            } else {
                this.state = 'WAITING';
                narrator.trigger("The NPC is stuck at a ledge and needs a hand.");
            }
        }
        
        if (this.state === 'WAITING') { this.velocityX = 0; }

        // --- PHYSICS & ATTACHMENT ---
        if (this.onMouse) {
            const desiredX = mouse.x + (mouse.width / 2) - (this.width / 2);
            const desiredY = mouse.y - this.height;
            const rawDelta = desiredX - this.x;
            
            if (Math.abs(rawDelta) > this.maxShadowSpeed * 3) {
                this.x = desiredX;
            } else {
                const followLerp = 0.75;
                let deltaX = rawDelta * followLerp;
                this.x += Math.max(-this.maxShadowSpeed, Math.min(this.maxShadowSpeed, deltaX));
            }
            this.y = desiredY;
            this.velocityX = 0;
            this.velocityY = 0;
        }

        this.x += this.velocityX;
        this.y += this.velocityY;

        if (!this.onMouse) {
            this.velocityY += gravity;
        }

        // --- COLLISION LOGIC ---
        this.isGrounded = false;
        
        // Hand Platform Collision
        if (this.velocityY >= 0 && 
            this.x + this.width > mouse.x && this.x < mouse.x + mouse.width &&
            this.y + this.height >= mouse.y && this.y + this.height <= mouse.y + 10) {
            this.y = mouse.y - this.height;
            this.velocityY = 0;
            this.isGrounded = true;
            this.onMouse = true;
        }

        // Ground Platform Collision
        platforms.forEach(p => {
            if (this.velocityY >= 0 && 
                this.x + this.width > p.x && this.x < p.x + p.w &&
                this.y + this.height >= p.y && this.y + this.height <= p.y + 15) {
                this.y = p.y - this.height;
                this.velocityY = 0;
                this.isGrounded = true;
                this.onMouse = false;
                if (this.state === 'JUMPING') this.state = 'SEEKING';
            }
        });

        // Death Logic
        if (this.y > canvas.height + 100) {
            if (!this.hasFallen) {
                narrator.trigger("Back to the start for you.");
                this.hasFallen = true;
            }
            this.reset();
        }
    },

    reset() {
        this.x = 50; 
        this.y = 140;
        this.velocityX = 0;
        this.velocityY = 0;
        this.stamina = 100;
        this.onMouse = false;
        this.isGrounded = true;
        this.state = 'SEEKING';
        setTimeout(() => { this.hasFallen = false; }, 2000);
    },

    drawJumpArc() {
        ctx.save();
        ctx.beginPath();
        const startX = this.x + this.width / 2;
        const startY = this.y + this.height / 2;
        ctx.moveTo(startX, startY);
        for (let t = 1; t < 60; t++) { 
            const arcX = startX + (speed * t);
            const arcY = startY + (jumpForce * t) + (0.5 * gravity * t * t);
            ctx.lineTo(arcX, arcY);
            if (arcY > groundY) break;
        }
        ctx.strokeStyle = 'rgba(255, 100, 0, 0.7)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
    },

    draw() {
        if (this.spriteLoaded && this.sprite) {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = (this.onMouse && mouse.isLocked) ? '#2ecc71' : 
                            (this.state === 'JUMPING' ? 'orange' : 'royalblue');
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        
        if (this.state === 'WAITING' || (this.onMouse && mouse.isLocked)) {
            this.drawJumpArc();
        }
        
        // Stamina Bar
        if (this.stamina < maxStamina) {
            const healthPercent = this.stamina / maxStamina;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(this.x, this.y - 15, this.width, 8);
            ctx.fillStyle = healthPercent > 0.3 ? '#2ecc71' : '#e74c3c';
            ctx.fillRect(this.x, this.y - 15, this.width * healthPercent, 8);
        }

        if (mouse.active && this.stamina > 0) {
            ctx.fillStyle = mouse.isLocked ? '#0a0a1a' : 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(mouse.x, mouse.y, mouse.width, mouse.height);
        }
    }
};

npc.sprite = new Image();
npc.spriteLoaded = false;
npc.sprite.src = 'assets/player.png';
npc.sprite.onload = () => { npc.spriteLoaded = true; };