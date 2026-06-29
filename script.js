/**
 * FLUX — Interactive Particle Field
 * 
 * A living, breathing particle system that responds to every gesture.
 * Built with vanilla JS and Canvas 2D, optimized for 60fps with thousands
 * of particles. No libraries, no shortcuts.
 */

(function() {
    'use strict';

    // ──────────────────────────────────────────────
    // DOM refs
    // ──────────────────────────────────────────────
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const cursorDot = document.getElementById('cursor-dot');
    const cursorRing = document.getElementById('cursor-ring');
    const centerMessage = document.getElementById('center-message');
    const fpsDisplay = document.getElementById('fps-display');
    const hint = document.getElementById('hint');
    const fullscreenBtn = document.getElementById('fullscreen');
    const modeButtons = document.querySelectorAll('.mode');

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────
    let width, height, centerX, centerY, dpr;
    let particles = [];
    let mouse = { x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, speed: 0 };
    let cursor = { ...mouse, isPressed: false, moved: false, lastMoveTime: 0 };
    let mode = 'field';
    let time = 0;
    let frameCount = 0;
    let fps = 60;
    let fpsTimer = 0;
    let rippleWaves = [];
    let burstActive = false;
    let burstOrigin = { x: 0, y: 0 };
    let burstStartTime = 0;
    let lastClickTime = 0;
    let cursorVisible = true;

    // ──────────────────────────────────────────────
    // Configuration
    // ──────────────────────────────────────────────
    const PARTICLE_COUNT = 2200;
    const MAX_DIST = 280;
    const REPEL_FORCE = 1.8;
    const ATTRACT_FORCE = 0.6;
    const VORTEX_FORCE = 2.5;
    const GALAXY_ARM_COUNT = 3;
    const BURST_FORCE = 22;
    const BURST_DURATION = 900;
    const RIPPLE_SPEED = 380;
    const RIPPLE_LIFETIME = 1.6;
    const FRICTION = 0.96;
    const RETURN_FORCE = 0.008;
    const IDLE_FLOW_SPEED = 0.3;
    const IDLE_TIMEOUT = 2000;

    // Color palette — intentionally restrained
    const palette = [
        { r: 160, g: 140, b: 250 }, // soft violet
        { r: 130, g: 160, b: 250 }, // periwinkle
        { r: 200, g: 160, b: 240 }, // lavender
        { r: 120, g: 200, b: 230 }, // sky
        { r: 180, g: 140, b: 220 }, // muted purple
        { r: 220, g: 180, b: 250 }, // light lilac
    ];

    // ──────────────────────────────────────────────
    // Particle class
    // ──────────────────────────────────────────────
    class Particle {
        constructor() {
            this.homeX = 0;
            this.homeY = 0;
            this.x = 0;
            this.y = 0;
            this.vx = 0;
            this.vy = 0;
            this.radius = 0;
            this.color = palette[0];
            this.alpha = 0;
            this.phase = 0;
            this.trail = [];
            this.maxTrail = 0;
        }

        init() {
            this.homeX = random(0, width);
            this.homeY = random(0, height);
            this.x = this.homeX;
            this.y = this.homeY;
            this.vx = 0;
            this.vy = 0;
            this.radius = random(1.2, 3.8);
            this.color = palette[Math.floor(random(0, palette.length))];
            this.alpha = random(0.25, 0.8);
            this.phase = random(0, Math.PI * 2);
            this.trail = [];
            this.maxTrail = Math.floor(random(4, 18));
        }

        applyForce(fx, fy) {
            this.vx += fx;
            this.vy += fy;
        }

        update() {
            // Trail
            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > this.maxTrail) this.trail.shift();

            const dx = cursor.x - this.x;
            const dy = cursor.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const normX = dist > 0 ? dx / dist : 0;
            const normY = dist > 0 ? dy / dist : 0;
            const influence = Math.max(0, 1 - dist / MAX_DIST);
            const eased = influence * influence; // quadratic falloff

            // ── Mode-specific forces ──
            switch (mode) {
                case 'field':
                    if (dist < MAX_DIST && cursor.moved) {
                        const force = eased * REPEL_FORCE;
                        this.applyForce(-normX * force, -normY * force);
                    }
                    // Return home
                    this.applyForce(
                        (this.homeX - this.x) * RETURN_FORCE,
                        (this.homeY - this.y) * RETURN_FORCE
                    );
                    break;

                case 'attract':
                    if (dist < MAX_DIST && cursor.moved) {
                        const force = eased * ATTRACT_FORCE * 3;
                        this.applyForce(normX * force, normY * force);
                        // Slight orbit
                        this.applyForce(-normY * force * 0.5, normX * force * 0.5);
                    }
                    this.applyForce(
                        (this.homeX - this.x) * RETURN_FORCE * 0.5,
                        (this.homeY - this.y) * RETURN_FORCE * 0.5
                    );
                    break;

                case 'repel':
                    if (dist < MAX_DIST * 1.3 && cursor.moved) {
                        const force = eased * REPEL_FORCE * 2;
                        this.applyForce(-normX * force, -normY * force);
                        // Add lateral drift
                        this.applyForce(-normY * force * 0.3, normX * force * 0.3);
                    }
                    this.applyForce(
                        (this.homeX - this.x) * RETURN_FORCE * 0.3,
                        (this.homeY - this.y) * RETURN_FORCE * 0.3
                    );
                    break;

                case 'vortex':
                    if (dist < MAX_DIST && cursor.moved) {
                        const spinForce = eased * VORTEX_FORCE;
                        if (cursor.isPressed) {
                            // Tight inward spiral
                            this.applyForce(-normX * spinForce * 0.7, -normY * spinForce * 0.7);
                            this.applyForce(-normY * spinForce * 1.4, normX * spinForce * 1.4);
                        } else {
                            // Loose outward spiral
                            this.applyForce(normX * spinForce * 0.2, normY * spinForce * 0.2);
                            this.applyForce(-normY * spinForce, normX * spinForce);
                        }
                    }
                    this.applyForce(
                        (this.homeX - this.x) * RETURN_FORCE * 0.2,
                        (this.homeY - this.y) * RETURN_FORCE * 0.2
                    );
                    break;

                case 'galaxy':
                    if (dist < MAX_DIST * 1.6) {
                        const armAngle = (Math.atan2(dy, dx) * GALAXY_ARM_COUNT + this.phase) % (Math.PI * 2);
                        const armInfluence = Math.abs(Math.sin(armAngle));
                        const force = eased * 1.5 * (0.4 + armInfluence * 0.6);
                        const tangentX = -normY;
                        const tangentY = normX;
                        this.applyForce(tangentX * force, tangentY * force);
                        if (cursor.isPressed) {
                            this.applyForce(-normX * force * 0.5, -normY * force * 0.5);
                        }
                    }
                    // Gentle drift toward cursor when idle
                    if (!cursor.moved && dist > 100 && dist < 600) {
                        this.applyForce(normX * 0.03, normY * 0.03);
                    }
                    this.applyForce(
                        (this.homeX - this.x) * RETURN_FORCE * 0.15,
                        (this.homeY - this.y) * RETURN_FORCE * 0.15
                    );
                    break;
            }

            // ── Burst (overrides other forces) ──
            if (burstActive) {
                const elapsed = time - burstStartTime;
                if (elapsed < BURST_DURATION) {
                    const bx = this.x - burstOrigin.x;
                    const by = this.y - burstOrigin.y;
                    const bDist = Math.sqrt(bx * bx + by * by) || 1;
                    const bForce = BURST_FORCE * (1 - elapsed / BURST_DURATION);
                    this.applyForce((bx / bDist) * bForce, (by / bDist) * bForce);
                } else {
                    burstActive = false;
                }
            }

            // ── Idle flow (when mouse hasn't moved) ──
            const timeSinceMove = time - cursor.lastMoveTime;
            if (timeSinceMove > IDLE_TIMEOUT && !cursor.isPressed) {
                const flowX = Math.sin(time * 0.0008 + this.phase) * IDLE_FLOW_SPEED;
                const flowY = Math.cos(time * 0.0006 + this.phase + 1.3) * IDLE_FLOW_SPEED;
                this.applyForce(flowX, flowY);
            }

            // ── Universal physics ──
            this.vx *= FRICTION;
            this.vy *= FRICTION;
            this.x += this.vx;
            this.y += this.vy;

            // Soft boundary containment
            const margin = 40;
            if (this.x < -margin) this.vx += 0.3;
            if (this.x > width + margin) this.vx -= 0.3;
            if (this.y < -margin) this.vy += 0.3;
            if (this.y > height + margin) this.vy -= 0.3;
        }

        draw(ctx) {
            // Trail
            if (this.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(this.trail[0].x, this.trail[0].y);
                for (let i = 1; i < this.trail.length; i++) {
                    ctx.lineTo(this.trail[i].x, this.trail[i].y);
                }
                ctx.strokeStyle = `rgba(${this.color.r},${this.color.g},${this.color.b},0.08)`;
                ctx.lineWidth = this.radius * 0.7;
                ctx.lineCap = 'round';
                ctx.stroke();
            }

            // Glow
            const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 3);
            glow.addColorStop(0, `rgba(${this.color.r},${this.color.g},${this.color.b},${this.alpha * 0.6})`);
            glow.addColorStop(0.4, `rgba(${this.color.r},${this.color.g},${this.color.b},${this.alpha * 0.2})`);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 3, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            // Core
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color.r},${this.color.g},${this.color.b},${this.alpha})`;
            ctx.fill();
        }
    }

    // ──────────────────────────────────────────────
    // Ripple wave
    // ──────────────────────────────────────────────
    class RippleWave {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.radius = 0;
            this.maxRadius = random(180, 400);
            this.opacity = 0.5;
            this.born = time;
        }

        update() {
            const age = (time - this.born) / 1000; // Convert to seconds
            this.radius = age * RIPPLE_SPEED;
            this.opacity = Math.max(0, 0.5 * (1 - age / RIPPLE_LIFETIME));
            return this.opacity > 0 && this.radius < this.maxRadius;
        }

        draw(ctx) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(160,140,250,${this.opacity * 0.5})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Second ring (delayed)
            const innerRadius = this.radius * 0.6;
            if (innerRadius > 0) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, innerRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(160,140,250,${this.opacity * 0.25})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────
    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2); // cap for perf
        width = window.innerWidth;
        height = window.innerHeight;
        centerX = width / 2;
        centerY = height / 2;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
    }

    function createParticles() {
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const p = new Particle();
            p.init();
            particles.push(p);
        }
    }

    function addRipple(x, y) {
        rippleWaves.push(new RippleWave(x, y));
        if (rippleWaves.length > 12) rippleWaves.shift();
    }

    function triggerBurst(x, y) {
        burstActive = true;
        burstOrigin.x = x;
        burstOrigin.y = y;
        burstStartTime = time;
        // Multiple ripples for the burst
        for (let i = 0; i < 3; i++) {
            setTimeout(() => addRipple(x, y), i * 60);
        }
    }

    // ──────────────────────────────────────────────
    // Cursor visibility
    // ──────────────────────────────────────────────
    function showCustomCursor() {
        cursorDot.style.opacity = '1';
        cursorRing.style.opacity = '1';
    }

    function hideCustomCursor() {
        cursorDot.style.opacity = '0';
        cursorRing.style.opacity = '0';
    }

    // ──────────────────────────────────────────────
    // Event listeners
    // ──────────────────────────────────────────────
    function onMouseMove(e) {
        cursor.prevX = cursor.x;
        cursor.prevY = cursor.y;
        cursor.x = e.clientX;
        cursor.y = e.clientY;
        cursor.vx = cursor.x - cursor.prevX;
        cursor.vy = cursor.y - cursor.prevY;
        cursor.speed = Math.sqrt(cursor.vx * cursor.vx + cursor.vy * cursor.vy);
        cursor.moved = true;
        cursor.lastMoveTime = time;

        // Show custom cursor on move
        if (!cursorVisible) {
            cursorVisible = true;
            showCustomCursor();
        }

        // Update custom cursor position
        cursorDot.style.left = cursor.x + 'px';
        cursorDot.style.top = cursor.y + 'px';
        cursorRing.style.left = cursor.x + 'px';
        cursorRing.style.top = cursor.y + 'px';

        if (cursor.speed > 15) {
            cursorRing.classList.add('moving-fast');
        } else {
            cursorRing.classList.remove('moving-fast');
        }

        // Fade center message
        if (cursor.moved && !centerMessage.classList.contains('faded')) {
            centerMessage.classList.add('faded');
        }
    }

    function onMouseDown(e) {
        cursor.isPressed = true;
        cursorRing.classList.add('pressed');
        const now = performance.now();
        if (now - lastClickTime < 300) {
            // Double click
            triggerBurst(cursor.x, cursor.y);
            lastClickTime = 0;
        } else {
            addRipple(cursor.x, cursor.y);
            lastClickTime = now;
        }
    }

    function onMouseUp() {
        cursor.isPressed = false;
        cursorRing.classList.remove('pressed');
    }

    function onMouseEnter() {
        cursorVisible = true;
        showCustomCursor();
        cursor.moved = true;
    }

    function onMouseLeave() {
        cursorVisible = false;
        hideCustomCursor();
        cursor.moved = false;
    }

    function onTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
            cursor.prevX = cursor.x;
            cursor.prevY = cursor.y;
            cursor.x = touch.clientX;
            cursor.y = touch.clientY;
            cursor.vx = cursor.x - cursor.prevX;
            cursor.vy = cursor.y - cursor.prevY;
            cursor.speed = Math.sqrt(cursor.vx * cursor.vx + cursor.vy * cursor.vy);
            cursor.moved = true;
            cursor.lastMoveTime = time;

            if (!cursorVisible) {
                cursorVisible = true;
                showCustomCursor();
            }

            cursorDot.style.left = cursor.x + 'px';
            cursorDot.style.top = cursor.y + 'px';
            cursorRing.style.left = cursor.x + 'px';
            cursorRing.style.top = cursor.y + 'px';

            if (cursor.moved && !centerMessage.classList.contains('faded')) {
                centerMessage.classList.add('faded');
            }
        }
    }

    function onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
            cursor.x = touch.clientX;
            cursor.y = touch.clientY;
            cursorDot.style.left = cursor.x + 'px';
            cursorDot.style.top = cursor.y + 'px';
            cursorRing.style.left = cursor.x + 'px';
            cursorRing.style.top = cursor.y + 'px';
            onMouseDown();
        }
    }

    function onTouchEnd(e) {
        e.preventDefault();
        onMouseUp();
    }

    function onKeyDown(e) {
        const keyMap = {
            '1': 'field',
            '2': 'attract',
            '3': 'repel',
            '4': 'vortex',
            '5': 'galaxy',
        };
        if (keyMap[e.key]) {
            setMode(keyMap[e.key]);
        }
        if (e.key === 'f' || e.key === 'F') {
            toggleFullscreen();
        }
    }

    function setMode(newMode) {
        mode = newMode;
        modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    }

    // ──────────────────────────────────────────────
    // Render loop
    // ──────────────────────────────────────────────
    function render(timestamp) {
        time = timestamp;
        frameCount++;

        // FPS calculation
        if (timestamp - fpsTimer >= 1000) {
            fps = frameCount;
            frameCount = 0;
            fpsTimer = timestamp;
            fpsDisplay.textContent = fps;
        }

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Subtle background radial gradient (follows cursor slightly)
        const bgGrad = ctx.createRadialGradient(
            cursor.x, cursor.y, 0,
            centerX, centerY, Math.max(width, height) * 0.8
        );
        bgGrad.addColorStop(0, 'rgba(20,18,30,0.15)');
        bgGrad.addColorStop(1, 'rgba(5,5,8,0)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Update and draw particles
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw(ctx);
        }

        // Draw ripples
        rippleWaves = rippleWaves.filter(w => w.update());
        for (const wave of rippleWaves) {
            wave.draw(ctx);
        }

        // Draw burst ring if active
        if (burstActive) {
            const elapsed = time - burstStartTime;
            if (elapsed < BURST_DURATION) {
                const progress = elapsed / BURST_DURATION;
                const ringRadius = progress * 500;
                const ringAlpha = 1 - progress;
                ctx.beginPath();
                ctx.arc(burstOrigin.x, burstOrigin.y, ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(180,160,250,${ringAlpha * 0.6})`;
                ctx.lineWidth = 2 - progress * 1.5;
                ctx.stroke();
            }
        }

        requestAnimationFrame(render);
    }

    // ──────────────────────────────────────────────
    // Initialize
    // ──────────────────────────────────────────────
    function init() {
        resize();
        createParticles();

        // Mouse events
        window.addEventListener('mousemove', onMouseMove, { passive: true });
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('mouseenter', onMouseEnter);
        window.addEventListener('mouseleave', onMouseLeave);

        // Touch events
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchstart', onTouchStart, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: false });

        // Keyboard
        window.addEventListener('keydown', onKeyDown);

        // Mode buttons
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => setMode(btn.dataset.mode));
        });

        // Fullscreen
        fullscreenBtn.addEventListener('click', toggleFullscreen);

        // Resize
        window.addEventListener('resize', () => {
            resize();
            // Re-home particles
            particles.forEach(p => {
                p.homeX = random(0, width);
                p.homeY = random(0, height);
            });
        });

        // Initial cursor position (center of screen)
        cursor.x = centerX;
        cursor.y = centerY;
        cursor.prevX = centerX;
        cursor.prevY = centerY;
        
        // Set initial custom cursor position
        cursorDot.style.left = centerX + 'px';
        cursorDot.style.top = centerY + 'px';
        cursorRing.style.left = centerX + 'px';
        cursorRing.style.top = centerY + 'px';
        
        // Show custom cursor
        showCustomCursor();

        // Start render loop
        requestAnimationFrame(render);
    }

    // ──────────────────────────────────────────────
    // Start when DOM is ready
    // ──────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();