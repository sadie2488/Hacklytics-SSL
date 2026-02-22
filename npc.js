// --- Fire particle system for death explosion ---
let deathParticles = [];
let deathAnimating = false;
let deathTimer = 0;
const DEATH_DURATION = 60; // ~1 second at 60fps

function spawnDeathParticles(cx, cy) {
    deathParticles = [];
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 4;
        deathParticles.push({
            x: cx + (Math.random() - 0.5) * 20,
            y: cy + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 2, // bias upward
            life: 1.0,
            decay: 0.015 + Math.random() * 0.02,
            size: 4 + Math.random() * 8,
            hue: Math.random() < 0.6 ? 20 + Math.random() * 30 : 45 + Math.random() * 15 // orange-red to yellow
        });
    }
}

function updateDeathParticles() {
    for (let i = deathParticles.length - 1; i >= 0; i--) {
        const p = deathParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.08 * dt; // gentle gravity on particles
        p.life -= p.decay * dt;
        p.size *= Math.pow(0.98, dt);
        if (p.life <= 0) deathParticles.splice(i, 1);
    }
}

function drawDeathParticles() {
    deathParticles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        // Glow
        ctx.shadowColor = 'hsl(' + p.hue + ', 100%, 55%)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'hsl(' + p.hue + ', 100%, ' + (50 + p.life * 30) + '%)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

const npc = {
    x: 50, y: 140,
    width: 82, height: 100,
    // Hitbox inset: collision rect is narrower than the sprite
    hitboxInsetX: 16, // pixels trimmed from each side for danger collisions
    velocityX: 0, velocityY: 0,
    stamina: 100,
    isGrounded: false,
    onMouse: false,
    // Maximum pixels the shadow can move the NPC per frame
    maxShadowSpeed: 6,
    state: 'SEEKING',
    // Running animation state
    facingRight: true,
    animFrame: 0,
    animTimer: 0,
    animSpeed: 5, // frames between animation switches
    waitTimer: 0, // countdown before NPC starts running (IDLE state)

    reset() {
        this.x = 50;
        this.y = 140;
        this.velocityX = 0;
        this.velocityY = 0;
        this.onMouse = false;
        this.isGrounded = true;
        this.state = 'SEEKING';
        this.stamina = maxStamina;
        this.animFrame = 0;
        this.animTimer = 0;
    },

    die() {
        if (deathAnimating) return; // already dying
        // Spawn fire particles at sprite center
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        spawnDeathParticles(cx, cy);
        deathAnimating = true;
        deathTimer = DEATH_DURATION;
        // Hide the sprite off-screen while particles play
        this.x = -9999;
        this.velocityX = 0;
        this.velocityY = 0;
    },

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

    // Inside npc.update(goalX)
    if (this.onMouse) {
        this.stamina -= staminaDepleteRate * dt;

        if (this.stamina <= 0) {
            this.stamina = 0;
            this.onMouse = false;
            mouse.active = false; // Effectively "hides" the platform
            this.velocityY = 2;   // Start the fall
        }
    } else {
        // Regenerate stamina only when safely on a ground platform
        if (this.isGrounded) {
            this.stamina = Math.min(maxStamina, this.stamina + staminaRegenRate * dt);
            if (this.stamina <= 0) {
                this.stamina = 0;
                this.onMouse = false;
                mouse.active = false;
                this.velocityY = 2;
                narrator.trigger("The NPC ran out of stamina and fell.");
            }
        }
    }

    // Death Logic: If the NPC falls below the screen
    if (this.y > canvas.height + 100) {
        this.die();
    }

    // IDLE: stand still for a moment before running (level start / respawn)
    if (this.state === 'IDLE') {
        this.velocityX = 0;
        this.waitTimer -= dt;
        if (this.waitTimer <= 0) {
            this.waitTimer = 0;
            this.state = 'SEEKING';
        }
    }

    if (this.state === 'SEEKING') {
        // Walk toward the goal
        let direction = (goalX > this.x) ? 1 : -1;
        this.facingRight = direction === 1;
        let nextX = this.x + (direction * speed * dt);

        // Only move if there is ground, but ignore ledge detection
        // if we are very close to the goal (to allow the "win" touch)
        let hasGroundAhead = platforms.some(p =>
            nextX + this.width/2 > p.x &&
            nextX + this.width/2 < p.x + p.w &&
            Math.abs((this.y + this.height) - p.y) < 10
        );

        // Check for wall collision ahead
        let hitsWall = walls.some(w =>
            nextX + this.width > w.x &&
            nextX < w.x + w.w &&
            this.y < w.y + w.h &&
            this.y + this.height > w.y
        );

        if ((hasGroundAhead || Math.abs(goalX - this.x) < 20) && !hitsWall) {
            this.x = nextX;
            this.velocityX = 0; // movement handled directly above; prevent double movement from physics
            // Advance running animation
            this.animTimer += dt;
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

        // --- PHYSICS & ATTACHMENT ---
        if (this.onMouse) {
            const desiredX = mouse.x + (mouse.width / 2) - (this.width / 2);
            const desiredY = mouse.y - this.height;

            // Check for intersection with any platform or wall at the desired position
            const allSolids = platforms.concat(walls);
            const collidedPlatform = allSolids.find(p => {
                const npcLeft = desiredX;
                const npcRight = desiredX + this.width;
                const npcTop = desiredY;
                const npcBottom = desiredY + this.height;
                const overlapX = Math.min(npcRight, p.x + p.w) - Math.max(npcLeft, p.x);
                const overlapY = Math.min(npcBottom, p.y + p.h) - Math.max(npcTop, p.y);
                return (overlapX > 4 && overlapY > 4);
            });

            if (collidedPlatform) {
                if (desiredX > this.x) {
                    this.x = collidedPlatform.x - this.width - 0.5;
                } else {
                    this.x = collidedPlatform.x + collidedPlatform.w + 0.5;
                }
                this.onMouse = false;
                this.isGrounded = false;
                this.velocityY = 1;
                this.velocityX = 0;
            } else {
                // Snap directly to platform — hand tracking already provides smoothing
                this.x = desiredX;
                this.y = desiredY;
                this.velocityX = 0;
                this.velocityY = 0;
            }
        }

        // Clamp horizontal drift while airborne so hand jumps stay controlled.
        if (!this.onMouse) {
            const maxAirSpeed = speed * 1.5;
            if (this.velocityX > maxAirSpeed) this.velocityX = maxAirSpeed;
            if (this.velocityX < -maxAirSpeed) this.velocityX = -maxAirSpeed;
        }

        // Apply gravity only when airborne (not riding hand, not grounded)
        if (!this.onMouse && !this.isGrounded) {
            this.velocityY += gravity * dt;
        }

        // Update position (save previous Y for landing detection)
        const prevY = this.y;
        this.x += this.velocityX * dt;
        this.y += this.velocityY * dt;

        // Wall collision (horizontal blocking while airborne)
        if (!this.onMouse) {
            walls.forEach(w => {
                if (this.x + this.width > w.x &&
                    this.x < w.x + w.w &&
                    this.y < w.y + w.h &&
                    this.y + this.height > w.y) {
                    const fromLeft = (this.x + this.width) - w.x;
                    const fromRight = (w.x + w.w) - this.x;
                    if (fromLeft < fromRight) {
                        this.x = w.x - this.width;
                    } else {
                        this.x = w.x + w.w;
                    }
                    this.velocityX = 0;
                }
            });
        }

        // Reset grounded for fresh collision detection
        this.isGrounded = false;

        // Check collision with the hand platform (only when active with stamina)
        if (mouse.active && this.stamina > 0 && this.velocityY >= 0 &&
            this.x + this.width > mouse.x && this.x < mouse.x + mouse.width &&
            this.y + this.height >= mouse.y && this.y + this.height <= mouse.y + 10) {
            this.y = mouse.y - this.height;
            this.velocityY = 0;
            this.isGrounded = true;
            this.onMouse = true;
        }

        // Check collision with ALL foreground platforms (skip while carried on hand)
        if (!this.onMouse) {
            platforms.forEach(p => {
                if (this.isGrounded) return; // already landed on an earlier platform
                if (this.velocityY >= 0 &&
                    this.x + this.width > p.x &&
                    this.x < p.x + p.w &&
                    this.y + this.height >= p.y &&
                    prevY + this.height <= p.y + 1) { // small tolerance for stable grounding

                    this.y = p.y - this.height;
                    this.velocityY = 0;
                    this.isGrounded = true;
                    this.fallAnimFrame = 0;
                    this.fallAnimTimer = 0;
                    if (this.state === 'JUMPING' || this.state === 'WAITING') {
                        this.state = 'SEEKING';
                        this.velocityX = 0;
                    }
                }
            });

            // Depenetration: if NPC ended up inside a platform (e.g. hand pushed it
            // through the surface), snap to the top so it doesn't fall through
            if (!this.isGrounded && this.velocityY >= 0) {
                for (let i = 0; i < platforms.length; i++) {
                    const p = platforms[i];
                    if (this.x + this.width > p.x &&
                        this.x < p.x + p.w &&
                        this.y + this.height > p.y &&
                        this.y + this.height < p.y + p.h) {
                        this.y = p.y - this.height;
                        this.velocityY = 0;
                        this.isGrounded = true;
                        this.fallAnimFrame = 0;
                        this.fallAnimTimer = 0;
                        if (this.state === 'JUMPING' || this.state === 'WAITING') {
                            this.state = 'SEEKING';
                            this.velocityX = 0;
                        }
                        break;
                    }
                }
            }
        }

        // --- DANGER BLOCK COLLISION (narrower hitbox) ---
        const hbLeft = this.x + this.hitboxInsetX;
        const hbRight = this.x + this.width - this.hitboxInsetX;
        for (let i = 0; i < dangerBlocks.length; i++) {
            const d = dangerBlocks[i];
            if (hbRight > d.x &&
                hbLeft < d.x + d.width &&
                this.y + this.height > d.y &&
                this.y < d.y + d.height) {
                this.die();
                break;
            }
        }

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
        // Round to whole pixels to prevent sub-pixel shimmer/jitter
        const dx = Math.round(this.x);
        const dy = Math.round(this.y);
        const mx = Math.round(mouse.x);
        const my = Math.round(mouse.y);

        // Determine if we should use the running animation
        const isRunning = this.state === 'SEEKING' && this.isGrounded && !this.onMouse
            && this.runFramesLoaded === 3;

        // Determine if we should use the jumping animation (rising only)
        const isJumping = !this.isGrounded && !this.onMouse && this.velocityY < 0
            && this.jumpFramesLoaded === 2;

        // Determine if we should use the falling animation (descending)
        const isFalling = !this.isGrounded && !this.onMouse && this.velocityY >= 0
            && this.fallFramesLoaded === 2;

        if (isFalling) {
            // Cycle between Fall 1 and Fall 2
            this.fallAnimTimer += dt;
            if (this.fallAnimTimer >= this.fallAnimSpeed) {
                this.fallAnimTimer = 0;
                this.fallAnimFrame = (this.fallAnimFrame + 1) % 2;
            }
            const frame = this.fallFrames[this.fallAnimFrame];
            ctx.save();
            if (!this.facingRight) {
                ctx.translate(dx + this.width, dy);
                ctx.scale(-1, 1);
                ctx.drawImage(frame, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(frame, dx, dy, this.width, this.height);
            }
            ctx.restore();
        } else if (isJumping) {
            // Jump 1 while rising
            const frame = this.jumpFrames[0];
            ctx.save();
            if (!this.facingRight) {
                ctx.translate(dx + this.width, dy);
                ctx.scale(-1, 1);
                ctx.drawImage(frame, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(frame, dx, dy, this.width, this.height);
            }
            ctx.restore();
        } else if (isRunning) {
            const frame = this.runFrames[this.animFrame];
            // Bob up and down: middle frame is raised, first and last are grounded
            const bobOffsets = [0, -3, -1];
            const drawY = dy + bobOffsets[this.animFrame];
            ctx.save();
            if (!this.facingRight) {
                ctx.translate(dx + this.width, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(frame, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(frame, dx, drawY, this.width, this.height);
            }
            ctx.restore();
        } else if (this.spriteLoaded && this.sprite) {
            ctx.drawImage(this.sprite, dx, dy, this.width, this.height);
        } else {
            ctx.fillStyle = (this.onMouse && mouse.isLocked) ? '#2ecc71' :
                            (this.state === 'JUMPING' ? 'orange' : 'royalblue');
            ctx.fillRect(dx, dy, this.width, this.height);
        }

        // Only show the jump trajectory if the NPC is on the mouse and it's locked
        if (this.state === 'WAITING' || (this.onMouse && mouse.isLocked)) {
            this.drawJumpArc();
        }

        // Stamina bar
        if (this.stamina < maxStamina) {
            const barWidth = this.width;
            const barHeight = 6;
            const healthPercent = this.stamina / maxStamina;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(dx, dy - 15, barWidth, barHeight);

            // Stamina color (green to red)
            ctx.fillStyle = healthPercent > 0.3 ? '#2ecc71' : '#e74c3c';
            ctx.fillRect(dx, dy - 15, barWidth * healthPercent, barHeight);
        }

        // Draw the shadow platform if active and stamina remains
        if (mouse.active && this.stamina > 0) {
            ctx.fillStyle = mouse.isLocked ? '#0a0a1a' : 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(mx, my, mouse.width, mouse.height);
        }
    }
};

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

// Load falling animation frames
npc.fallFrames = [];
npc.fallFramesLoaded = 0;
npc.fallAnimFrame = 0;
npc.fallAnimTimer = 0;
npc.fallAnimSpeed = 8; // frames between fall animation switches
for (let i = 1; i <= 2; i++) {
    const img = new Image();
    img.src = 'Assets/Sprite/Falling/Fall ' + i + '.png';
    img.onload = () => { npc.fallFramesLoaded++; };
    npc.fallFrames.push(img);
}
