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

    function drawFireParticle(p) {
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
        fCtx.fillStyle = 'rgba(' + (r | 0) + ', ' + (g | 0) + ', ' + (b | 0) + ', ' + p.life + ')';
        fCtx.fill();
    }

    function updateParticles(arr) {
        for (let i = arr.length - 1; i >= 0; i--) {
            const p = arr[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.size *= 0.98;
            if (p.life <= 0) {
                arr.splice(i, 1);
            }
        }
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

        updateParticles(particles);

        for (let i = 0; i < particles.length; i++) {
            drawFireParticle(particles[i]);
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

    // --- Audio ---
    const gameStartAudio = new Audio('Assets/game_start.mp3');
    const pianoAudio = new Audio("Assets/See Siang Wong - One Summer's Day  From the Soundtrack to Spirited Away by Joe Hisaishi.mp3");
    pianoAudio.volume = 0.7;

    // --- Sprite-surrounding fire particles ---
    let spriteParticles = [];
    const MAX_SPRITE_PARTICLES = 45;

    function spawnSpriteParticle(cx, cy, w, h) {
        // Spawn around the edges of the sprite
        const side = Math.random();
        let px, py;
        if (side < 0.3) {
            // Left/right edges
            px = cx + (Math.random() < 0.5 ? -w / 2 : w / 2) + (Math.random() - 0.5) * 10;
            py = cy + (Math.random() - 0.5) * h;
        } else if (side < 0.6) {
            // Bottom edge (fire rises from feet)
            px = cx + (Math.random() - 0.5) * w;
            py = cy + h / 2 + Math.random() * 5;
        } else {
            // Around body
            px = cx + (Math.random() - 0.5) * w * 1.2;
            py = cy + (Math.random() - 0.5) * h * 0.8;
        }
        spriteParticles.push({
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -(1.0 + Math.random() * 2.5),
            life: 1.0,
            decay: 0.02 + Math.random() * 0.02,
            size: 2 + Math.random() * 4
        });
    }

    // --- Title fire particles ---
    let titleParticles = [];
    const MAX_TITLE_PARTICLES = 55;

    function spawnTitleParticle(tx, ty, tw, th) {
        const px = tx + Math.random() * tw;
        const py = ty + Math.random() * th;
        titleParticles.push({
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 2.0,
            vy: -(1.5 + Math.random() * 3.0),
            life: 1.0,
            decay: 0.015 + Math.random() * 0.018,
            size: 2 + Math.random() * 4.5
        });
    }

    // --- Click Handler ---
    startScreen.addEventListener('click', function onClick() {
        startScreen.removeEventListener('click', onClick);
        cancelAnimationFrame(fireAnimId);

        // Play the game start sound
        gameStartAudio.currentTime = 0;
        gameStartAudio.play().catch(function () {});

        // Wait for both fire fade and audio to complete before showing sprite
        let firePhaseComplete = false;
        let audioComplete = false;

        function proceedAfterAudio() {
            if (firePhaseComplete && audioComplete) {
                spriteParticles = [];
                phaseFlickerSprite();
            }
        }

        gameStartAudio.addEventListener('ended', function onEnded() {
            gameStartAudio.removeEventListener('ended', onEnded);
            audioComplete = true;
            proceedAfterAudio();
        });

        gameStartAudio.addEventListener('error', function onError() {
            gameStartAudio.removeEventListener('error', onError);
            audioComplete = true;
            proceedAfterAudio();
        });

        // PHASE 1: Fade out the ember
        let fireOpacity = 1;
        function fadeOutFire() {
            fireOpacity -= 0.03;
            if (fireOpacity <= 0) {
                fCtx.clearRect(0, 0, W, H);
                firePhaseComplete = true;
                proceedAfterAudio();
                return;
            }
            fCtx.clearRect(0, 0, W, H);
            fCtx.save();
            fCtx.globalAlpha = fireOpacity;
            drawFire();
            fCtx.restore();
            requestAnimationFrame(fadeOutFire);
        }

        // PHASE 2: Sprite fades in with flickering + fire particles
        const spriteImg = new Image();
        spriteImg.src = 'Assets/Sprite/player.png';

        function phaseFlickerSprite() {
            // Play piano clip 1 second after sprite appears, stop after 11s
            setTimeout(function () {
                pianoAudio.currentTime = 0;
                pianoAudio.play().catch(function () {});
                // Fade out and stop after 11 seconds
                setTimeout(function () {
                    let fadeVol = pianoAudio.volume;
                    const fadeInterval = setInterval(function () {
                        fadeVol -= 0.05;
                        if (fadeVol <= 0) {
                            fadeVol = 0;
                            pianoAudio.pause();
                            pianoAudio.currentTime = 0;
                            clearInterval(fadeInterval);
                        }
                        pianoAudio.volume = fadeVol;
                    }, 50);
                }, 11000);
            }, 1000);

            let spriteOpacity = 0;
            let flickerTimer = 0;
            let holdTimer = 0;
            const spriteW = 160;
            const spriteH = 200;
            const sx = (W - spriteW) / 2;
            const sy = (H - spriteH) / 2;
            const spriteCX = W / 2;
            const spriteCY = H / 2;
            const fadeInDuration = 80;  // frames to fade in
            const holdDuration = 90;    // frames to hold fully visible

            function drawSpriteFrame() {
                fCtx.clearRect(0, 0, W, H);
                flickerTimer++;

                // Fade in
                if (spriteOpacity < 1) {
                    spriteOpacity += 1 / fadeInDuration;
                    if (spriteOpacity > 1) spriteOpacity = 1;
                }

                // Flickering effect: oscillate opacity slightly
                const flicker = 0.85 + 0.15 * Math.sin(flickerTimer * 0.4) * Math.sin(flickerTimer * 0.17);
                const drawAlpha = spriteOpacity * flicker;

                // Warm glow behind the sprite
                fCtx.save();
                const glow = fCtx.createRadialGradient(spriteCX, spriteCY, 10, spriteCX, spriteCY, 120);
                glow.addColorStop(0, 'rgba(255, 120, 30, ' + (0.2 * spriteOpacity) + ')');
                glow.addColorStop(0.5, 'rgba(255, 60, 0, ' + (0.08 * spriteOpacity) + ')');
                glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                fCtx.fillStyle = glow;
                fCtx.fillRect(0, 0, W, H);
                fCtx.restore();

                // Draw the sprite
                fCtx.save();
                fCtx.globalAlpha = drawAlpha;
                if (spriteImg.complete && spriteImg.naturalWidth > 0) {
                    fCtx.drawImage(spriteImg, sx, sy, spriteW, spriteH);
                } else {
                    fCtx.fillStyle = 'royalblue';
                    fCtx.fillRect(sx, sy, spriteW, spriteH);
                }
                fCtx.restore();

                // Spawn fire particles around the sprite
                for (let i = 0; i < 2; i++) {
                    if (spriteParticles.length < MAX_SPRITE_PARTICLES) {
                        spawnSpriteParticle(spriteCX, spriteCY, spriteW, spriteH);
                    }
                }
                updateParticles(spriteParticles);

                fCtx.save();
                fCtx.globalAlpha = spriteOpacity;
                for (let i = 0; i < spriteParticles.length; i++) {
                    drawFireParticle(spriteParticles[i]);
                }
                fCtx.restore();

                if (spriteOpacity >= 1) {
                    holdTimer++;
                }

                if (holdTimer < holdDuration) {
                    requestAnimationFrame(drawSpriteFrame);
                } else {
                    // Move to fade-out
                    phaseFadeOutSprite();
                }
            }
            requestAnimationFrame(drawSpriteFrame);
        }

        // PHASE 3: Sprite fades out
        function phaseFadeOutSprite() {
            let fadeOut = 1;
            const spriteW = 160;
            const spriteH = 200;
            const sx = (W - spriteW) / 2;
            const sy = (H - spriteH) / 2;
            const spriteCX = W / 2;
            const spriteCY = H / 2;
            let flickerTimer = 0;

            function drawFadeOut() {
                fCtx.clearRect(0, 0, W, H);
                fadeOut -= 0.02;
                flickerTimer++;
                if (fadeOut <= 0) {
                    fCtx.clearRect(0, 0, W, H);
                    titleParticles = [];
                    phaseTitleReveal();
                    return;
                }

                const flicker = 0.8 + 0.2 * Math.sin(flickerTimer * 0.5);
                const alpha = fadeOut * flicker;

                // Glow
                fCtx.save();
                const glow = fCtx.createRadialGradient(spriteCX, spriteCY, 10, spriteCX, spriteCY, 120);
                glow.addColorStop(0, 'rgba(255, 120, 30, ' + (0.2 * fadeOut) + ')');
                glow.addColorStop(0.5, 'rgba(255, 60, 0, ' + (0.08 * fadeOut) + ')');
                glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                fCtx.fillStyle = glow;
                fCtx.fillRect(0, 0, W, H);
                fCtx.restore();

                fCtx.save();
                fCtx.globalAlpha = alpha;
                if (spriteImg.complete && spriteImg.naturalWidth > 0) {
                    fCtx.drawImage(spriteImg, sx, sy, spriteW, spriteH);
                } else {
                    fCtx.fillStyle = 'royalblue';
                    fCtx.fillRect(sx, sy, spriteW, spriteH);
                }
                fCtx.restore();

                // Keep particles going but fading
                updateParticles(spriteParticles);
                fCtx.save();
                fCtx.globalAlpha = fadeOut;
                for (let i = 0; i < spriteParticles.length; i++) {
                    drawFireParticle(spriteParticles[i]);
                }
                fCtx.restore();

                requestAnimationFrame(drawFadeOut);
            }
            requestAnimationFrame(drawFadeOut);
        }

        // PHASE 4: Title "A Spark in the Dark" with fire particles (click to skip)
        let titleSkipped = false;
        function skipTitle() {
            if (titleSkipped) return;
            titleSkipped = true;
            fireCanvas.removeEventListener('click', skipTitle);
            startScreen.removeEventListener('click', skipTitle);
            pianoAudio.pause();
            pianoAudio.currentTime = 0;
            fCtx.clearRect(0, 0, W, H);
            startGame();
        }

        function phaseTitleReveal() {
            fireCanvas.addEventListener('click', skipTitle);
            startScreen.addEventListener('click', skipTitle);
            fireCanvas.style.cursor = 'pointer';
            let titleOpacity = 0;
            let holdTimer = 0;
            const fadeInFrames = 70;
            const holdFrames = 140;

            // Measure title dimensions for particle spawning
            fCtx.font = '900 38px "Cinzel Decorative", serif';
            const titleText = 'A Spark in the Dark';
            const measured = fCtx.measureText(titleText);
            const textW = measured.width;
            const textX = (W - textW) / 2;
            const textY = H / 2 + 10;
            const textH = 50; // approximate height for particle spawning

            function drawTitle() {
                if (titleSkipped) return;
                fCtx.clearRect(0, 0, W, H);

                // Fade in
                if (titleOpacity < 1) {
                    titleOpacity += 1 / fadeInFrames;
                    if (titleOpacity > 1) titleOpacity = 1;
                }

                // Warm glow behind the title
                fCtx.save();
                const glow = fCtx.createRadialGradient(W / 2, textY - 10, 20, W / 2, textY - 10, 200);
                glow.addColorStop(0, 'rgba(255, 100, 20, ' + (0.18 * titleOpacity) + ')');
                glow.addColorStop(0.5, 'rgba(255, 50, 0, ' + (0.06 * titleOpacity) + ')');
                glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                fCtx.fillStyle = glow;
                fCtx.fillRect(0, 0, W, H);
                fCtx.restore();

                // Draw the title text
                fCtx.save();
                fCtx.globalAlpha = titleOpacity;
                fCtx.font = '900 38px "Cinzel Decorative", serif';
                fCtx.textAlign = 'center';
                fCtx.textBaseline = 'middle';

                // Fire-colored text with glow
                fCtx.shadowColor = 'rgba(255, 100, 20, 0.8)';
                fCtx.shadowBlur = 20;
                fCtx.fillStyle = '#ffd6a0';
                fCtx.fillText(titleText, W / 2, textY);

                // Second pass for brighter inner glow
                fCtx.shadowColor = 'rgba(255, 180, 60, 0.6)';
                fCtx.shadowBlur = 10;
                fCtx.fillStyle = '#ffe8c8';
                fCtx.fillText(titleText, W / 2, textY);
                fCtx.restore();

                // Spawn fire particles around the title
                for (let i = 0; i < 3; i++) {
                    if (titleParticles.length < MAX_TITLE_PARTICLES) {
                        spawnTitleParticle(textX, textY - textH / 2, textW, textH);
                    }
                }
                updateParticles(titleParticles);

                fCtx.save();
                fCtx.globalAlpha = titleOpacity;
                for (let i = 0; i < titleParticles.length; i++) {
                    drawFireParticle(titleParticles[i]);
                }
                fCtx.restore();

                if (titleOpacity >= 1) {
                    holdTimer++;
                }

                if (holdTimer < holdFrames) {
                    requestAnimationFrame(drawTitle);
                } else {
                    phaseFadeOutTitle();
                }
            }
            requestAnimationFrame(drawTitle);
        }

        // PHASE 5: Fade out title, then start game
        function phaseFadeOutTitle() {
            let fadeOut = 1;

            function drawFade() {
                if (titleSkipped) return;
                fadeOut -= 0.02;
                if (fadeOut <= 0) {
                    fCtx.clearRect(0, 0, W, H);
                    fireCanvas.removeEventListener('click', skipTitle);
                    startScreen.removeEventListener('click', skipTitle);
                    startGame();
                    return;
                }

                // Redraw the title at reduced opacity
                fCtx.clearRect(0, 0, W, H);

                // Glow
                fCtx.save();
                const glow = fCtx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 200);
                glow.addColorStop(0, 'rgba(255, 100, 20, ' + (0.18 * fadeOut) + ')');
                glow.addColorStop(0.5, 'rgba(255, 50, 0, ' + (0.06 * fadeOut) + ')');
                glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                fCtx.fillStyle = glow;
                fCtx.fillRect(0, 0, W, H);
                fCtx.restore();

                fCtx.save();
                fCtx.globalAlpha = fadeOut;
                fCtx.font = '900 38px "Cinzel Decorative", serif';
                fCtx.textAlign = 'center';
                fCtx.textBaseline = 'middle';
                fCtx.shadowColor = 'rgba(255, 100, 20, 0.8)';
                fCtx.shadowBlur = 20;
                fCtx.fillStyle = '#ffd6a0';
                fCtx.fillText('A Spark in the Dark', W / 2, H / 2 + 10);
                fCtx.restore();

                // Fade particles
                updateParticles(titleParticles);
                fCtx.save();
                fCtx.globalAlpha = fadeOut;
                for (let i = 0; i < titleParticles.length; i++) {
                    drawFireParticle(titleParticles[i]);
                }
                fCtx.restore();

                requestAnimationFrame(drawFade);
            }
            requestAnimationFrame(drawFade);
        }

        fadeOutFire();
    });

    function startGame() {
        startScreen.classList.add('hidden');
        setTimeout(function () {
            startScreen.style.display = 'none';
            gameStarted = true;
            showLevelSelect();
        }, 1000);
    }
})();
