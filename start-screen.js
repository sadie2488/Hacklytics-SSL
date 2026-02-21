(function () {
    const startScreen = document.getElementById('start-screen');
    const fireCanvas = document.getElementById('fireCanvas');
    const fCtx = fireCanvas.getContext('2d');

    const W = fireCanvas.width;
    const H = fireCanvas.height;
    const fireX = W / 2;
    const fireY = H / 2 + 30;

    // --- Fire Particle System ---
    const particles = [];
    const MAX_PARTICLES = 60;

    function spawnParticle() {
        particles.push({
            x: fireX + (Math.random() - 0.5) * 16,
            y: fireY,
            vx: (Math.random() - 0.5) * 1.2,
            vy: -(1.5 + Math.random() * 2.5),
            life: 1.0,
            decay: 0.015 + Math.random() * 0.015,
            size: 3 + Math.random() * 5
        });
    }

    function drawFire() {
        fCtx.clearRect(0, 0, W, H);

        // Glow behind the fire
        const glow = fCtx.createRadialGradient(fireX, fireY - 20, 5, fireX, fireY - 20, 70);
        glow.addColorStop(0, 'rgba(255, 120, 20, 0.25)');
        glow.addColorStop(0.5, 'rgba(255, 60, 0, 0.08)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fCtx.fillStyle = glow;
        fCtx.fillRect(0, 0, W, H);

        // Spawn new particles
        for (let i = 0; i < 3; i++) {
            if (particles.length < MAX_PARTICLES) spawnParticle();
        }

        // Update and draw particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.size *= 0.98;

            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }

            // Color shifts from bright yellow → orange → dark red as life decreases
            let r, g, b;
            if (p.life > 0.6) {
                r = 255;
                g = 180 + (p.life - 0.6) * 180;
                b = 40;
            } else if (p.life > 0.3) {
                r = 255;
                g = 80 + (p.life - 0.3) * 330;
                b = 10;
            } else {
                r = 180 + p.life * 250;
                g = p.life * 200;
                b = 0;
            }

            fCtx.beginPath();
            fCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            fCtx.fillStyle = `rgba(${r|0}, ${g|0}, ${b|0}, ${p.life})`;
            fCtx.fill();
        }

        // Small bright core
        fCtx.beginPath();
        fCtx.arc(fireX, fireY, 6 + Math.random() * 2, 0, Math.PI * 2);
        fCtx.fillStyle = 'rgba(255, 220, 100, 0.9)';
        fCtx.fill();
    }

    // --- Animation Loop ---
    let fireAnimId;
    function animateFire() {
        drawFire();
        fireAnimId = requestAnimationFrame(animateFire);
    }
    animateFire();

    // --- Click Handler ---
    startScreen.addEventListener('click', function onClick() {
        startScreen.removeEventListener('click', onClick);
        cancelAnimationFrame(fireAnimId);

        // Fade out fire, then show NPC sprite fading in
        let fireOpacity = 1;
        function fadeOutFire() {
            fireOpacity -= 0.03;
            if (fireOpacity <= 0) {
                fCtx.clearRect(0, 0, W, H);
                fadeInSprite();
                return;
            }
            fCtx.clearRect(0, 0, W, H);
            fCtx.save();
            fCtx.globalAlpha = fireOpacity;
            drawFire();
            fCtx.restore();
            requestAnimationFrame(fadeOutFire);
        }

        // Load and fade in the NPC sprite
        const spriteImg = new Image();
        spriteImg.src = 'assets/player.png';

        function fadeInSprite() {
            let spriteOpacity = 0;
            const spriteW = 120;
            const spriteH = 150;
            const sx = (W - spriteW) / 2;
            const sy = (H - spriteH) / 2;

            function drawSpriteFrame() {
                spriteOpacity += 0.015;
                fCtx.clearRect(0, 0, W, H);

                fCtx.save();
                fCtx.globalAlpha = Math.min(spriteOpacity, 1);
                if (spriteImg.complete && spriteImg.naturalWidth > 0) {
                    fCtx.drawImage(spriteImg, sx, sy, spriteW, spriteH);
                } else {
                    fCtx.fillStyle = 'royalblue';
                    fCtx.fillRect(sx, sy, spriteW, spriteH);
                }
                fCtx.restore();

                if (spriteOpacity < 1) {
                    requestAnimationFrame(drawSpriteFrame);
                } else {
                    // Hold the sprite visible briefly, then transition to game
                    setTimeout(startGame, 800);
                }
            }
            requestAnimationFrame(drawSpriteFrame);
        }

        fadeOutFire();
    });

    function startGame() {
        startScreen.classList.add('hidden');
        setTimeout(function () {
            startScreen.style.display = 'none';
            gameStarted = true;
            gameLoop();
        }, 1000);
    }
})();
