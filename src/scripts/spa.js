// History API SPA router. Static pages remain available as fallbacks.
(function () {
    const routes = {
        sistema: { page: "src/pages/system.html", title: "Sistema | Moon" },
        racas: { page: "src/pages/races.html", title: "Raças | Moon" },
        classes: { page: "src/pages/classes.html", title: "Classes | Moon" },
        perks: { page: "src/pages/perks.html", title: "Perks | Moon" },
        efeitos: { page: "src/pages/effects.html", title: "Efeitos | Moon" },
        recursos: { page: "src/pages/resources.html", title: "Recursos | Moon" },
        personagens: { page: "src/pages/chars.html", title: "Personagens | Moon" },
        introducao: { page: "src/pages/intro.html", title: "Introdução | Moon" }
    };
    const aliases = { system: "sistema", races: "racas", chars: "personagens", characters: "personagens", effects: "efeitos", intro: "introducao", resources: "recursos" };
    let ready = false;
    let renderToken = 0;

    function appBasePath() {
        const path = window.location.pathname;
        const indexPosition = path.toLowerCase().indexOf("/index.html");

        if (indexPosition !== -1) return path.slice(0, indexPosition + 1);

        const routePattern = new RegExp(`/(?:${Object.keys(routes).join("|")}|${Object.keys(aliases).join("|")})/?$`, "i");
        return path.replace(routePattern, "/");
    }

    function appBaseUrl() {
        return new URL(appBasePath(), window.location.origin);
    }

    window.__moonAppBaseUrl = appBaseUrl().href;

    function currentRoute() {
        // Query routes work on any static web server, including Live Server,
        // which cannot serve a virtual /index.html/Personagens path on reload.
        const queryRoute = new URLSearchParams(window.location.search).get("pagina");
        if (queryRoute) {
            const name = queryRoute.toLowerCase();
            return aliases[name] || name;
        }

        // Accept previously shared path-based routes when the host supports
        // an SPA fallback (for example, GitHub Pages via 404.html).
        const path = window.location.pathname.slice(appBasePath().length).replace(/^index\.html\/?/i, "");
        const name = decodeURIComponent(path).split("/").filter(Boolean)[0]?.toLowerCase() || "";
        return aliases[name] || name;
    }

    function routeUrl(route) {
        const base = appBasePath();
        const page = route ? route.charAt(0).toUpperCase() + route.slice(1) : "";
        return `${base}index.html${page ? `?pagina=${encodeURIComponent(page)}` : ""}`;
    }
    const root = () => document.getElementById("spa-root");
    const home = () => document.querySelector(".menu");

    function pageStyles(enabled) {
        let link = document.getElementById("spa-page-styles");
        if (!link && enabled) {
            link = document.createElement("link");
            link.id = "spa-page-styles";
            link.rel = "stylesheet";
            // A relative href would be resolved below /index.html/Personagens
            // after navigation. Resolve it from the app root instead.
            link.href = new URL("src/styles/pages.css", appBaseUrl()).href;
            document.head.appendChild(link);
        }
        if (!link) return Promise.resolve();

        link.disabled = !enabled;

        // Do not mount a route until its layout stylesheet is ready. Without
        // this, the generic .page_container briefly renders with the home CSS
        // and then snaps to the page dimensions once pages.css arrives.
        if (!enabled || link.sheet) return Promise.resolve();

        return new Promise(resolve => {
            link.addEventListener("load", resolve, { once: true });
            link.addEventListener("error", resolve, { once: true });
        });
    }

    function absolutize(value, pageUrl) {
        if (!value || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(value)) return value;
        try {
            const url = new URL(value, pageUrl);
            return `${url.pathname}${url.search}${url.hash}`;
        } catch (error) {
            return value;
        }
    }

    function normalizePaths(container, pageUrl) {
        container.querySelectorAll("[src], [href], [data-md], [data-target], [mkd-content]").forEach((element) => {
            ["src", "href", "data-md", "data-target", "mkd-content"].forEach((attribute) => {
                if (element.hasAttribute(attribute)) element.setAttribute(attribute, absolutize(element.getAttribute(attribute), pageUrl));
            });
        });
    }

    async function initialise(container) {
        window.initDirectMarkdown?.();
        await window.initCharsNavigation?.();
        await window.initMarkdownButtons?.();
        window.initSystemCombatSubsections?.();
        window.initCharacterShowcaseSwap?.();
        window.initSectionTabs?.();
        window.initSkillSubmenu?.();
        window.initCharacterSkillVariantBadge?.();
        window.syncCharacterSkillVariantBadge?.().catch(() => {});
        window.resolveEffectImages?.(container).catch(() => {});
    }

    async function renderHome() {
        const token = ++renderToken;
        window.hideMoonTooltip?.();

        // Mirror the home-to-page transition when using "Voltar": keep the
        // current route visible long enough for its exit animation to finish
        // before the home menu is revealed.
        if (!root().hidden) {
            root().classList.remove("is-route-entering");
            root().classList.add("is-route-leaving");

            const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            if (!prefersReducedMotion) {
                await new Promise(resolve => setTimeout(resolve, 160));
            }

            if (token !== renderToken) return;
        }

        pageStyles(false);
        document.body.className = "home-page";
        document.title = "Moon Office";
        root().classList.remove("is-route-leaving");
        root().hidden = true;
        root().innerHTML = "";
        const homeMenu = home();
        homeMenu.hidden = false;
        window.playMoonTransition?.(homeMenu, "is-route-entering");
    }

    async function render() {
        if (!ready) return;
        // A tooltip is mounted directly on body, not in spa-root. It must not
        // survive when the route that created its target is being replaced.
        window.hideMoonTooltip?.();
        const route = routes[currentRoute()];
        if (!route) return renderHome();

        const container = root();
        const token = ++renderToken;

        if (!home().hidden) {
            home().classList.add("is-route-leaving");
            await new Promise(resolve => setTimeout(resolve, 140));
            if (token !== renderToken) return;
            home().classList.remove("is-route-leaving");
        }
        home().hidden = true;

        // Page styles change the body's alignment and padding. Load them only
        // after the home menu has left the layout to prevent it shifting mid-transition.
        await pageStyles(true);
        if (token !== renderToken) return;

        // Mount and initialize the route off-screen. This prevents a complete
        // panel from being painted for one frame before its entry begins.
        container.classList.remove("is-route-entering", "is-route-leaving");
        container.classList.add("is-route-preparing");
        container.hidden = false;
        container.setAttribute("aria-busy", "true");

        try {
            const pageUrl = new URL(route.page, appBaseUrl());
            const response = await fetch(pageUrl, { cache: "no-cache" });
            if (!response.ok) throw new Error(`Não foi possível carregar ${route.page}`);
            const documentPage = new DOMParser().parseFromString(await response.text(), "text/html");
            if (token !== renderToken) return;

            const content = Array.from(documentPage.body.children).filter((element) => !element.matches("script, .stars"));
            container.replaceChildren(...content);
            normalizePaths(container, pageUrl);
            document.body.className = documentPage.body.className;
            document.title = route.title;
            await initialise(container);
            window.playMoonTransition?.(container, "is-route-entering");
            container.classList.remove("is-route-preparing");
            if (route === routes.personagens) {
                const shell = container.querySelector(".chars-shell");
                const resetScroll = () => {
                    if (token === renderToken) {
                        window.scrollCharactersPageToTop?.();
                    }
                };
                const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

                if (!shell || prefersReducedMotion) {
                    resetScroll();
                } else {
                    const handlePanelAnimationEnd = (event) => {
                        if (event.target !== shell || event.animationName !== "moon-panel-enter") return;
                        shell.removeEventListener("animationend", handlePanelAnimationEnd);
                        resetScroll();
                    };
                    shell.addEventListener("animationend", handlePanelAnimationEnd);
                }
            }
        } catch (error) {
            container.classList.remove("is-route-preparing");
            container.innerHTML = `<section class="spa-error"><h1>Não foi possível abrir esta página</h1><p>${error.message}</p></section>`;
        } finally {
            if (token === renderToken) container.removeAttribute("aria-busy");
        }
    }

    function targetRoute(target) {
        const raw = String(target || "").replace(/\\/g, "/");
        try {
            const targetUrl = new URL(raw, appBaseUrl());
            const queryRoute = targetUrl.searchParams.get("pagina")?.toLowerCase();
            if (queryRoute && (routes[queryRoute] || aliases[queryRoute])) {
                return aliases[queryRoute] || queryRoute;
            }
            const canonicalMatch = targetUrl.pathname.match(/\/index\.html\/([^/?#]+)\/?$/i);
            if (canonicalMatch) {
                const route = canonicalMatch[1].toLowerCase();
                if (routes[route] || aliases[route]) return aliases[route] || route;
            }
        } catch (error) {
            // Let the existing static-page matching handle malformed URLs.
        }
        const match = raw.match(/(?:^|\/)(system|races|classes|perks|effects|resources|chars|intro)\.html(?:[?#].*)?$/i);
        if (match) return aliases[match[1].toLowerCase()] || match[1].toLowerCase();
        return /(?:^|\/)index\.html(?:[?#].*)?$/i.test(raw) || raw === "/" ? "" : null;
    }

    window.__moonSpaNavigate = (target) => {
        const route = targetRoute(target);
        if (route === null) return false;
        const nextUrl = routeUrl(route);
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl === nextUrl) render();
        else {
            window.history.pushState({ route }, "", nextUrl);
            render();
        }
        return true;
    };

    document.addEventListener("click", (event) => {
        const link = event.target.closest("a[href]");
        if (!link || link.target || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (window.__moonSpaNavigate(link.getAttribute("href"))) event.preventDefault();
    });

    window.addEventListener("popstate", render);
    window.addEventListener("moon:app-ready", () => {
        // GitHub Pages serves unknown SPA routes through 404.html. That page
        // sends the original path in this temporary query parameter so a hard
        // refresh of /index.html/Personagens can recover the same route.
        const recoveryPath = new URLSearchParams(window.location.search).get("spa-path");
        if (recoveryPath) {
            try {
                const recoveryUrl = new URL(recoveryPath, window.location.origin);
                if (recoveryUrl.origin === window.location.origin && recoveryUrl.pathname.startsWith(appBasePath())) {
                    window.history.replaceState({}, "", `${recoveryUrl.pathname}${recoveryUrl.search}${recoveryUrl.hash}`);
                }
            } catch (error) {
                // Ignore an invalid recovery value and render the home page.
            }
        }

        // Upgrade old shared #/route links to the canonical URL.
        const legacyRoute = window.location.hash.replace(/^#\/?/, "").split("/")[0].toLowerCase();
        if (legacyRoute && (routes[legacyRoute] || aliases[legacyRoute])) {
            const route = aliases[legacyRoute] || legacyRoute;
            window.history.replaceState({ route }, "", routeUrl(route));
        }
        ready = true;
        render();
    }, { once: true });
}());
