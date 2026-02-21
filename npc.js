const npc = {
    x: 50, y: 300,
    width: 30, height: 30,
    velocityX: 0, velocityY: 0,
    isGrounded: false,
    onMouse: false, 
    state: 'SEEKING',

    update(goalX) {
        let distanceToGoal = goalX - this.x;
        const gapStart = 230; 
        const gapEnd = 450; 

        if (this.onMouse) {
            mouse.stillTimer++;
        }

        // --- DECISION LOGIC ---
        if (this.state === 'SEEKING' || this.state === 'WAITING' || this.onMouse) {
            
            // Calculate if the final ledge is within jumping reach from CURRENT position
            let distanceToLedge = gapEnd - this.x;
            let canReachFinal = maxJumpDistance > distanceToLedge && this.x < gapEnd;
            
            let distToMouse = mouse.x - this.x;
            let canReachMouse = mouse.active && Math.abs(distToMouse) < maxJumpDistance && mouse.x > this.x;

            // NEW: Logic to jump from the mouse to the ledge if still
            let readyToLeapFromMouse = this.onMouse && mouse.isLocked && canReachFinal;            
            // Logic to jump from the ground to the mouse
            let readyToJumpToMouse = this.state === 'WAITING' && canReachMouse;

            if (readyToLeapFromMouse || readyToJumpToMouse || (this.state === 'SEEKING' && this.x > gapStart - 20 && this.x < gapStart)) {
                if (canReachFinal || canReachMouse) {
                    this.state = 'JUMPING';
                    this.velocityY = jumpForce;
                    this.onMouse = false; 
                    this.isGrounded = false;
                } else if (this.state !== 'WAITING' && !this.onMouse) {
                    this.state = 'WAITING';
                    this.velocityX = 0;
                    this.x = gapStart - 5;
                }
            }
            
            if (this.state === 'SEEKING') {
                this.velocityX = (distanceToGoal > 0) ? speed : -speed;
            } else if (this.state === 'WAITING' || this.onMouse) {
                this.velocityX = 0;
            }
        } 
        
        if (this.state === 'JUMPING') {
            this.velocityX = speed;
            if (this.isGrounded && this.x > gapEnd) {
                this.state = 'SEEKING';
            }
        }

        // --- PHYSICS ---
        if (this.onMouse) {
            this.x += mouse.velX;
            this.y += mouse.velY;

            // Create a 10px safety buffer on each side so it doesn't fall off the edge
            const buffer = 10;
            const minX = mouse.x + buffer;
            const maxX = mouse.x + mouse.width - this.width - buffer;

            // Clamp the NPC's position so it stays within the "safe" middle of the platform
            if (this.x < minX) this.x = minX;
            if (this.x > maxX) this.x = maxX;

            this.velocityX = 0;
            this.velocityY = 0;
        }

        this.x += this.velocityX;
        this.y += this.velocityY;

        if (!this.onMouse && (this.y + this.height < groundY)) {
            this.velocityY += gravity;
            this.isGrounded = false;
        }

        // COLLISION: Mouse Platform
        if (this.velocityY >= 0 && 
            this.x + this.width > mouse.x - 5 && this.x < mouse.x + mouse.width + 5 &&
            this.y + this.height >= mouse.y && this.y + this.height <= mouse.y + 15) {
            
            this.y = mouse.y - this.height;
            this.velocityY = 0;
            this.isGrounded = true;
            this.onMouse = true;
        } else {
            this.onMouse = false;
        }

        // COLLISION: Static Platforms
        let onFirstPlatform = (this.x < gapStart);
        let onSecondPlatform = (this.x + this.width > gapEnd);

        if (this.y + this.height >= groundY && (onFirstPlatform || onSecondPlatform)) {
            this.y = groundY - this.height;
            this.velocityY = 0;
            this.isGrounded = true;
            if (this.state === 'JUMPING' && onSecondPlatform) this.state = 'SEEKING';
        } else if (!this.onMouse) {
            this.isGrounded = false;
            if (this.y > canvas.height) { 
                this.x = 50; this.y = 300; this.state = 'SEEKING';
            }
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
            if (arcY > groundY || arcX > canvas.width) break;
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