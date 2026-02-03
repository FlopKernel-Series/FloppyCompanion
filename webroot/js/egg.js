// egg.js - easter egg

(function () {
    const TAP_WINDOW_MS = 700;
    const REQUIRED_TAPS = 3;

    const MUSIC_GAIN = 0.8;
    const MUSIC_START_DELAY_MS = 500;

    const REMOTE_MOD_URL = 'https://api.modarchive.org/downloads.php?moduleid=60205#stop4am.mod';

    let tapCount = 0;
    let tapTimer = null;

    let modalEl = null;
    let canvasEl = null;
    let ctx = null;

    let aboutLogoEl = null;

    let rafId = null;
    let stars = [];
    let lastFrameTs = 0;
    const TARGET_FPS = 30;
    const TARGET_FRAME_MS = 1000 / TARGET_FPS;

    let audioPlayer = null;
    let micromod = null;
    let currentModule = null;

    let musicStartTimer = null;

    let closeTimer = null;

    let preloadPromise = null;
    let preloadedModBuffer = null;
    let pendingOpen = false;
    let preloadDone = false;

    function $(id) {
        return document.getElementById(id);
    }

    function ensureModalRefs() {
        if (!modalEl) modalEl = $('easter-egg-modal');
        if (!canvasEl) canvasEl = $('easter-egg-canvas');
        if (canvasEl && !ctx) ctx = canvasEl.getContext('2d');
    }

    function setPreloadingHint(isPreloading) {
        if (!aboutLogoEl) return;
        aboutLogoEl.classList.toggle('easter-egg-preloading', !!isPreloading);
    }

    function setTapGlow(level) {
        if (!aboutLogoEl) return;
        const cl = aboutLogoEl.classList;
        cl.remove('ee-glow-1', 'ee-glow-2', 'ee-glow-3');
        if (level === 1) cl.add('ee-glow-1');
        else if (level === 2) cl.add('ee-glow-2');
        else if (level >= 3) cl.add('ee-glow-3');
    }

    function resizeCanvas() {
        if (!canvasEl) return;
        const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
        // Use layout dimensions instead of getBoundingClientRect() so transforms
        // (pop-in scale/translate) don't shrink the canvas and offset rendering.
        const w = Math.max(1, Math.floor(canvasEl.clientWidth));
        const h = Math.max(1, Math.floor(canvasEl.clientHeight));
        canvasEl.width = w * dpr;
        canvasEl.height = h * dpr;
        canvasEl.style.width = w + 'px';
        canvasEl.style.height = h + 'px';
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initStars() {
        if (!canvasEl) return;
        const w = Math.max(1, Math.floor(canvasEl.clientWidth));
        const h = Math.max(1, Math.floor(canvasEl.clientHeight));
        // Keep the effect light; too many stars increases main-thread load and can
        // cause audio stutters on slower devices.
        const count = Math.min(240, Math.max(90, Math.floor((w * h) / 4200)));

        stars = new Array(count).fill(0).map(() => ({
            x: (Math.random() - 0.5) * w,
            y: (Math.random() - 0.5) * h,
            z: Math.random() * 1 + 0.001
        }));
    }

    function stepStar(star, speed, w, h) {
        star.z -= speed;
        if (star.z <= 0.001) {
            star.x = (Math.random() - 0.5) * w;
            star.y = (Math.random() - 0.5) * h;
            star.z = 1;
        }
    }

    function renderStars(dtMs) {
        if (!ctx || !canvasEl) return;

        const w = Math.max(1, Math.floor(canvasEl.clientWidth));
        const h = Math.max(1, Math.floor(canvasEl.clientHeight));

        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;

        const speedScale = Math.max(0.25, Math.min(2, (dtMs || TARGET_FRAME_MS) / 16.67));
        const speed = 0.0013 * speedScale;

        ctx.fillStyle = 'rgba(255,255,255,0.9)';

        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            stepStar(s, speed, w, h);

            const px = cx + (s.x / s.z);
            const py = cy + (s.y / s.z);

            if (px < 0 || px > w || py < 0 || py > h) {
                s.z = 0;
                continue;
            }

            const intensity = Math.max(0, Math.min(1, 1 - s.z));
            const size = 1 + intensity * 2.2;
            const alpha = 0.15 + intensity * 0.85;

            ctx.globalAlpha = alpha;
            ctx.fillRect(px | 0, py | 0, size, size);
        }

        ctx.globalAlpha = 1;
    }

    function tick(ts) {
        if (!lastFrameTs) lastFrameTs = ts;
        const dt = ts - lastFrameTs;

        if (dt >= TARGET_FRAME_MS) {
            lastFrameTs = ts;
            renderStars(dt);
        }

        rafId = requestAnimationFrame(tick);
    }

    function cancelMusicTimers() {
        if (musicStartTimer) {
            clearTimeout(musicStartTimer);
            musicStartTimer = null;
        }
    }

    function stopAnim() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        lastFrameTs = 0;
    }

    function ensureAudioPlayer() {
        if (audioPlayer) return audioPlayer;

        if (typeof window.AudioPlayer !== 'function' || typeof window.Micromod !== 'function' || typeof window.Module !== 'function') {
            return null;
        }

        audioPlayer = new window.AudioPlayer();

        return audioPlayer;
    }


    async function fetchArrayBuffer(url) {
        // Allow normal HTTP caching so subsequent opens can be instant.
        const res = await fetch(url, { cache: 'default' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.arrayBuffer();
    }

    async function preloadAssets() {
        const p = ensureAudioPlayer();
        if (p) {
            try {
                // Ensure WebAudio is unlocked on the user gesture path.
                // AudioPlayer.play() will resume as well; this just primes it.
                const ac = typeof p.getAudioContext === 'function' ? p.getAudioContext() : null;
                if (ac && typeof ac.resume === 'function') await ac.resume();
            } catch {
                // ignore
            }
        }

        try {
            preloadedModBuffer = await fetchArrayBuffer(REMOTE_MOD_URL);
        } catch {
            // ignore
        }

        preloadDone = true;
    }

    function ensurePreloadStarted() {
        if (!preloadPromise) {
            setPreloadingHint(true);
            preloadPromise = preloadAssets().finally(() => {
                setPreloadingHint(false);
                if (pendingOpen) {
                    pendingOpen = false;
                    openModal();
                }
            });
        }
        return preloadPromise;
    }

    async function startMusic() {
        const p = ensureAudioPlayer();
        if (!p) return;

        try {
            p.stop();
        } catch {
            // ignore
        }

        let buffer = preloadedModBuffer;
        if (!(buffer instanceof ArrayBuffer)) {
            try {
                buffer = await fetchArrayBuffer(REMOTE_MOD_URL);
            } catch {
                buffer = null;
            }
        }
        if (!(buffer instanceof ArrayBuffer)) return;

        try {
            currentModule = new window.Module(new Int8Array(buffer));
            currentModule.stereoSeparation = 0.5;
            // Approx. volume control without needing to intercept the audio node.
            if (typeof currentModule.gain === 'number' && isFinite(currentModule.gain)) {
                currentModule.gain = Math.max(0, Math.round(currentModule.gain * MUSIC_GAIN));
            }
            micromod = new window.Micromod(currentModule, p.getSamplingRate());
            micromod.setInterpolation(true);
            // Important: don't manually loop by duration; it will ignore pattern loop/jump logic
            // and can cut mid-tick causing audible clicks. Let Micromod's sequencer handle it.
            p.setAudioSource(micromod);
            p.play();
        } catch {
            // ignore
        }
    }

    function stopMusic() {
        cancelMusicTimers();
        try {
            if (audioPlayer) audioPlayer.stop();
        } catch {
            // ignore
        }
    }

    function openModal() {
        ensureModalRefs();
        if (!modalEl) return;

        setTapGlow(0);

        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }

        modalEl.classList.remove('hidden');
        modalEl.classList.remove('is-closing');
        modalEl.setAttribute('aria-hidden', 'false');

        // Force a reflow so transitions reliably trigger.
        void modalEl.offsetWidth;
        modalEl.classList.add('is-open');

        // Start the visuals on the next frame so the opening transition stays smooth.
        stopAnim();
        requestAnimationFrame(() => {
            resizeCanvas();
            initStars();
            rafId = requestAnimationFrame(tick);
        });

        // Delay music slightly so the user can see the animation.
        cancelMusicTimers();
        musicStartTimer = setTimeout(() => {
            startMusic();
        }, MUSIC_START_DELAY_MS);
    }

    function closeModal() {
        ensureModalRefs();
        if (!modalEl) return;

        if (modalEl.classList.contains('hidden')) return;

        stopAnim();
        stopMusic();

        modalEl.classList.remove('is-open');
        modalEl.classList.add('is-closing');
        modalEl.setAttribute('aria-hidden', 'true');

        setTapGlow(0);

        const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

        const finish = () => {
            if (!modalEl) return;
            modalEl.classList.add('hidden');
            modalEl.classList.remove('is-closing');
        };

        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }

        if (reduceMotion) {
            finish();
            return;
        }

        const contentEl = modalEl.querySelector('.easter-egg-content');
        let finished = false;

        const onEnd = (e) => {
            if (finished) return;
            if (contentEl && e && e.target !== contentEl) return;
            finished = true;
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }
            finish();
        };

        if (contentEl) {
            contentEl.addEventListener('transitionend', onEnd, { once: true });
        } else {
            modalEl.addEventListener('transitionend', onEnd, { once: true });
        }

        closeTimer = setTimeout(() => {
            if (finished) return;
            finished = true;
            finish();
        }, 700);
    }

    function onLogoTap() {
        ensurePreloadStarted();

        tapCount++;
        setTapGlow(Math.min(REQUIRED_TAPS, tapCount));
        if (tapTimer) clearTimeout(tapTimer);

        tapTimer = setTimeout(() => {
            tapCount = 0;
            tapTimer = null;
            setTapGlow(0);
        }, TAP_WINDOW_MS);

        if (tapCount >= REQUIRED_TAPS) {
            tapCount = 0;
            if (tapTimer) clearTimeout(tapTimer);
            tapTimer = null;

            if (!preloadDone) {
                pendingOpen = true;
                return;
            }

            openModal();
        }
    }

    function init() {
        ensureModalRefs();

        aboutLogoEl = document.querySelector('#tab-about .logo-container');
        if (aboutLogoEl) {
            const baseSvg = aboutLogoEl.querySelector('svg.app-logo-svg');
            if (baseSvg) {
                // Repair any previously-injected glow SVGs that accidentally kept app-logo-svg.
                aboutLogoEl.querySelectorAll('svg.ee-logo-glow-svg.app-logo-svg').forEach((el) => {
                    el.classList.remove('app-logo-svg');
                });

                if (!aboutLogoEl.querySelector('svg.ee-logo-glow-svg')) {
                    const glowSvg = baseSvg.cloneNode(true);
                    // Make it a pure overlay layer (not laid out as a second logo).
                    glowSvg.classList.remove('app-logo-svg');
                    glowSvg.classList.add('ee-logo-glow-svg');
                    glowSvg.setAttribute('aria-hidden', 'true');
                    glowSvg.setAttribute('focusable', 'false');
                    aboutLogoEl.insertBefore(glowSvg, baseSvg);
                }
            }

            aboutLogoEl.style.webkitTapHighlightColor = 'transparent';
            // Start caching as early as possible on the first touch.
            aboutLogoEl.addEventListener('pointerdown', ensurePreloadStarted, { passive: true, once: true });
            aboutLogoEl.addEventListener('click', onLogoTap);
        }

        const closeBtn = $('easter-egg-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
            closeBtn.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                closeModal();
            });
        }

        // Intentionally do not close on backdrop click.

        window.addEventListener('resize', () => {
            if (!modalEl || modalEl.classList.contains('hidden')) return;
            resizeCanvas();
            initStars();
        });

        // Intentionally do not close on Escape.
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
