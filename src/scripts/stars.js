(() => {
    const container = document.querySelector(".stars");

    if (!container || window.__moonStarsInitialized) {
        return;
    }

    window.__moonStarsInitialized = true;

    const STORAGE_KEY = "moon-stars-state-v1";
    const MAX_STARS = 150;
    const NORMAL_SPAWN_MS = 120;
    const SPECIAL_SPAWN_MS = 1000;
    const NORMAL_LIFE_MIN = 3000;
    const NORMAL_LIFE_MAX = 7000;
    const SPECIAL_LIFE_MIN = 8000;
    const SPECIAL_LIFE_MAX = 18000;
    const STAR_Y_START = -10;
    const STAR_Y_END = 110;

    const runtime = new Map();
    let stars = [];
    let nextId = 1;
    let normalAccumulator = 0;
    let specialAccumulator = 0;
    let lastFrameTime = performance.now();

    function randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    function loadState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);

            if (!raw) {
                return;
            }

            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed.stars)) {
                stars = parsed.stars;
            }

            if (Number.isFinite(parsed.nextId)) {
                nextId = parsed.nextId;
            }
        }
        catch (error) {
            console.error("Erro ao restaurar estrelas:", error);
        }
    }

    function persistState() {
        try {
            const snapshot = {
                nextId,
                stars: stars.map((star) => ({
                    id: star.id,
                    special: star.special,
                    left: star.left,
                    createdAt: star.createdAt,
                    duration: star.duration,
                    opacity: star.opacity,
                    fontSize: star.fontSize,
                    rotationSpeed: star.rotationSpeed,
                    rotationOffset: star.rotationOffset
                }))
            };

            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        }
        catch (error) {
            console.error("Erro ao salvar estrelas:", error);
        }
    }

    function createElement(star) {
        const element = document.createElement("div");

        element.classList.add("star");

        if (star.special) {
            element.classList.add("special");
            element.textContent = "★";
            element.style.fontSize = `${star.fontSize}px`;
        }

        element.style.left = `${star.left}vw`;
        element.style.opacity = `${star.opacity}`;

        container.appendChild(element);
        runtime.set(star.id, element);
    }

    function removeStar(id) {
        const element = runtime.get(id);

        if (element) {
            element.remove();
            runtime.delete(id);
        }

        stars = stars.filter((star) => star.id !== id);
    }

    function spawnStar(special = false) {
        if (stars.length >= MAX_STARS) {
            return;
        }

        const duration = special
            ? randomBetween(SPECIAL_LIFE_MIN, SPECIAL_LIFE_MAX)
            : randomBetween(NORMAL_LIFE_MIN, NORMAL_LIFE_MAX);

        const rotationSpeed = special
            ? randomBetween(120, 240)
            : 0;

        const star = {
            id: nextId++,
            special,
            left: randomBetween(0, 100),
            createdAt: Date.now(),
            duration,
            opacity: Math.random() * 0.75 + 0.25,
            fontSize: special ? randomBetween(10, 30) : 0,
            rotationSpeed,
            rotationOffset: special ? randomBetween(0, 360) : 0
        };

        stars.push(star);
        createElement(star);
    }

    function restoreStars() {
        const now = Date.now();

        stars = stars.filter((star) => {
            const age = now - star.createdAt;

            if (age >= star.duration) {
                return false;
            }

            createElement(star);
            return true;
        });

        persistState();
    }

    function renderStar(star, now) {
        const element = runtime.get(star.id);

        if (!element) {
            return;
        }

        const age = now - star.createdAt;
        const progress = Math.min(age / star.duration, 1);
        const y = STAR_Y_START + (STAR_Y_END - STAR_Y_START) * progress;
        const opacity = star.opacity * (1 - progress);

        let transform = `translateY(${y}vh)`;

        if (star.special) {
            const rotation = star.rotationOffset + (star.rotationSpeed * age) / 1000;
            transform += ` rotate(${rotation}deg)`;
        }

        element.style.transform = transform;
        element.style.opacity = `${opacity}`;
    }

    function tick(now) {
        const delta = Math.min(now - lastFrameTime, 50);
        lastFrameTime = now;

        normalAccumulator += delta;
        specialAccumulator += delta;

        while (normalAccumulator >= NORMAL_SPAWN_MS) {
            normalAccumulator -= NORMAL_SPAWN_MS;
            spawnStar(false);
        }

        while (specialAccumulator >= SPECIAL_SPAWN_MS) {
            specialAccumulator -= SPECIAL_SPAWN_MS;
            spawnStar(true);
        }

        const currentTime = Date.now();

        for (const star of [...stars]) {
            const age = currentTime - star.createdAt;

            if (age >= star.duration) {
                removeStar(star.id);
                continue;
            }

            renderStar(star, currentTime);
        }

        requestAnimationFrame(tick);
    }

    loadState();
    restoreStars();

    if (!stars.length) {
        spawnStar(false);
        spawnStar(true);
    }

    window.addEventListener("pagehide", persistState);
    window.addEventListener("beforeunload", persistState);

    requestAnimationFrame(tick);
})();