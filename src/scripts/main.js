// =========================
// NAV
// =========================

function nav(_page) {
    if (typeof window.__moonSpaNavigate === "function" && window.__moonSpaNavigate(_page)) {
        return;
    }

    const targetUrl = new URL(_page, window.location.href);
    const currentUrl = new URL(window.location.href);

    if (
        targetUrl.pathname === currentUrl.pathname &&
        targetUrl.search === currentUrl.search &&
        targetUrl.hash === currentUrl.hash
    ) {
        window.location.reload();
        return;
    }

    window.location.href = targetUrl.href;
}

function scrollCharactersPageToTop() {
    const shell = document.querySelector(".chars-page .chars-shell");
    if (!shell) return;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    shell.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
    });
}

window.addEventListener("pageshow", () => {
    if (document.body.classList.contains("chars-page")) {
        scrollCharactersPageToTop();
    }
});

function showCharacterBrowser() {
    const pageContainer = document.querySelector(".chars-page .page_container");
    if (!pageContainer) return;

    scrollCharactersPageToTop();
    window.hideMoonTooltip?.();
    pageContainer.dataset.characterImageToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pageContainer.dataset.skillBadgeToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    pageContainer.dataset.skillPath = "";
    pageContainer.dataset.characterName = "";
    pageContainer.dataset.skillVariants = "[]";
    pageContainer.dataset.skillVariantIndex = "0";
    pageContainer.classList.remove("skills-mode", "is-character-loading");

    clearDynamicCharacterContent();
    resetCharacterSectionAvailability();

    document.querySelectorAll(".chars-page .nav-right button.active").forEach(button => {
        button.classList.remove("active");
    });
    document.querySelectorAll(".chars-page .nav-group.active-group").forEach(group => {
        group.classList.remove("active-group");
    });

    const header = document.querySelector(".chars-page .chars-header");
    const image = document.querySelector(".chars-page .chars-showcase-image");
    const swapButton = document.querySelector(".chars-page .chars-showcase-swap");
    const badgeWrap = document.querySelector(".chars-page .chars-section-badge-wrap");
    const landing = document.querySelector(".chars-page .chars-landing");

    header?.classList.remove("has-showcase");
    if (image) {
        image.hidden = true;
        image.removeAttribute("src");
        image.alt = "";
    }
    if (swapButton) {
        swapButton.hidden = true;
        swapButton.disabled = true;
    }
    if (badgeWrap) badgeWrap.innerHTML = "";

    setCharacterHeaderName("");
    updateCharacterImageToggle(false);
    if (landing) landing.style.display = "";
}

// Restart a CSS animation after dynamic content or a route is replaced.
// Keeping this in one place also respects the user's OS motion preference.
function playMoonTransition(element, className = "is-content-entering") {
    if (!element || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
}

window.playMoonTransition = playMoonTransition;

// Some browsers assign the document scrollbar to <body> rather than <html>.
// Track its gutter so the visual hover state is reliable in either case.
function syncDocumentScrollbarHover(event) {
    const root = document.documentElement;
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    const isOverScrollbar = scrollbarWidth > 0 && event.clientX >= root.clientWidth;

    root.classList.toggle("is-document-scrollbar-hovered", isOverScrollbar);
}

window.addEventListener("pointermove", syncDocumentScrollbarHover, { passive: true });
window.addEventListener("pointerleave", () => {
    document.documentElement.classList.remove("is-document-scrollbar-hovered");
});
window.addEventListener("blur", () => {
    document.documentElement.classList.remove("is-document-scrollbar-hovered");
});

// openKitImagePage removed: image-generation flow disabled per user request


// =========================
// MARKDOWN + TOOLTIP PARSER
// =========================

function parseCustomTooltips(text) {

    const buildTooltipMarkup = (content, key, url = null) => {

        const attributes = url
            ? `href="${url}" target="_blank" rel="noopener noreferrer" data_tooltip="${key}"`
            : `data_tooltip="${key}"`;

        const tag = url ? "a" : "span";

        return `<${tag} class="tooltip-inline" ${attributes}>${content}</${tag}>`;
    };

    // <color="#hex">texto</color>

    text = text.replace(
        /<color\s*=\s*['\"](#[0-9a-fA-F]{3,8})['\"]\s*>([\s\S]*?)<\/color>/g,
        (match, color, content) => {
            return `<span style="color:${color};">${content}</span>`;
        }
    );

    // c(#fff){texto} — inline color shorthand used in .skill files
    text = text.replace(
        /c\((#[0-9a-fA-F]{3,8})\)\{([\s\S]*?)\}/g,
        (match, color, content) => {
            return `<span style="color:${color};">${content}</span>`;
        }
    );

    // [texto](url){key}
    text = text.replace(
        /\[([^\]]+)\]\(([^)]+)\)\{([^}]+)\}/g,
        (match, content, url, key) => {
            return buildTooltipMarkup(content, key, url);
        }
    );

    // [texto]{key}
    text = text.replace(
        /\[((?:[^\[\]]|\[[^\[\]]*\])*)\]\{([^}]+)\}/g,
        (match, content, key) => {
            return buildTooltipMarkup(content, key);
        }
    );

    return text;
}

function formatSkillInlineStyles(text) {

    let formatted = String(text || "");

    // c(#fff){Texto}
    formatted = formatted.replace(
        /c\((#[0-9a-fA-F]{3,8})\)\{([\s\S]+?)\}/g,
        '<span style="color:$1;">$2</span>'
    );

    // **Texto**
    formatted = formatted.replace(
        /\*\*([^*\n][\s\S]*?)\*\*/g,
        '<b>$1</b>'
    );

    // ~Texto~
    formatted = formatted.replace(
        /(^|[^\w])~([^~\n]+)~(?=[^\w]|$)/g,
        '$1<i>$2</i>'
    );

    // _Texto_
    formatted = formatted.replace(
        /(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g,
        '$1<u>$2</u>'
    );

    return formatted;
}

function normalizeEffectAssetName(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/_+/g, "_");
}

function getEffectAssetNames(value) {
    const effectName = normalizeEffectAssetName(value);
    const alternateName = effectName.includes("_")
        ? effectName.replace(/_/g, " ")
        : effectName.replace(/\s+/g, "_");

    return [...new Set([effectName, alternateName])];
}

function normalizeEffectAssetLookup(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\.png$/i, "")
        .replace(/[\s_]+/g, "_");
}

function buildEffectAssetPath(folder, imageName) {
    const encodedFolder = String(folder || "")
        .split("/")
        .map(encodeURIComponent)
        .join("/");
    const encodedImageName = encodeURIComponent(imageName);
    const assetPath = encodedFolder.length
        ? `../../res/effects/${encodedFolder}/${encodedImageName}.png`
        : `../../res/effects/${encodedImageName}.png`;

    return new URL(assetPath, SCRIPT_BASE_URL).href;
}

async function resolveEffectImages(root = document) {
    const images = Array.from(root.querySelectorAll("img[data-effect-asset-name]"));

    if (!images.length) {
        return;
    }

    let assetIndex;

    try {
        const response = await fetch(resolveScriptAssetPath("../../res/effects/index.json"), { cache: "no-cache" });
        assetIndex = response.ok ? await response.json() : [];
    }
    catch (error) {
        assetIndex = [];
    }

    const assetByKey = new Map(
        (Array.isArray(assetIndex) ? assetIndex : [])
            .map(assetPath => [
                normalizeEffectAssetLookup(String(assetPath).split("/").pop()),
                String(assetPath).replace(/\\/g, "/")
            ])
    );

    await Promise.all(images.map(async image => {
        if (image.dataset.effectAssetResolved === "true") {
            return;
        }

        image.dataset.effectAssetResolved = "true";

        const effectName = decodeURIComponent(image.dataset.effectAssetName || "");
        const effectFolder = decodeURIComponent(image.dataset.effectAssetFolder || "");

        const assetPath = assetByKey.get(normalizeEffectAssetLookup(effectName));

        if (assetPath) {
            const slashIndex = assetPath.lastIndexOf("/");
            const assetFolder = slashIndex >= 0
                ? assetPath.slice(0, slashIndex)
                : effectFolder;
            const assetName = slashIndex >= 0
                ? assetPath.slice(slashIndex + 1).replace(/\.png$/i, "")
                : assetPath.replace(/\.png$/i, "");

            image.src = buildEffectAssetPath(assetFolder, assetName);
            return;
        }

        image.remove();
    }));
}

function formatEffectReferences(text, folder = "") {

    return String(text || "").replace(
        /@\(((?:[^()]|\([^()]*\))*)\)|@\{([^}]+)\}(?:\(([^)]+)\))?|@([A-Za-z0-9_&()[\]\-]+)(?:\(([^)]+)\))?/g,
        (
            match,
            wrappedEffect,
            complexEffect,
            complexFolder,
            simpleEffect,
            simpleFolder,
            offset,
            fullString
        ) => {
            // @(...) accepts an entire effect name, including spaces, Unicode
            // characters and parentheses. Keep @{...} and @Effect(folder)
            // as backwards-compatible syntaxes.
            const effect = (wrappedEffect || complexEffect || simpleEffect || "")
                .trim()
                // Overview text is HTML-escaped before effect references are
                // formatted. Decode entities here so names such as
                // "The Living & The Departed" retain their actual lookup key.
                .replace(/&amp;/gi, "&");
            const effectFolder = String(complexFolder || simpleFolder || folder || "").trim();

            if (!effect.length) {
                return match;
            }

            const iconlessEffects = new Set(["unwanted synergy"]);
            const normalizedEffectName = effect.toLowerCase();
            const effectAssetAttributes = `data-effect-asset-name="${encodeURIComponent(effect)}" data-effect-asset-folder="${encodeURIComponent(effectFolder)}"`;
            const effectIcon = iconlessEffects.has(normalizedEffectName)
                ? ""
                : `<img class="effect-icon" ${effectAssetAttributes}>`;

            let tooltipKey = normalizeLookupKey(effect);

            if (effectFolder.length) {
                tooltipKey = `${normalizeLookupKey(effectFolder)}_${tooltipKey}`;
            }

            // Detect if the match is already inside a color span (e.g., c(#fff){...})
            let effectColor = getEffectTextColor(tooltipKey);

            try {
                const prevOpenSpan = fullString.lastIndexOf('<span', offset);
                const prevCloseSpan = fullString.lastIndexOf('</span>', offset);

                if (prevOpenSpan > prevCloseSpan) {
                    const tagEnd = fullString.indexOf('>', prevOpenSpan);
                    if (tagEnd > prevOpenSpan) {
                        const tagContent = fullString.slice(prevOpenSpan, tagEnd + 1);
                        if (/style\s*=\s*["'][^"']*color\s*:\s*#[0-9a-fA-F]{3,8}/.test(tagContent)) {
                            effectColor = 'inherit';
                        }
                    }
                }
            } catch (e) {
                // ignore parsing errors and fall back to default color
            }

            const displayEffect = effect.replace(/_/g, " ");

            return `[${effectIcon}<span style="color:${effectColor}; text-decoration: underline; text-decoration-color: ${effectColor}; text-decoration-thickness: from-font; text-underline-offset: 0.08em; text-decoration-skip-ink: auto;">${displayEffect}</span>]{${tooltipKey}}`;
        }
    );
}

function renderEffectsMarkdown(text) {

    const source = String(text || "");
    const lines = source.split(/\r?\n/);
    const output = [];

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];
        const columnMatch = line.match(/^\s*<div class="effects_column"(?:\s+title="([^"]*)")?>\s*$/i);

        if (!columnMatch) {
            output.push(line);
            continue;
        }

        const columnTitle = columnMatch[1].trim();
        const effects = [];

        i++;

        while (i < lines.length && !/^\s*<\/div>\s*$/i.test(lines[i])) {
            const effectLine = lines[i].trim();

            if (effectLine.startsWith("@")) {
                if (effectLine.length > 1) {
                    effects.push(effectLine);
                }
            }

            i++;
        }

        const rows = effects.length
            ? effects.map(effectReference => `<li class="effects_item">${effectReference}</li>`).join("")
            : `<li class="effects_empty">Nenhum efeito encontrado</li>`;

        output.push(
            `<div class="effects_column">` +
            `<div class="effects_card">` +
            `<div class="effects_header">${escapeHtml(columnTitle)}</div>` +
            `<ul class="effects_list">${rows}</ul>` +
            `</div>` +
            `</div>`
        );
    }

    return output.join("\n");
}

// =========================
// LOAD MARKDOWN
// =========================

function resolveAppRootImagePaths(markup) {
    const template = document.createElement("template");
    template.innerHTML = String(markup || "");

    template.content.querySelectorAll("img[src]").forEach(image => {
        const source = image.getAttribute("src") || "";
        if (!/^\.\.\/\.\.\/(?:res|bd)\//i.test(source)) return;
        image.setAttribute("src", resolveScriptAssetPath(source));
    });

    return template.innerHTML;
}

const markdownRenderVersions = new WeakMap();

function loadMarkdown(path, element) {

    const renderVersion = (markdownRenderVersions.get(element) || 0) + 1;
    markdownRenderVersions.set(element, renderVersion);

    return fetch(path, { cache: "no-cache" })
        .then(response => response.text())
        .then(text => {

            if (markdownRenderVersions.get(element) !== renderVersion) {
                return;
            }

            // Apply custom parsing used by .skill files so Markdown files
            // support the same effect and inline formatting syntaxes.

            // Expand shorthand color tokens (!b{}, !g{}) before any further processing
            let preprocessed = String(text || "");
            preprocessed = preprocessed.replace(/!b\{([\s\S]*?)\}/g, (m, c) => `c(#ff0000){${c}}`);
            preprocessed = preprocessed.replace(/!g\{([\s\S]*?)\}/g, (m, c) => `c(#2E2EFF){${c}}`);

            if (
                /(^|[\\/])effects\.md$/i.test((path || "").replace(/\\/g, "/")) ||
                /(^|[\\/])effects[\\/][^\\/]+\.md$/i.test((path || "").replace(/\\/g, "/"))
            ) {
                preprocessed = renderEffectsMarkdown(preprocessed);
            }

            // First, apply inline formatting (bold, italic, color tokens)
            const inlineFormatted = formatSkillInlineStyles(preprocessed);

            // Convert @Effect or @{Effect} into the intermediate [<img>]{key} form
            const effectsFormatted = formatEffectReferences(inlineFormatted);

            // Finally, convert any [texto]{key} occurrences into tooltip markup
            const parsed = parseCustomTooltips(effectsFormatted);

            const html = resolveAppRootImagePaths(marked.parse(parsed));

            element.innerHTML = html;
            playMoonTransition(element);

            // Re-initialize tooltips for dynamically injected markdown content
            try { initTooltips(); } catch (e) { /* ignore */ }
        })
        .catch(error => {
            console.error("Erro ao carregar Markdown:", error);
        });
}

// =========================
// LOAD SKILL
// =========================

function loadSkill(path, element, kind = "") {
    if (!path) return;

    const requestPageContainer = document.querySelector('.chars-page .page_container');
    const requestCharacterToken = requestPageContainer?.dataset.characterImageToken || "";
    const requestSkillPath = String(path).replace(/\\/g, "/").trim().toLowerCase();
    const isCurrentCharacterSkillRequest = () => {
        if (!document.body.classList.contains("chars-page")) {
            return true;
        }

        const currentPageContainer = document.querySelector('.chars-page .page_container');
        const currentSkillPath = String(currentPageContainer?.dataset.skillPath || "")
            .replace(/\\/g, "/")
            .trim()
            .toLowerCase();
        const currentCharacterToken = currentPageContainer?.dataset.characterImageToken || "";

        return Boolean(currentSkillPath)
            && currentSkillPath === requestSkillPath
            && (!requestCharacterToken || currentCharacterToken === requestCharacterToken);
    };

    const finishCharacterPanelLoading = () => {
        if (!String(kind).toLowerCase().includes("silent") && isCurrentCharacterSkillRequest()) {
            requestPageContainer?.classList.remove("is-character-loading");
        }
    };

    return fetch(path)
        .then(response => response.text())
        .then(text => {
            // A tier or character may have changed while this file was being
            // fetched. Never let that stale response re-enable tabs based on
            // the previous file's content.
            if (!isCurrentCharacterSkillRequest()) {
                return;
            }

            try {
                const overviewName = extractOverviewName(text);
                const overviewData = extractOverviewData(text);
                const normalizedPath = (path || "").replace(/\\/g, "/");
                const pageContainer = document.querySelector('.chars-page .page_container');
                const charFolder = pageContainer?.dataset.charFolder || "";
                const characterName = pageContainer?.dataset.characterName || "";
                const html = resolveAppRootImagePaths(
                    parseSkill(text, normalizedPath, charFolder, characterName)
                );
                const hasKitContent = /skill-card-row|skills-passives-section|skills-defense-section|skills-weapons-section|skills-ego-section|skills-ego-passives-section|skills-sanity-section/.test(html);
                const hasWeaponsContent = /skill-card-row\s+weapon-row|skills-weapons-section/.test(html);
                const isSilentLoad = String(kind).toLowerCase().includes("silent");
                const isInitialCharacterLoad = !isSilentLoad
                    && Boolean(pageContainer?.classList.contains("is-character-loading"));

                // Keep the previous character painted while its replacement is
                // fetched and parsed. Clear stale sections only now, immediately
                // before the new DOM is committed, so the browser never paints an
                // empty page_container between character selections.
                if (!isSilentLoad) {
                    clearDynamicCharacterContent();
                    resetCharacterSectionAvailability();
                }

                if (pageContainer) {
                    pageContainer.dataset.selectedHasKit = hasKitContent ? "true" : "false";
                    pageContainer.dataset.selectedHasOverview = hasOverviewContent(overviewData) ? "true" : "false";
                    pageContainer.dataset.selectedHasWeapons = hasWeaponsContent ? "true" : "false";
                }

                updateOverviewTabAvailability(hasOverviewContent(overviewData));
                setCharacterSectionVisibility('sanity', /skills-sanity-section/.test(html));
                syncVisibleCharacterSectionTab();

                // Only update header/overview when not loading in 'silent' mode
                if (!isSilentLoad) {
                    if (overviewName) {
                        setCharacterHeaderName(overviewName);
                    }

                    setCharacterOverviewData(overviewData);
                }

                if (element) {
                    // If not loading silently AND we have kit content, prepend the kit separator/name
                    if (!String(kind).toLowerCase().includes('silent') && hasKitContent) {
                        const kitTargetPath = escapeHtml(normalizedPath);

                        const kitCharacterName = escapeHtml(overviewName || characterName || "");

                        // If the parsed HTML already begins with a section that has
                        // the `no-separator` marker (e.g., defenses or passives when
                        // they're the first/only section), avoid rendering the kit
                        // header's own separator to prevent a duplicate line.
                        const startsWithNoSeparator = /^(\s*<div class="(skills-defense-section|skills-passives-section) no-separator")/i.test(html);

                        const kitHtml = `
                            <div class="chars-kit"
                                data-skill-path="${kitTargetPath}"
                                data-char-folder="${escapeHtml(charFolder)}"
                                data-character-folder="${escapeHtml(pageContainer?.dataset.characterFolder || characterName)}"
                                data-character-name="${escapeHtml(characterName)}">
                                <button type="button" class="chars-kit-name" aria-haspopup="dialog" aria-label="Abrir opções do Kit de ${kitCharacterName}">Kit</button>
                                <div class="chars-kit-character">${kitCharacterName}</div>
                                ${startsWithNoSeparator ? '' : '<div class="chars-kit-separator"></div>'}
                            </div>
                        `;

                        // Render the kit header plus the full parsed skills into the current mount
                        element.innerHTML = kitHtml + html;

                        // Also ensure the header area shows the kit (useful for the Kit tab view).
                        try {
                            const header = document.querySelector('.chars-page .chars-header');
                            const nav = document.querySelector('.chars-page .chars-section-tabs');

                            if (header && nav) {
                                try {
                                    // Do not show kit header when Overview tab is active.
                                    const activeTab = document.querySelector('.chars-page .chars-section-tab.active');
                                    const activeText = activeTab ? (activeTab.textContent || '').trim() : '';
                                    const kitNode = element.querySelector('.chars-kit');

                                    // If we actually want to show the kit in the header, create the mount and append.
                                    if (kitNode && activeText !== 'Overview') {
                                        let headerDynamic = header.querySelector('.chars-dynamic');
                                        if (!headerDynamic) {
                                            headerDynamic = document.createElement('div');
                                            headerDynamic.className = 'chars-dynamic';
                                            nav.insertAdjacentElement('afterend', headerDynamic);
                                        }

                                        headerDynamic.innerHTML = '';
                                        headerDynamic.appendChild(kitNode.cloneNode(true));
                                        headerDynamic.classList.add('is-mounted');
                                    } else {
                                        // If an existing empty mount is present, remove it to avoid CSS gap
                                        const existing = header.querySelector('.chars-dynamic');
                                        if (existing) {
                                            try { existing.parentElement.removeChild(existing); } catch (e) {}
                                        }
                                    }
                                } catch (e) {
                                    // ignore header mount errors
                                }
                            }
                        } catch (e) {
                            // ignore header mount errors
                        }
                    }
                    else {
                        // Only render skill content if there's actually something to show
                        if (hasKitContent) {
                            element.innerHTML = html;
                        } else {
                            element.innerHTML = "";
                        }
                    }

                    // If the .skill had no kit content, ensure the Overview's skills wrapper is not left visible
                    // and remove the chars-dynamic mount
                    if (!hasKitContent) {
                        try {
                            const overviewStrip = document.querySelector('.chars-page .chars-overview-strip');
                            if (overviewStrip) {
                                overviewStrip.querySelectorAll('.skills-wrapper').forEach(n => n.remove());
                            }
                        } catch (e) {
                            // ignore
                        }

                        // Remove the chars-dynamic mount if it exists and has no content
                        try {
                            const dynamicEl = document.querySelector('.chars-page .chars-header .chars-dynamic');
                            if (dynamicEl && !dynamicEl.innerHTML.trim()) {
                                if (dynamicEl.parentElement) {
                                    dynamicEl.parentElement.removeChild(dynamicEl);
                                }
                            }
                        } catch (e) {
                            // ignore
                        }
                    }

                    // Update skill submenu button availability based on the newly loaded content.
                    // If there is no wrapper (no skills/passives/defenses), pass an empty element
                    // so the availability logic will disable the submenu buttons.
                    try {
                        const wrapper = element.querySelector('.skills-wrapper');
                        if (wrapper) {
                            updateSkillSubmenuAvailability(wrapper);
                            updateWeaponsTabAvailability(wrapper);
                            try { updateEgoTabAvailability(wrapper); } catch (e) {}

                            if (isInitialCharacterLoad && wrapper.dataset.showcaseSection) {
                                setTimeout(() => {
                                    if (!isCurrentCharacterSkillRequest()) return;

                                    const showcaseSection = wrapper.dataset.showcaseSection;
                                    const tab = Array.from(document.querySelectorAll('.chars-page .chars-section-tab'))
                                        .find(sectionTab => normalizeSectionTabKey(
                                            sectionTab.getAttribute('data-section') || sectionTab.textContent || ''
                                        ) === showcaseSection);

                                    if (!tab || tab.classList.contains('disabled') || tab.hidden) return;

                                    if (showcaseSection === 'skills') {
                                        const submenu = document.querySelector('.chars-page .chars-skills-submenu');
                                        const skillType = wrapper.dataset.showcaseSkillType || 'skill';
                                        const skillIndex = wrapper.dataset.showcaseSkillIndex;
                                        const skillButtons = Array.from(submenu?.querySelectorAll(
                                            `.chars-skill-option[data-skill-type="${skillType}"]`
                                        ) || []);
                                        const isAvailable = button =>
                                            !button.classList.contains('disabled')
                                            && !button.hasAttribute('disabled')
                                            && !button.hidden;
                                        const selectedSkill = skillType === 'skill'
                                            ? skillButtons.find(button =>
                                                button.getAttribute('data-skill-index') === skillIndex && isAvailable(button)
                                            ) || skillButtons.find(button =>
                                                button.getAttribute('data-skill-index') === '0' && isAvailable(button)
                                            )
                                            : skillButtons.find(isAvailable);

                                        if (selectedSkill) {
                                            submenu.querySelectorAll('.chars-skill-option').forEach(button => button.classList.remove('active'));
                                            selectedSkill.classList.add('active');
                                        }
                                    }

                                    tab.click();
                                }, 0);
                            }
                        } else {
                            const empty = document.createElement('div');
                            updateSkillSubmenuAvailability(empty);
                            updateWeaponsTabAvailability(empty);
                            try { updateEgoTabAvailability(empty); } catch (e) {}
                        }
                    } catch (e) {
                        // ignore
                    }
                }

                if (!isSilentLoad && element?.classList.contains("chars-dynamic")) {
                    element.classList.add("is-mounted");
                }

                // Re-initialize tooltips for dynamically injected content
                try {
                    initTooltips();
                }
                catch (e) {
                    console.error('Erro ao inicializar tooltips após renderizar skill:', e);
                }
                playMoonTransition(element);
                finishCharacterPanelLoading();
            }
            catch (err) {
                console.error('Erro ao parsear .skill:', err);
                if (element) element.innerHTML = "";
                finishCharacterPanelLoading();
            }
        })
        .catch(error => {
            console.error("Erro ao carregar .skill:", error);
            if (element && isCurrentCharacterSkillRequest()) element.innerHTML = "";
            finishCharacterPanelLoading();
        });
}

function extractOverviewName(text) {

    const overviewData = extractOverviewData(text);

    if (!overviewData) {
        return "";
    }

    return overviewData.name;
}

function extractOverviewData(text) {

    const decodeSkillEntities = (value) => String(value || "")
        .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
            try { return String.fromCodePoint(Number.parseInt(hex, 16)); }
            catch { return _; }
        })
        .replace(/&#(\d+);?/g, (_, decimal) => {
            try { return String.fromCodePoint(Number.parseInt(decimal, 10)); }
            catch { return _; }
        })
        .replace(/&(nbsp|amp|lt|gt|quot|apos);/gi, (_, entity) => ({
            nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'"
        })[entity.toLowerCase()]);

    const source = decodeSkillEntities(text);

    if (!source.length) {
        return null;
    }

    const resolveSessionBlock = (sectionName) => {
        const section = String(sectionName || "").trim().toUpperCase();
        const legacyStart = `!${section.toLowerCase()}-start`;
        const legacyEnd = `!${section.toLowerCase()}-end`;
        const newPattern = new RegExp(`(?:^|\\n)\\s*S-${section}\\s*([\\s\\S]*?)(?:^|\\n)\\s*E-${section}\\s*(?:\\n|$)`, "im");
        const legacyPattern = new RegExp(`(?:^|\\n)\\s*${legacyStart}\\s*([\\s\\S]*?)(?:^|\\n)\\s*${legacyEnd}\\s*(?:\\n|$)`, "im");

        return source.match(newPattern) || source.match(legacyPattern) || null;
    };

    const overviewMatch = resolveSessionBlock("OVERVIEW");

    if (!overviewMatch) {
        return null;
    }

    const overviewRawLines = overviewMatch[1]
        .split(/\r?\n/)
        .map(line => line.trim());

    const overviewLines = overviewRawLines
        .filter(Boolean);

    const fieldAliases = {
        NAME: ["NAME", "name"],
        LEVEL: ["LEVEL", "level", "NÍVEL", "nível", "NIVEL", "nivel"],
        HP: ["HP", "life", "hp"],
        CA: ["CA", "ca"],
        SPEED: ["SPEED", "speed"],
        FORTITUDE: ["FORTITUDE", "fortitude"],
        PRUDENCE: ["PRUDENCE", "prudence"],
        TEMPERANCE: ["TEMPERANCE", "temperance"],
        JUSTICE: ["JUSTICE", "justice"],
        BLUNT: ["BLUNT", "blunt-res", "blunt_res", "blunt res", "blunt"],
        SLASH: ["SLASH", "slash-res", "slash_res", "slash res", "slash"],
        PIERCE: ["PIERCE", "pierce-res", "pierce_res", "pierce res", "pierce"],
        DESCRIPTION: ["DESCRIPTION", "description"]
    };

    const toAliasPattern = (aliases) => aliases
        .map(alias => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[-_\s]+/g, "[-_\\s]+"))
        .join("|");

    const cleanInlineValue = (rawValue) => {
        let value = String(rawValue || "")
            .replace(/;+\s*$/, "")
            .trim();

        if (!value) {
            return "";
        }

        value = value.replace(/^\(\s*/, "").replace(/\s*\)\s*$/, "");
        value = value.replace(/^\[\s*/, "").replace(/\s*\]\s*$/, "");

        return value.trim();
    };

    const readMultilineBlock = (startIndex, keyAliases) => {
        const collected = [];
        let started = false;
        let openingDelimiter = "";
        let closingDelimiter = "";
        let delimiterDepth = 0;

        for (let i = startIndex + 1; i < overviewLines.length; i++) {
            let line = overviewLines[i];
            const trimmed = line.trim();

            if (!trimmed) {
                continue;
            }

            if (!started) {
                if (trimmed.startsWith("(") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
                    started = true;
                    openingDelimiter = trimmed.charAt(0);
                    closingDelimiter = ({ "(": ")", "[": "]", "{": "}" })[openingDelimiter];
                    delimiterDepth = 1;
                    line = trimmed.slice(1).trim();
                }
                else {
                    const nextFieldMatch = trimmed.match(new RegExp(`^(${toAliasPattern(keyAliases)})\\s*(?::|\\()?`, "i"));
                    if (nextFieldMatch) {
                        break;
                    }
                    started = true;
                    line = trimmed;
                }
            }

            if (!line.length) {
                continue;
            }

            // Close only when reaching the matching outer delimiter. A
            // DESCRIPTION block may itself contain parenthesized text, such
            // as `(Antiga L. Corp.)`, before its final closing parenthesis.
            let closingIndex = -1;

            if (closingDelimiter) {
                for (let characterIndex = 0; characterIndex < line.length; characterIndex++) {
                    const character = line.charAt(characterIndex);

                    if (character === openingDelimiter) {
                        delimiterDepth++;
                    }
                    else if (character === closingDelimiter) {
                        delimiterDepth--;

                        if (delimiterDepth === 0) {
                            closingIndex = characterIndex;
                            break;
                        }
                    }
                }
            }

            if (closingIndex >= 0) {
                const content = line.slice(0, closingIndex).trim();
                if (content.length) {
                    collected.push(content);
                }
                break;
            }

            collected.push(line);
        }

        return collected.join("\n").trim().replace(/\\n/g, "\n");
    };

    const readValue = (aliases) => {
        const keyAliases = Array.isArray(aliases) ? aliases : [aliases];
        const startPattern = new RegExp(`^(${toAliasPattern(keyAliases)})\\s*(?::|\\()?\\s*(.*)$`, "i");

        for (let i = 0; i < overviewLines.length; i++) {
            const line = overviewLines[i];
            const match = line.match(startPattern);

            if (!match) {
                continue;
            }

            const remainder = cleanInlineValue(match[2]);
            if (remainder.length) {
                return remainder;
            }

            return readMultilineBlock(i, keyAliases);
        }

        return "";
    };

    const readBlock = (aliases) => readValue(aliases);

    const readDescriptionPanels = () => {
        const panels = [];

        for (let index = 0; index < overviewRawLines.length; index++) {
            const headerMatch = overviewRawLines[index].match(/^DESCRIPTION\s*\((.*)\)\s*(.*)$/i);

            if (!headerMatch) {
                continue;
            }

            const title = headerMatch[1].trim() || "Descrição";
            let openLine = index;
            let openingIndex = overviewRawLines[index].indexOf("{");

            while (openingIndex < 0 && ++openLine < overviewRawLines.length) {
                openingIndex = overviewRawLines[openLine].indexOf("{");
            }

            if (openingIndex < 0) {
                continue;
            }

            const contentLines = [];
            let braceDepth = 1;
            let closed = false;

            for (let lineIndex = openLine; lineIndex < overviewRawLines.length; lineIndex++) {
                const line = overviewRawLines[lineIndex];
                const contentStart = lineIndex === openLine ? openingIndex + 1 : 0;
                let contentEnd = line.length;

                for (let characterIndex = contentStart; characterIndex < line.length; characterIndex++) {
                    const character = line.charAt(characterIndex);

                    if (character === "{") {
                        braceDepth++;
                    }
                    else if (character === "}") {
                        braceDepth--;

                        if (braceDepth === 0) {
                            contentEnd = characterIndex;
                            closed = true;
                            break;
                        }
                    }
                }

                contentLines.push(line.slice(contentStart, contentEnd));

                if (closed) {
                    index = lineIndex;
                    panels.push({
                        title,
                        content: contentLines.join("\n").trim().replace(/\\n/g, "\n")
                    });
                    break;
                }
            }
        }

        return panels;
    };

    const normalizeResistance = (rawValue) => {

        const value = String(rawValue || "").trim();
        const normalized = value.toLowerCase();

        if (["fatal", "vulnerable", "weak", "fragile"].includes(normalized)) {
            return {
                label: "Vulnerável",
                multiplier: "[x2]",
                tone: "fatal"
            };
        }

        if (["resistant", "ineff", "ineffective", "endurado"].includes(normalized)) {
            return {
                label: "Resistente",
                multiplier: "[x0,5]",
                tone: "ineff"
            };
        }

        if (["immune", "imune"].includes(normalized)) {
            return {
                label: "Imune",
                multiplier: "[x0]",
                tone: "immune"
            };
        }
        // Explicitly treat 'normal' and common synonyms as Normal (capitalized)
        if (["normal", "none", "nenhum", "nada"].includes(normalized)) {
            return {
                label: "Normal",
                multiplier: "[x1]",
                tone: "normal"
            };
        }

        // If nothing provided, treat as not-specified so caller can omit the field
        if (value.length === 0) {
            return null;
        }

        // Any other custom text: surface it as-is and mark as custom tone so we can style it differently
        return {
            label: value,
            multiplier: "",
            tone: "custom"
        };
    };

    const name = readValue(fieldAliases.NAME) || "";
    const descriptions = readDescriptionPanels();
    const legacyDescription = descriptions.length ? "" : readBlock(fieldAliases.DESCRIPTION);

    return {
        name,
        level: readValue(fieldAliases.LEVEL),
        life: readValue(fieldAliases.HP),
        stagger: readValue(["STAGGER", "stagger"]),
        speed: readValue(fieldAliases.SPEED),
        ca: readValue(fieldAliases.CA),
        attributes: {
            fortitude: readValue(fieldAliases.FORTITUDE),
            prudence: readValue(fieldAliases.PRUDENCE),
            temperance: readValue(fieldAliases.TEMPERANCE),
            justice: readValue(fieldAliases.JUSTICE)
        },
        description: legacyDescription,
        descriptions: descriptions.length
            ? descriptions
            : legacyDescription
                ? [{ title: "Descrição", content: legacyDescription }]
                : [],
        resistances: {
            blunt: normalizeResistance(readValue(fieldAliases.BLUNT)),
            slash: normalizeResistance(readValue(fieldAliases.SLASH)),
            pierce: normalizeResistance(readValue(fieldAliases.PIERCE))
        }
    };
}

// =========================
// AUTO LOAD
// =========================

function loadContent(path, element, kind = "") {

    if (resolveContentMode(path, kind) === "skill") {
        return loadSkill(path, element, kind);
    }
    else {
        return loadMarkdown(path, element);
    }
}

function resolveContentMode(path, explicitKind = "") {

    const normalizedPath = (path || "").replace(/\\/g, "/");
    const normalizedKind = (explicitKind || "").trim().toLowerCase();

    if (normalizedKind === "skill" || normalizedPath.endsWith(".skill")) {
        return "skill";
    }

    return "markdown";
}

function resolveContentTarget(button) {

    return (
        button.getAttribute("data-target") ||
        button.getAttribute("data-md") ||
        button.getAttribute("showcase") ||
        ""
    );
}

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function resolveCharacterImagePath(folder, fileName) {

    const normalizedFileName = String(fileName || "").trim();

    if (!normalizedFileName) {
        return "";
    }

    const normalizedFolder = String(folder || "").trim();

    const relativePath = normalizedFolder.length
        ? `../../bd/chars/${normalizedFolder}/${normalizedFileName}`
        : `../../bd/chars/${normalizedFileName}`;

    // The characters page can be rendered directly from src/pages or inside
    // the SPA at index.html.  Resolving from the script URL keeps assets at
    // the project root in both cases instead of resolving from the current
    // route (which was making the portrait request point outside the app).
    return resolveScriptAssetPath(relativePath);
}

function resolveCharacterFolderName(label, targetFileName = "") {

    const normalizedLabel = String(label || "").trim();
    const normalizedTarget = String(targetFileName || "")
        .trim()
        .replace(/\.skill$/i, "");

    if (
        normalizedLabel.toLowerCase() === "wuhan xia" ||
        normalizedTarget.toLowerCase() === "wuhan xia"
    ) {
        return "Wuhan XIa";
    }

    return normalizedLabel || normalizedTarget;
}

async function resolveCharacterImageSrc(
    folder,
    characterName,
    imageFileName,
    type = "showcase"
) {

    const normalizedFolder =
        String(folder || "")
            .replace(/\\/g, "/")
            .replace(/^\/+|\/+$/g, "")
            .trim();

    const normalizedCharacter =
        String(characterName || "")
            .trim();

    const normalizedType =
        String(type || "showcase")
            .trim()
            .toLowerCase();

    // ==================================================
    // NOME PADRÃO DAS IMAGENS GERENCIADAS PELO EDITOR
    // ==================================================

    const defaultName =
        normalizedType === "combat"
            ? "combat"
            : "showcase";

    const requestedFile =
        String(imageFileName || "")
            .trim();

    // Se o editor não informou um nome específico,
    // procuramos showcase/combat.
    const file =
        requestedFile || defaultName;

    const hasExtension =
        /\.[^./\\]+$/i.test(file);

    const fileNames =
        hasExtension
            ? [file]
            : [
                file,
                `${file}.png`,
                `${file}.jpg`,
                `${file}.jpeg`,
                `${file}.webp`,
                `${file}.gif`
            ];

    // ==================================================
    // MONTA O CAMINHO DA PASTA DO PERSONAGEM
    // ==================================================

    if (!normalizedCharacter) {
        return "";
    }

    const characterFolder =
        normalizedFolder
            ? `${normalizedFolder}/${normalizedCharacter}`
            : normalizedCharacter;

    // ==================================================
    // TESTA AS IMAGENS
    //
    // A pasta física é:
    //
    // bd/chars/
    //     [grupo/]personagem/
    //
    // ==================================================

    for (const fileName of fileNames) {

        const relativePath =
            `../../bd/chars/${characterFolder}/${fileName}`;

        const src = resolveScriptAssetPath(relativePath);

        const exists =
            await verifyImageExists(src);

        if (exists) {
            return src;
        }
    }

    return "";
}

function resolveCharacterSkillPath(folder, fileName, characterFolder = "") {

    const normalizedFileName =
        String(fileName || "").trim();

    if (!normalizedFileName) {
        return "";
    }

    const normalizedFolder =
        String(folder || "").trim();

    const hasPathSeparators =
        /[\\/]/.test(normalizedFileName);

    const looksLikeUrl =
        /^[a-zA-Z]+:\/\//.test(normalizedFileName)
        || normalizedFileName.startsWith('/');

    if (
        !hasPathSeparators &&
        !looksLikeUrl
    ) {

        const cleanName =
            normalizedFileName.replace(/\.skill$/i, "");

        const normalizedCharacterFolder = String(characterFolder || "").trim();

        if (normalizedFolder.length && normalizedCharacterFolder.length) {
            return resolveScriptAssetPath(`../../bd/chars/${normalizedFolder}/${normalizedCharacterFolder}/${normalizedFileName}`);
        }

        if (normalizedFolder.length) {
            return resolveScriptAssetPath(`../../bd/chars/${normalizedFolder}/${cleanName}/${normalizedFileName}`);
        }

        if (normalizedCharacterFolder.length) {
            return resolveScriptAssetPath(`../../bd/chars/${normalizedCharacterFolder}/${normalizedFileName}`);
        }

        return resolveScriptAssetPath(`../../bd/chars/${cleanName}/${normalizedFileName}`);
    }

    return looksLikeUrl ? normalizedFileName : resolveScriptAssetPath(normalizedFileName);
}

function normalizeSkillVariantName(fileName) {
    return String(fileName || "").trim().replace(/\.skill$/i, "").trim();
}

function extractSkillVariantNumber(fileName) {
    const normalized = String(fileName || "").trim();
    const match = normalized.match(/^(.*?)(?:\((\d+)\))?\.skill$/i);

    if (!match) {
        return { baseName: normalizeSkillVariantName(normalized), variantNumber: 1 };
    }

    const [, baseName, variantNumber] = match;
    return {
        baseName: baseName.trim(),
        variantNumber: variantNumber ? Number(variantNumber) : 1
    };
}

async function skillFileExists(url) {
    try {
        const response = await fetch(url, { method: "HEAD" });
        if (response.ok) return true;
    } catch (error) {
        // ignore and fallback to GET below
    }

    try {
        const response = await fetch(url, { method: "GET" });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function resolveSkillVariantPaths(skillPath) {
    const normalizedPath = String(skillPath || "").trim();

    if (!normalizedPath) {
        return [];
    }

    return [normalizedPath.replace(/\\/g, "/")];
}

async function setCharacterSkillVariant(variantIndex) {
    const pageContainer = document.querySelector(".chars-page .page_container");
    if (!pageContainer) return;

    const variants = JSON.parse(pageContainer.dataset.skillVariants || "[]");
    if (!Array.isArray(variants) || !variants.length) return;

    const safeIndex = Math.max(0, Math.min(Number(variantIndex) || 0, variants.length - 1));
    const nextPath = variants[safeIndex];
    if (!nextPath) return;

    pageContainer.dataset.skillPath = nextPath;
    pageContainer.dataset.skillVariantIndex = String(safeIndex);

    await syncCharacterSkillVariantBadge();

    // A troca de tier altera a fonte dos dados, mas não deve trocar a seção
    // que a pessoa está consultando. Reaproveitamos o manipulador da aba ativa
    // para renderizar Armas, Skills ou E.G.O com o arquivo recém-selecionado.
    const activeTab = document.querySelector(".chars-page .chars-section-tab.active");
    const activeTabKey = normalizeSectionTabKey(activeTab?.textContent || "");

    if (activeTab && activeTabKey !== "overview") {
        activeTab.click();
        return;
    }

    changeContent(nextPath, "skill");
}

async function initCharacterSkillVariantBadge() {
    const pageContainer = document.querySelector(".chars-page .page_container");
    if (!pageContainer) return;

    const skillPath = String(pageContainer.dataset.skillPath || "").trim();
    if (!skillPath) {
        pageContainer.dataset.skillVariants = "[]";
        pageContainer.dataset.skillVariantIndex = "0";
        return;
    }

    await syncCharacterSkillVariantBadge();
}

async function syncCharacterSkillVariantBadge() {
    const pageContainer = document.querySelector(".chars-page .page_container");
    const badgeWrap = document.querySelector(".chars-page .chars-section-badge-wrap");

    if (!pageContainer || !badgeWrap) {
        return;
    }

    const renderToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    pageContainer.dataset.skillBadgeToken = renderToken;
    // Keep the badge row mounted while checking the next character. Removing
    // it makes the section tabs jump vertically whenever tiers are found.
    badgeWrap.classList.add("is-loading");

    const skillPath = String(pageContainer.dataset.skillPath || "").trim();

    if (!skillPath) {
        pageContainer.dataset.skillVariants = "[]";
        pageContainer.dataset.skillVariantIndex = "0";
        badgeWrap.innerHTML = "";
        badgeWrap.classList.remove("is-loading", "has-variants");
        return;
    }

    const variants = await resolveSkillVariantPaths(skillPath);

    if (String(pageContainer.dataset.skillBadgeToken || "") !== renderToken) {
        return;
    }

    const resolvedIndex = variants.findIndex(variant => variant.toLowerCase() === skillPath.toLowerCase());
    const currentIndex = resolvedIndex >= 0 ? resolvedIndex : Math.max(0, Number(pageContainer.dataset.skillVariantIndex || 0));

    if (variants.length < 2) {
        pageContainer.dataset.skillVariants = "[]";
        pageContainer.dataset.skillVariantIndex = "0";
        badgeWrap.innerHTML = "";
        badgeWrap.classList.remove("is-loading", "has-variants");
        return;
    }

    const safeIndex = Math.min(currentIndex, variants.length - 1);
    const activePath = variants[safeIndex] || variants[0];

    pageContainer.dataset.skillVariants = JSON.stringify(variants);
    pageContainer.dataset.skillVariantIndex = String(safeIndex);
    pageContainer.dataset.skillPath = activePath;

    badgeWrap.innerHTML = "";

    variants.forEach((variantPath, index) => {
        const currentFileName = variantPath.split("/").pop();
        const { variantNumber } = extractSkillVariantNumber(currentFileName);
        const tierNumber = Number.isFinite(variantNumber) ? variantNumber : index + 1;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "chars-section-badge" + (index === safeIndex ? " active" : "");
        button.dataset.variantIndex = String(index);
        button.dataset.variantNumber = String(tierNumber);
        button.setAttribute("aria-label", `Versão ${tierNumber}`);
        button.title = `Versão ${tierNumber}`;

        const img = document.createElement("img");
        img.src = resolveScriptAssetPath(`../../res/uptie/T${Math.min(tierNumber, 6)}.png`);
        img.alt = `T${tierNumber}`;
        button.appendChild(img);

        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await setCharacterSkillVariant(index);
            button.blur();
        });

        badgeWrap.appendChild(button);
    });

    badgeWrap.classList.remove("is-loading");
    badgeWrap.classList.add("has-variants");
}

async function cycleCharacterSkillVariant() {
    const pageContainer = document.querySelector(".chars-page .page_container");
    if (!pageContainer) return;

    const variants = JSON.parse(pageContainer.dataset.skillVariants || "[]");
    if (variants.length < 2) return;

    const currentIndex = Number(pageContainer.dataset.skillVariantIndex || 0);
    const nextIndex = (currentIndex + 1) % variants.length;
    await setCharacterSkillVariant(nextIndex);
}

const characterImageResolutionCache = new Map();
const characterImageWarmCache = new Set();
const characterSkillWarmCache = new Set();

function normalizeAssetCacheKey(...parts) {
    return parts
        .map(part => String(part || "").trim().toLowerCase())
        .join("::");
}

function getCharacterImageKey(folder, characterName, imageFileName, type) {
    return normalizeAssetCacheKey(folder, characterName, imageFileName, type);
}

function resolveCharacterImageSrcCached(
    folder,
    characterName,
    imageFileName,
    type = "showcase"
) {
    const cacheKey = getCharacterImageKey(folder, characterName, imageFileName, type);

    if (characterImageResolutionCache.has(cacheKey)) {
        return characterImageResolutionCache.get(cacheKey);
    }

    const promise = resolveCharacterImageSrc(folder, characterName, imageFileName, type)
        .catch(() => "")
        .then(src => src || "");

    characterImageResolutionCache.set(cacheKey, promise);
    return promise;
}

function warmSkillPath(path) {
    const normalizedPath = String(path || "").trim();

    if (!normalizedPath || characterSkillWarmCache.has(normalizedPath)) {
        return;
    }

    characterSkillWarmCache.add(normalizedPath);

    fetch(normalizedPath, {
        cache: "force-cache"
    })
        .then(response => response.text())
        .catch(() => {});
}

function warmImageSrc(src) {
    const normalizedSrc = String(src || "").trim();

    if (!normalizedSrc || characterImageWarmCache.has(normalizedSrc)) {
        return;
    }

    characterImageWarmCache.add(normalizedSrc);

    const image = new Image();
    image.decoding = "async";
    image.src = normalizedSrc;

    image.onload = () => {
        if (typeof image.decode === "function") {
            image.decode().catch(() => {});
        }
    };

    image.onerror = () => {};
}

function getCharacterAssetCandidates(node, inheritedFolder = "") {
    if (!node || typeof node !== "object") {
        return null;
    }

    const isGroup = node.type === "group";
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const nodeFolder = [inheritedFolder, node.folder || ""]
        .filter(Boolean)
        .join("/")
        .trim();

    if (isGroup && hasChildren) {
        return null;
    }

    const label = node.label || node.title || node.name || "";
    const rawTarget = String(node.target || node.content || node.path || "").trim();

    if (!rawTarget && !String(label || "").trim()) {
        return null;
    }

    const characterFolder = resolveCharacterFolderName(label, rawTarget);
    const skillPath = resolveCharacterSkillPath(nodeFolder, rawTarget, characterFolder);
    const baseCharacter = String(label || characterFolder || rawTarget || "").trim();

    const explicitShowcase = String(
        node.showcaseSrc ||
        node.showcase ||
        node.showcaseImg ||
        node.showcaseImage ||
        node.imageShowcase ||
        node.image ||
        ""
    ).trim();

    const explicitCombat = String(
        node.combatSrc ||
        node.combat ||
        node.combatImg ||
        node.combatImage ||
        node.imageCombat ||
        ""
    ).trim();

    return {
        skillPath,
        folder: nodeFolder,
        characterName: baseCharacter,
        showcaseSource: explicitShowcase,
        combatSource: explicitCombat,
        nodeFolder,
        rawTarget,
        characterFolder
    };
}

function collectCharacterAssetJobs(nodes, inheritedFolder = "") {
    const jobs = [];

    const visit = (node, folder = "") => {
        if (!node || typeof node !== "object") {
            return;
        }

        if (node.type !== "group" && node.hidden) {
            return;
        }

        const nextFolder = [folder, node.folder || ""]
            .filter(Boolean)
            .join("/")
            .trim();

        if (node.type === "group" && Array.isArray(node.children) && node.children.length) {
            node.children.forEach(child => visit(child, nextFolder));
            return;
        }

        const assetData = getCharacterAssetCandidates(node, folder);

        if (assetData) {
            jobs.push(assetData);
        }
    };

    nodes.forEach(node => visit(node, inheritedFolder));
    return jobs;
}

function scheduleCharacterAssetPreload(nodes) {
    const jobs = collectCharacterAssetJobs(nodes);

    if (!jobs.length) {
        return;
    }

    const batchSize = 3;
    let index = 0;

    const runBatch = () => {
        const batch = jobs.slice(index, index + batchSize);
        index += batch.length;

        if (!batch.length) {
            return;
        }

        Promise.allSettled(batch.map(job => {
            if (job.skillPath) {
                warmSkillPath(job.skillPath);
            }

            const imageJobs = [];

            if (job.showcaseSource) {
                imageJobs.push(
                    resolveCharacterImageSrcCached(job.folder, job.characterName, job.showcaseSource, "showcase").then(src => {
                        if (src) {
                            warmImageSrc(src);
                        }
                    })
                );
            }

            if (job.combatSource) {
                imageJobs.push(
                    resolveCharacterImageSrcCached(job.folder, job.characterName, job.combatSource, "combat").then(src => {
                        if (src) {
                            warmImageSrc(src);
                        }
                    })
                );
            }

            return Promise.allSettled(imageJobs);
        }))
            .finally(() => {
                if (index < jobs.length) {
                    if (typeof window.requestIdleCallback === "function") {
                        window.requestIdleCallback(runBatch, { timeout: 1200 });
                    }
                    else {
                        window.setTimeout(runBatch, 0);
                    }
                }
            });
    };

    if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(runBatch, { timeout: 1200 });
    }
    else {
        window.setTimeout(runBatch, 0);
    }
}

function verifyImageExists(src) {

    return new Promise(resolve => {

        if (!src) {
            resolve(false);
            return;
        }

        const image = new Image();

        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = src;
    });
}

// Kept only in memory so reloading the page resets the person's preference.
let isCharacterImageHiddenForSession = false;

function applyCharacterImage(imageElement, src, altText, token, pageContainer) {

    if (!imageElement) {
        return;
    }

    const header = document.querySelector(".chars-page .chars-header");

    const isCurrentRequest = () => !pageContainer || !token || pageContainer.dataset.characterImageToken === token;
    const hideImage = () => {
        if (!isCurrentRequest()) return;

        imageElement.classList.add("is-character-image-changing");
        window.setTimeout(() => {
            if (!isCurrentRequest()) return;
            imageElement.hidden = true;
            imageElement.removeAttribute("src");
            imageElement.alt = "";
            imageElement.classList.remove("is-character-image-changing");
            header?.classList.remove("has-showcase");
            updateCharacterImageToggle(false);
            syncCharacterSkillViewport();
            syncCharacterOverviewViewport();
        }, 140);
    };

    if (!src) {
        hideImage();
        return;
    }

    verifyImageExists(src).then(isAvailable => {

        if (!isCurrentRequest()) {
            return;
        }

        if (!isAvailable) {
            hideImage();
            return;
        }

        // Preserve the current portrait until the next one is decoded. This
        // prevents the showcase column from collapsing between characters.
        const nextImage = new Image();
        let hasStartedSwap = false;
        const showPreloadedImage = () => {
            if (hasStartedSwap || !isCurrentRequest()) return;
            hasStartedSwap = true;

            imageElement.classList.add("is-character-image-changing");
            window.setTimeout(() => {
                if (!isCurrentRequest()) return;

                imageElement.src = src;
                imageElement.alt = altText || "Personagem selecionado";
                imageElement.hidden = isCharacterImageHiddenForSession;
                header?.classList.toggle("has-showcase", !isCharacterImageHiddenForSession);
                updateCharacterImageToggle(true, isCharacterImageHiddenForSession);
                syncCharacterSkillViewport();
                syncCharacterOverviewViewport();

                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                        if (isCurrentRequest()) {
                            imageElement.classList.remove("is-character-image-changing");
                        }
                    });
                });
            }, 90);
        };

        nextImage.addEventListener("load", showPreloadedImage, { once: true });
        nextImage.addEventListener("error", hideImage, { once: true });
        nextImage.src = src;

        if (nextImage.complete && nextImage.naturalWidth > 0) {
            showPreloadedImage();
        }
    });
}

function openParentGroups(element) {

    let current = element.parentElement;

    while (current) {

        if (current.matches && current.matches("details.nav-group")) {
            current.open = true;
        }

        current = current.parentElement;
    }
}

function markActiveParentGroups(element) {

    document
        .querySelectorAll("details.nav-group.active-group")
        .forEach(group => {
            group.classList.remove("active-group");
        });

    let current = element.parentElement;

    while (current) {

        if (current.matches && current.matches("details.nav-group")) {
            current.classList.add("active-group");
        }

        current = current.parentElement;
    }
}

const MAX_CHARACTER_FOLDER_DEPTH = 3;

function buildCharsNode(node, inheritedFolder = "", depth = 0) {

    if (!node || typeof node !== "object") {
        return "";
    }

    if (node.type !== "group" && node.hidden) {
        return "";
    }

    const label = escapeHtml(node.label || node.title || node.name || "");
    const nodeFolder = [
    inheritedFolder,
    node.folder || ""
    ]
    .filter(Boolean)
    .join("/")
    .trim();

    const isGroup = node.type === "group";
    const defaultTarget = String(node.defaultTarget || "").trim();
    const rawTarget = String(defaultTarget || node.target || node.content || node.path || "").trim();
    const characterFolder = isGroup
        ? ""
        : resolveCharacterFolderName(node.label || node.title || node.name || "", rawTarget);

    if (isGroup && Array.isArray(node.children) && node.children.length) {
        const visibleChildren = node.children
            .map(child => buildCharsNode(child, [
                inheritedFolder,
                node.folder || ""
            ].filter(Boolean).join("/").trim(), depth >= MAX_CHARACTER_FOLDER_DEPTH ? depth : depth + 1))
            .filter(Boolean);

        if (!visibleChildren.length) {
            return "";
        }

        const isOpen = Boolean(node.open);
        const nextFolder = [
            inheritedFolder,
            node.folder || ""
        ]
        .filter(Boolean)
        .join("/")
        .trim();

        // Keep the navigation readable even if legacy data contains a deeper
        // filesystem hierarchy. The extra folder is transparent in the menu,
        // while its path is still preserved when resolving the character.
        if (depth >= MAX_CHARACTER_FOLDER_DEPTH) {
            return visibleChildren.join("");
        }

        return `
        <details class="nav-group" data-depth="${depth}"${isOpen ? " open" : ""}>
            <summary class="nav-group-toggle"><span class="nav-group-label">${label}</span></summary>
            <div class="nav-group-divider" aria-hidden="true"></div>
            <div class="nav-group-content nav-subtree" data-depth="${depth + 1}" style="--nav-depth:${depth + 1};">
                ${visibleChildren.join("")}
            </div>
        </details>
        `;
    }

    if (isGroup) {
        // A folder without children is informational only. Rendering it as a
        // button made it appear actionable even though there was no content
        // to open (for example, the "Index" subgroup).
        if (!Array.isArray(node.children) || node.children.length === 0) {
            return `
            <div class="nav-group nav-group-empty" data-depth="${depth}" aria-disabled="true">
                <span class="nav-group-empty-label">${label}</span>
            </div>
            `;
        }

        const visiblePath = escapeHtml(node.path || "");
        const targetPath = escapeHtml(resolveCharacterSkillPath(nodeFolder, rawTarget, characterFolder) || rawTarget);
        const kind = (node.kind || resolveContentMode(targetPath)).toString().toLowerCase();
        const defaultAttr = node.default ? " data-default" : "";
        const folderAttr = nodeFolder ? ` data-folder="${escapeHtml(nodeFolder)}"` : "";
        const characterFolderAttr = characterFolder ? ` data-character-folder="${escapeHtml(characterFolder)}"` : "";
        const showcaseAttr = node.showcaseSrc ? ` data-showcase-img="${escapeHtml(node.showcaseSrc)}"` : "";
        const combatAttr = node.combatSrc ? ` data-combat-img="${escapeHtml(node.combatSrc)}"` : "";

        return `
        <button class="nav-group-toggle nav-group-leaf"
            data-md="${visiblePath}"
                data-target="${targetPath}"
                data-kind="${kind}" data-depth="${depth}"${folderAttr}${characterFolderAttr}${showcaseAttr}${combatAttr}${defaultAttr}><span class="nav-character-label">${label}</span></button>
        `;
    }

    const visiblePath = escapeHtml(node.path || "");
    const targetPath = escapeHtml(resolveCharacterSkillPath(nodeFolder, rawTarget, characterFolder) || rawTarget);
    const kind = (node.kind || resolveContentMode(targetPath)).toString().toLowerCase();
    const defaultAttr = node.default ? " data-default" : "";
    const folderAttr = nodeFolder ? ` data-folder="${escapeHtml(nodeFolder)}"` : "";
    const characterFolderAttr = characterFolder ? ` data-character-folder="${escapeHtml(characterFolder)}"` : "";
    const showcaseAttr = node.showcaseSrc ? ` data-showcase-img="${escapeHtml(node.showcaseSrc)}"` : "";
    const combatAttr = node.combatSrc ? ` data-combat-img="${escapeHtml(node.combatSrc)}"` : "";

    return `
    <button
        data-target="${targetPath}" data-depth="${depth}"
        data-kind="${kind}"${folderAttr}${characterFolderAttr}${showcaseAttr}${combatAttr}${defaultAttr}><span class="nav-character-label">${label}</span></button>
    `;
}

async function initCharsNavigation() {

    const mount = document.querySelector("[data-chars-tree]");

    if (!mount) return;

    try {
        const response = await fetch(resolveScriptAssetPath("../../bd/chars.json"), { cache: "no-cache" });
        const data = await response.json();

        const nodes = Array.isArray(data)
            ? data
            : Array.isArray(data.children)
                ? data.children
                : [];

        mount.innerHTML = `
            <div class="nav-right nav-tree">
                ${nodes.map(node => buildCharsNode(node)).join("")}
            </div>
        `;

        scheduleCharacterAssetPreload(nodes);
    }
    catch (error) {
        console.error("Erro ao carregar chars.json:", error);
        mount.innerHTML = "<p>Não foi possível carregar os personagens.</p>";
    }

}

// =========================
// CONTENT CHANGE
// =========================

function getCharacterPageDynamicElement(pageContainer = document.querySelector('.chars-page .page_container')) {
    if (!pageContainer) return null;

    return Array.from(pageContainer.children)
        .find(child => child.matches('.page-dynamic, .chars-dynamic')) || null;
}

function getCharacterPageLandingElement(pageContainer = document.querySelector('.chars-page .page_container')) {
    if (!pageContainer) return null;

    return Array.from(pageContainer.children)
        .find(child => child.matches('.page-landing, .chars-landing')) || null;
}

function changeContent(path, kind = "") {

    // Tooltips live outside the page content. Clear one that may be hovered
    // or pinned before replacing the character/section it belongs to.
    window.hideMoonTooltip?.();

    // Prefer dynamic content container for character selections so the
    // initial landing markdown (mkd-content) is not overwritten.
    const pageContainer = document.querySelector('.page_container');
    const dynamicEl = getCharacterPageDynamicElement(pageContainer);
    const landingEl = getCharacterPageLandingElement(pageContainer);
    const element = dynamicEl || pageContainer?.querySelector('[mkd-content]') || document.querySelector('[mkd-content]');

    if (!element) return;

    // If we are loading into the dynamic container, hide the landing
    // markdown so it doesn't remain visible at the bottom of the page.
    if (dynamicEl && element === dynamicEl) {
        if (landingEl) landingEl.style.display = "none";
    }

    // adjust page_container visual mode when loading skills
    try {
        const mode = resolveContentMode(path, kind);
        if (pageContainer) {
            if (mode === "skill") pageContainer.classList.add("skills-mode");
            else pageContainer.classList.remove("skills-mode");
        }
        // Overview KIT injection is handled by loadSkill() after parsing the .skill file.
        // We avoid injecting the overview KIT here to prevent showing it when the
        // .skill file doesn't exist or contains no skills/passives/defenses.
    }
    catch (e) {
        // ignore
    }

    return loadContent(path, element, kind);
}

function updateSelectedCharacterAssets(button) {

    const pageContainer = document.querySelector(".chars-page .page_container");
    const header = document.querySelector(".chars-page .chars-header");
    const showcaseImage = document.querySelector(".chars-page .chars-showcase-image");
    const swapButton = document.querySelector(".chars-page .chars-showcase-swap");

    if (!pageContainer || !button) return;

    pageContainer.dataset.charFolder = button.getAttribute("data-folder") || "";
    pageContainer.dataset.characterFolder = button.getAttribute("data-character-folder") || button.textContent?.trim() || "";
    pageContainer.dataset.characterName = button.textContent?.trim() || "";
    pageContainer.dataset.showcaseImg = button.getAttribute("data-showcase-img") || "";
    pageContainer.dataset.combatImg = button.getAttribute("data-combat-img") || "";
    pageContainer.dataset.showcaseSrc = button.getAttribute("data-showcase-src") || "";
    pageContainer.dataset.combatSrc = button.getAttribute("data-combat-src") || "";
    pageContainer.dataset.skillPath = button.getAttribute("data-target") || "";
    pageContainer.dataset.skillVariants = "[]";
    pageContainer.dataset.skillVariantIndex = "0";
    pageContainer.dataset.characterImageMode = "showcase";
    pageContainer.dataset.characterImageToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const showcaseSrc = button.getAttribute("data-showcase-src") || "";
    const combatSrc = button.getAttribute("data-combat-src") || "";
    const canSwap = Boolean(showcaseSrc && combatSrc);
    const currentToken = pageContainer.dataset.characterImageToken;

    // Keep the old showcase mounted until the next portrait has loaded; the
    // image swap itself will update the header and toggle controls.
    updateCharacterImageToggle(Boolean(showcaseImage?.getAttribute("src")));

    if (swapButton) {
        swapButton.hidden = !canSwap;
        swapButton.disabled = !canSwap;
        swapButton.dataset.mode = "showcase";
        swapButton.setAttribute("aria-pressed", "false");
        swapButton.setAttribute("aria-label", canSwap ? "Trocar para combate" : "Sem imagem de combate");
    }

    // Most entries use the conventional `showcase.*` file name and are
    // resolved asynchronously below.  Do not pass an empty URL to
    // applyCharacterImage here: it would fade out the current portrait before
    // the next one has been found, defeating the seamless handoff.
    if (showcaseImage && showcaseSrc) {
        applyCharacterImage(
            showcaseImage,
            showcaseSrc,
            pageContainer.dataset.characterName || "Personagem selecionado",
            currentToken,
            pageContainer
        );
    }

    if (canSwap && swapButton) {
        verifyImageExists(combatSrc).then(isAvailable => {

            if (pageContainer.dataset.characterImageToken !== currentToken) {
                return;
            }

            if (!isAvailable) {
                swapButton.hidden = true;
                swapButton.disabled = true;
                swapButton.setAttribute("aria-label", "Sem imagem de combate");
                return;
            }

            swapButton.hidden = false;
            swapButton.disabled = false;
            swapButton.dataset.mode = "showcase";
            swapButton.setAttribute("aria-pressed", "false");
            swapButton.setAttribute("aria-label", "Trocar para combate");
        });
    }

    // If no explicit `data-showcase-src`/`data-combat-src` provided or to prefer
    // the per-character folder layout, attempt to resolve more robustly.
    (async () => {
        try {
            const folder =
    pageContainer.dataset.charFolder || "";

const character =
    pageContainer.dataset.characterFolder ||
    pageContainer.dataset.characterName ||
    "";

            // Resolve showcase
            const resolvedShowcase = await resolveCharacterImageSrcCached(folder, character, pageContainer.dataset.showcaseImg || showcaseSrc, "showcase");

            if (resolvedShowcase) {
                pageContainer.dataset.showcaseSrc = resolvedShowcase;
                if (showcaseImage) applyCharacterImage(showcaseImage, resolvedShowcase, pageContainer.dataset.characterName || "Personagem selecionado", currentToken, pageContainer);
            }
            else if (!showcaseSrc && showcaseImage) {
                // Only remove the previous portrait after the conventional
                // file-name lookup has conclusively failed.
                applyCharacterImage(showcaseImage, "", "", currentToken, pageContainer);
            }

            // Resolve combat
            const resolvedCombat = await resolveCharacterImageSrcCached(folder, character, pageContainer.dataset.combatImg || combatSrc, "combat");

            if (resolvedCombat) {
                pageContainer.dataset.combatSrc = resolvedCombat;
            }

            // Update swap button availability based on resolved combat image
            const finalCombat = pageContainer.dataset.combatSrc || "";
            if (swapButton) {
                verifyImageExists(finalCombat).then(isAvailable2 => {
                    if (pageContainer.dataset.characterImageToken !== currentToken) return;
                    if (!isAvailable2) {
                        swapButton.hidden = true;
                        swapButton.disabled = true;
                        swapButton.setAttribute("aria-label", "Sem imagem de combate");
                        return;
                    }
                    swapButton.hidden = false;
                    swapButton.disabled = false;
                    swapButton.dataset.mode = "showcase";
                    swapButton.setAttribute("aria-pressed", "false");
                    swapButton.setAttribute("aria-label", "Trocar para combate");
                });
            }
        } catch (e) {
            // ignore resolution errors
        }
    })();

    // Add skills-mode class to show black background when character is selected
    try {
        const pageContainer = document.querySelector('.page_container');
        if (pageContainer) pageContainer.classList.add('skills-mode');
    }
    catch (e) {
        // ignore
    }

    syncCharacterSkillVariantBadge().catch(() => {});
    syncCharacterSkillViewport();
    syncCharacterOverviewViewport();
}

function setSelectedCharacterShowcaseMode(mode = "showcase") {

    const pageContainer = document.querySelector(".chars-page .page_container");
    const header = document.querySelector(".chars-page .chars-header");
    const showcaseImage = document.querySelector(".chars-page .chars-showcase-image");
    const swapButton = document.querySelector(".chars-page .chars-showcase-swap");

    if (!pageContainer || !showcaseImage) {
        return;
    }

    const showcaseSrc = pageContainer.dataset.showcaseSrc || "";
    const combatSrc = pageContainer.dataset.combatSrc || "";
    const canSwap = Boolean(showcaseSrc && combatSrc);
    const nextMode = mode === "combat" && canSwap ? "combat" : "showcase";
    const nextSrc = nextMode === "combat" ? combatSrc : showcaseSrc;

    pageContainer.dataset.characterImageMode = nextMode;

    if (header) {
        header.classList.add("has-showcase");
    }

    if (swapButton) {
        swapButton.hidden = !canSwap;
        swapButton.disabled = !canSwap;
        swapButton.dataset.mode = nextMode;
        swapButton.setAttribute("aria-pressed", nextMode === "combat" ? "true" : "false");
        swapButton.setAttribute(
            "aria-label",
            nextMode === "showcase" ? "Trocar para combate" : "Trocar para showcase"
        );
    }

    applyCharacterImage(
        showcaseImage,
        nextSrc,
        pageContainer.dataset.characterName || "Personagem selecionado",
        null,
        null
    );

    syncCharacterSkillViewport();
    syncCharacterOverviewViewport();
}

function initCharacterShowcaseSwap() {

    const swapButton = document.querySelector(".chars-page .chars-showcase-swap");

    if (!swapButton) {
        return;
    }

    swapButton.addEventListener("click", () => {

        const pageContainer = document.querySelector(".chars-page .page_container");
        const hasCombatImage = Boolean(pageContainer?.dataset.combatSrc);

        if (!hasCombatImage) {
            return;
        }

        const nextMode = pageContainer?.dataset.characterImageMode === "combat" ? "showcase" : "combat";

        setSelectedCharacterShowcaseMode(nextMode);

        swapButton.blur();
    });
}

function ensureCharacterHeaderNameElement() {

    const header = document.querySelector(".chars-page .chars-header");
    const sectionTabs = document.querySelector(".chars-page .chars-section-tabs");

    if (!header || !sectionTabs) {
        return null;
    }

    let headerInfo = header.querySelector(".chars-header-info");

    if (!headerInfo) {
        headerInfo = document.createElement("div");
        headerInfo.className = "chars-header-info";
        headerInfo.style.display = "flex";
        headerInfo.style.flexDirection = "column";
        headerInfo.style.alignItems = "flex-start";
        headerInfo.style.justifyContent = "flex-start";
        headerInfo.style.gap = "10px";
        headerInfo.style.minWidth = "0";

        header.insertBefore(headerInfo, sectionTabs);
        headerInfo.appendChild(sectionTabs);
    }

    let nameElement = headerInfo.querySelector(".chars-character-name");

    if (!nameElement) {
        nameElement = document.createElement("h2");
        nameElement.className = "chars-character-name";
        // Styling handled in CSS; keep element clean so stylesheets control appearance
        nameElement.style.display = "none";

        headerInfo.insertBefore(nameElement, headerInfo.firstChild);
    }

    let imageToggle = headerInfo.querySelector(".chars-image-toggle");

    if (!imageToggle) {
        const nameRow = document.createElement("div");
        nameRow.className = "chars-name-row";
        headerInfo.insertBefore(nameRow, nameElement);
        nameRow.appendChild(nameElement);

        imageToggle = document.createElement("button");
        imageToggle.type = "button";
        imageToggle.className = "chars-image-toggle";
        imageToggle.hidden = true;
        imageToggle.setAttribute("aria-label", "Esconder imagem");
        imageToggle.title = "Esconder imagem";
        imageToggle.innerHTML = '<span class="chars-image-toggle-icon" aria-hidden="true"></span>';
        imageToggle.addEventListener("click", () => {
            const image = document.querySelector(".chars-page .chars-showcase-image");
            const currentHeader = document.querySelector(".chars-page .chars-header");

            if (!image || !currentHeader || !image.getAttribute("src")) {
                return;
            }

            const shouldShow = image.hidden;
            image.hidden = !shouldShow;
            isCharacterImageHiddenForSession = !shouldShow;
            currentHeader.classList.toggle("has-showcase", shouldShow);
            imageToggle.setAttribute("aria-label", shouldShow ? "Esconder imagem" : "Mostrar imagem");
            imageToggle.title = shouldShow ? "Esconder imagem" : "Mostrar imagem";
            imageToggle.classList.toggle("is-hidden", !shouldShow);
            syncCharacterSkillViewport();
            syncCharacterOverviewViewport();
        });
        nameRow.appendChild(imageToggle);
    }

    return nameElement;
}

function updateCharacterImageToggle(isAvailable, isImageHidden = false) {
    const toggle = document.querySelector(".chars-page .chars-image-toggle");

    if (!toggle) {
        return;
    }

    toggle.hidden = !isAvailable;
    toggle.disabled = !isAvailable;
    toggle.classList.toggle("is-hidden", isAvailable && isImageHidden);
    toggle.setAttribute("aria-label", isImageHidden ? "Mostrar imagem" : "Esconder imagem");
    toggle.title = isImageHidden ? "Mostrar imagem" : "Esconder imagem";
}

function setCharacterHeaderName(name) {

    const nameElement = ensureCharacterHeaderNameElement();

    if (!nameElement) {
        return;
    }

    const normalizedName = String(name || "").trim();

    nameElement.textContent = normalizedName;
    nameElement.style.display = normalizedName ? "block" : "none";
}

function ensureCharacterOverviewElement() {

    const nameElement = ensureCharacterHeaderNameElement();
    // The name now lives inside `.chars-name-row` together with the image
    // toggle.  The overview must be a sibling of that row, not a child of it;
    // otherwise the status panel competes with the name for the same flex row
    // and crushes the character name/layout.
    const headerInfo = nameElement?.closest(".chars-header-info");

    if (!headerInfo) {
        return null;
    }

    let overviewElement = headerInfo.querySelector(".chars-overview-strip");

    if (!overviewElement) {
        overviewElement = document.createElement("section");
        overviewElement.className = "chars-overview-strip";
        overviewElement.setAttribute("aria-label", "Status, Resistências e Descrição");
        headerInfo.appendChild(overviewElement);
    }

    return overviewElement;
}

function initOverviewDescriptionTabs(root = document) {

    root.querySelectorAll(".overview-description-tabs").forEach(tabList => {
        const group = tabList.closest(".overview-description-group");

        if (!group) {
            return;
        }

        // The native scrollbar belongs above the buttons. Keep this small
        // proxy scroller synchronized with the actual tab strip so dragging,
        // mouse wheels and touch scrolling work from either element.
        const scrollProxy = group.querySelector(".overview-description-tabs-scroll");
        const scrollProxyContent = scrollProxy?.querySelector(".overview-description-tabs-scroll-content");

        if (scrollProxy && scrollProxyContent) {
            let isSyncingDescriptionScroll = false;

            const syncProxySize = () => {
                const needsHorizontalScroll = tabList.scrollWidth > tabList.clientWidth;
                scrollProxy.hidden = !needsHorizontalScroll;

                if (!needsHorizontalScroll) {
                    scrollProxy.scrollLeft = 0;
                    return;
                }

                scrollProxyContent.style.width = `${tabList.scrollWidth}px`;
                scrollProxy.scrollLeft = tabList.scrollLeft;
            };

            tabList.addEventListener("scroll", () => {
                if (isSyncingDescriptionScroll) return;
                isSyncingDescriptionScroll = true;
                scrollProxy.scrollLeft = tabList.scrollLeft;
                isSyncingDescriptionScroll = false;
            }, { passive: true });

            scrollProxy.addEventListener("scroll", () => {
                if (isSyncingDescriptionScroll) return;
                isSyncingDescriptionScroll = true;
                tabList.scrollLeft = scrollProxy.scrollLeft;
                isSyncingDescriptionScroll = false;
            }, { passive: true });

            // A roda sobre a faixa navega horizontalmente e nunca deve fazer
            // a página descer, mesmo quando já estiver no início ou no fim.
            const handleDescriptionTabsWheel = event => {
                if (tabList.scrollWidth <= tabList.clientWidth) {
                    event.preventDefault();
                    return;
                }

                const delta = event.deltaX || event.deltaY;
                if (!delta) return;

                tabList.scrollLeft += delta;
                event.preventDefault();
            };

            tabList.addEventListener("wheel", handleDescriptionTabsWheel, { passive: false });
            scrollProxy.addEventListener("wheel", handleDescriptionTabsWheel, { passive: false });

            window.requestAnimationFrame(syncProxySize);

            if (typeof ResizeObserver !== "undefined") {
                new ResizeObserver(syncProxySize).observe(tabList);
            }
        }

        const activateTab = (index) => {
            tabList.querySelectorAll(".overview-description-tab").forEach(tab => {
                const isActive = Number(tab.dataset.overviewDescriptionIndex) === index;
                tab.classList.toggle("active", isActive);
                tab.setAttribute("aria-selected", String(isActive));
            });

            group.querySelectorAll(".overview-description").forEach(panel => {
                const isActive = Number(panel.dataset.overviewDescriptionIndex) === index;
                panel.hidden = !isActive;
                panel.classList.toggle("is-active", isActive);
            });

            syncCharacterOverviewViewport();
        };

        tabList.querySelectorAll(".overview-description-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                activateTab(Number(tab.dataset.overviewDescriptionIndex));
            });
        });
    });
}

function setCharacterOverviewData(data) {

    const overviewElement = ensureCharacterOverviewElement();
    const pageContainer = document.querySelector(".chars-page .page_container");
    const hasKitContent = pageContainer?.dataset.selectedHasKit === "true";

    if (!overviewElement) {
        return;
    }

    if (!data) {
        overviewElement.classList.remove("is-visible");
        overviewElement.innerHTML = "";
        return;
    }

    const safeLife = data.life ? escapeHtml(data.life) : "";
    const safeSpeed = data.speed ? escapeHtml(data.speed) : "";
    const safeStagger = data.stagger ? escapeHtml(data.stagger) : "";
    const safeLevel = data.level ? escapeHtml(data.level) : "";
    const safeCA = data.ca ? escapeHtml(data.ca) : "";
    const descriptionPanels = (Array.isArray(data.descriptions) ? data.descriptions : [])
        .map(panel => ({
            title: String(panel?.title || "Descrição").trim() || "Descrição",
            content: String(panel?.content || "").trim()
        }))
        .filter(panel => panel.content.length);

    if (!descriptionPanels.length && data.description) {
        descriptionPanels.push({
            title: "Descrição",
            content: String(data.description)
        });
    }

    const buildResistance = (type, iconPath, resistance) => {
        if (!resistance) return "";

        const label = escapeHtml(resistance.label || "Normal");
        const multiplier = escapeHtml(resistance.multiplier || "");
        const tone = escapeHtml(resistance.tone || "normal");
        const tooltipKey = String(type || "").trim().toLowerCase();

        return `
            <div class="overview-item overview-item-resistance" data_tooltip="${tooltipKey}">
                <img class="overview-icon" src="${iconPath}" alt="${type}">
                <div class="overview-res-text">
                    <span class="overview-res-label tone-${tone}">${label}</span>
                </div>
            </div>
        `;
    };
    // Build Status items conditionally
    const statusItems = [];

    if (safeLife) {
        statusItems.push(`
            <div class="overview-item" data_tooltip = "life">
                <img class="overview-icon" src="../../res/skills/hp.png" alt="Life">
                <span class="overview-main-value">${safeLife}</span>
            </div>
        `);
    }

    if (safeStagger) {
        statusItems.push(`
            <div class="overview-item" data_tooltip = "stagger">
                <img class="overview-icon" src="../../res/skills/stagger.png" alt="Stagger">
                <span class="overview-main-value">${safeStagger}</span>
            </div>
        `);
    }

    if (safeLevel) {
        if (statusItems.length) {
            statusItems.push('<span class="overview-status-separator" aria-hidden="true"></span>');
        }

        statusItems.push(`
            <div class="overview-item overview-item-level" aria-label="Nível ${safeLevel}" title="Nível ${safeLevel}">
                <span class="overview-level-prefix">LV</span>
                <span class="overview-main-value">${safeLevel}</span>
            </div>
        `);
    }

    let postLevelSeparatorAdded = false;

        if (safeCA) {
            if (safeLevel && !postLevelSeparatorAdded) {
                statusItems.push('<span class="overview-status-separator" aria-hidden="true"></span>');
                postLevelSeparatorAdded = true;
            }

            statusItems.push(`
                <div class="overview-item" data_tooltip = "ca">
                    <img class="overview-icon" src="../../res/skills/defense.png" alt="CA">
                    <span class="overview-main-value">${safeCA}</span>
                </div>
            `);
        }
    
    if (safeSpeed) {
            if (safeLevel && !postLevelSeparatorAdded) {
                statusItems.push('<span class="overview-status-separator" aria-hidden="true"></span>');
                postLevelSeparatorAdded = true;
            }

        statusItems.push(`
            <div class="overview-item" data_tooltip = "speed">
                <img class="overview-icon" src="../../res/skills/speed.png" alt="Speed">
                <span class="overview-main-value">${safeSpeed}</span>
            </div>
        `);
    }


    // Build Resistances items conditionally
    const resistanceItems = [];

    resistanceItems.push(buildResistance("Slash", "../../res/skills/slash.png", data.resistances?.slash));
    resistanceItems.push(buildResistance("Pierce", "../../res/skills/pierce.png", data.resistances?.pierce));
    resistanceItems.push(buildResistance("Blunt", "../../res/skills/blunt.png", data.resistances?.blunt));

    // Filter out empty resistance entries
    const resistanceItemsFiltered = resistanceItems.filter(Boolean);
    const attributeDefinitions = [
        ["Fortitude", "fortitude"],
        ["Prudence", "prudence"],
        ["Temperance", "temperance"],
        ["Justice", "justice"]
    ];
    const attributeItems = attributeDefinitions.map(([label, key]) => {
        const value = String(data.attributes?.[key] || "").trim();

        if (!value) {
            return "";
        }

        return `
            <div class="overview-attribute-item" data_tooltip="attribute_${key}" aria-label="${label}: ${escapeHtml(value)}">
                <img class="overview-attribute-icon" src="../../res/att/${label}.png" alt="${label}">
                <span class="overview-attribute-value">${escapeHtml(value)}</span>
            </div>
        `;
    }).filter(Boolean);

    // Assemble final HTML only including non-empty groups
    let finalHtml = '';

    if (statusItems.length) {
        finalHtml += `
            <div class="overview-group">
                <p class="overview-group-title">Status</p>
                <div class="overview-items">
                    ${statusItems.join('')}
                </div>
            </div>
        `;
    }

    if (attributeItems.length) {
        finalHtml += `
            <div class="overview-group">
                <p class="overview-group-title">Atributos</p>
                <div class="overview-attributes">
                    ${attributeItems.join("")}
                </div>
            </div>
        `;
    }

    if (resistanceItemsFiltered.length) {
        finalHtml += `
            <div class="overview-group">
                <p class="overview-group-title">Resistências</p>
                <div class="overview-items">
                    ${resistanceItemsFiltered.join('')}
                </div>
            </div>
        `;
    }

    if (descriptionPanels.length) {
        const descriptionTabs = descriptionPanels.length > 1
            ? `
                <div class="overview-description-tabs-scroll" aria-hidden="true">
                    <div class="overview-description-tabs-scroll-content"></div>
                </div>
                <div class="overview-description-tabs" role="tablist" aria-label="Painéis de informação">
                    ${descriptionPanels.map((panel, index) => `
                        <button
                            type="button"
                            class="overview-description-tab${index === 0 ? " active" : ""}"
                            data-overview-description-index="${index}"
                            role="tab"
                            aria-selected="${index === 0}"
                        >${escapeHtml(panel.title)}</button>
                    `).join("")}
                </div>
            `
            : "";
        const descriptionContents = descriptionPanels.map((panel, index) => {
            const safeContent = parseCustomTooltips(
                formatSkillInlineStyles(
                    formatEffectReferences(escapeHtml(panel.content))
                )
            ).replace(/\n/g, "<br>");

            return `
                <div
                    class="overview-description${index === 0 ? " is-active" : ""}"
                    ${descriptionPanels.length > 1 ? `data-overview-description-index="${index}" role="tabpanel"` : ""}
                    ${index === 0 ? "" : "hidden"}
                >${safeContent}</div>
            `;
        }).join("");

        finalHtml += `
            <div class="overview-group overview-description-group">
                ${descriptionTabs}
                ${descriptionContents}
            </div>
        `;
    }

    if (!finalHtml.trim()) {
        overviewElement.classList.remove("is-visible");
        overviewElement.innerHTML = "";
        return;
    }

    overviewElement.innerHTML = resolveAppRootImagePaths(finalHtml);

    // Older markup used a native `title` for the level. Upgrade it to the
    // shared tooltip after rendering so it behaves like the other overview
    // statistics without duplicating the browser tooltip.
    overviewElement.querySelectorAll(".overview-item-level").forEach(item => {
        item.dataset.tooltip = "level";
        item.removeAttribute("title");
    });

    overviewElement.classList.add("is-visible");
    initOverviewDescriptionTabs(overviewElement);
    syncCharacterOverviewViewport();
}

function syncCharacterSkillViewport() {

    const pageContainer = document.querySelector(".chars-page .page_container");
    const header = document.querySelector(".chars-page .chars-header");
    const showcaseWrap = document.querySelector(".chars-page .chars-showcase-wrap");
    const dynamicEl = document.querySelector(".chars-page .chars-header .chars-dynamic");

    if (!pageContainer || !header || !showcaseWrap || !dynamicEl) {
        return;
    }

    const hasSkillContent = Boolean(dynamicEl.querySelector(".skills-wrapper"));

    // The mobile/tablet layout is a single column, so its content must keep
    // its natural height instead of being capped by the showcase image.
    if (window.matchMedia("(max-width: 980px)").matches || (!pageContainer.classList.contains("skills-mode") && !hasSkillContent)) {
        dynamicEl.style.maxHeight = "";
        dynamicEl.style.overflowY = "";
        dynamicEl.style.overflowX = "";
        return;
    }

    if (!header.classList.contains("has-showcase")) {
        dynamicEl.style.maxHeight = "";
        dynamicEl.style.overflowY = "";
        dynamicEl.style.overflowX = "";
        return;
    }

    window.requestAnimationFrame(() => {
        // The image can be hidden between scheduling this frame and its
        // execution. In that case, do not restore a stale constrained height.
        if (!header.classList.contains("has-showcase") || !dynamicEl.isConnected) {
            return;
        }

        const showcaseRect = showcaseWrap.getBoundingClientRect();
        const dynamicRect = dynamicEl.getBoundingClientRect();
        const availableHeight = Math.floor(showcaseRect.bottom - dynamicRect.top - 4);

        dynamicEl.style.overflowY = "auto";
        dynamicEl.style.overflowX = "hidden";
        dynamicEl.style.maxHeight = `${Math.max(120, availableHeight)}px`;
    });
}

function syncCharacterOverviewViewport() {

    const header = document.querySelector(".chars-page .chars-header");
    const showcaseWrap = document.querySelector(".chars-page .chars-showcase-wrap");
    const descriptionEl = document.querySelector(".chars-page .chars-overview-strip .overview-description.is-active");

    if (!header || !showcaseWrap || !descriptionEl) {
        return;
    }

    if (window.matchMedia("(max-width: 980px)").matches) {
        descriptionEl.style.maxHeight = "";
        descriptionEl.style.overflowY = "";
        descriptionEl.style.overflowX = "";
        return;
    }

    const overviewStrip = descriptionEl.closest(".chars-overview-strip");

    if (!overviewStrip || !overviewStrip.classList.contains("is-visible")) {
        descriptionEl.style.maxHeight = "";
        descriptionEl.style.overflowY = "";
        descriptionEl.style.overflowX = "";
        return;
    }

    if (!header.classList.contains("has-showcase")) {
        descriptionEl.style.maxHeight = "";
        descriptionEl.style.overflowY = "";
        descriptionEl.style.overflowX = "";
        return;
    }

    window.requestAnimationFrame(() => {
        // Avoid applying an old image-based height after the image is hidden.
        if (!header.classList.contains("has-showcase") || !descriptionEl.isConnected) {
            return;
        }

        const showcaseRect = showcaseWrap.getBoundingClientRect();
        const descriptionRect = descriptionEl.getBoundingClientRect();
        const availableHeight = Math.floor(showcaseRect.bottom - descriptionRect.top - 4);

        descriptionEl.style.overflowY = "auto";
        descriptionEl.style.overflowX = "hidden";
        // Keep enough room for the selected description to be comfortably
        // readable, even when its top starts below the showcase image.
        const minimumDescriptionHeight = window.innerWidth <= 980 ? 240 : 320;
        descriptionEl.style.maxHeight = `${Math.max(minimumDescriptionHeight, availableHeight)}px`;
    });
}

// Remove any dynamically mounted character content (skills, headers, submenu)
function clearDynamicCharacterContent(opts = {}) {
    const hideSubmenu = opts.hideSubmenu !== false;
    try {
        const pageContainer = document.querySelector('.chars-page .page_container');
        if (pageContainer) {
            pageContainer.dataset.selectedHasKit = "false";
            pageContainer.dataset.selectedHasOverview = "false";
        }

        const header = document.querySelector('.chars-page .chars-header');
        if (header) {
            const headerDynamic = header.querySelector('.chars-dynamic');
            if (headerDynamic) {
                headerDynamic.innerHTML = '';
                headerDynamic.classList.remove('is-mounted');
                if (headerDynamic.parentElement) headerDynamic.parentElement.removeChild(headerDynamic);
            }
        }

        // Remove any chars-dynamic inside page_container
        const pageContainerDynamic = document.querySelector('.page_container .chars-dynamic');
        if (pageContainerDynamic) {
            pageContainerDynamic.innerHTML = '';
            pageContainerDynamic.classList.remove('is-mounted');
            pageContainerDynamic.style.maxHeight = '';
            pageContainerDynamic.style.overflowY = '';
            pageContainerDynamic.style.overflowX = '';
        }

        // Remove any leftover chars-dynamic anywhere
        document.querySelectorAll('.chars-dynamic').forEach(el => {
            el.innerHTML = '';
            el.classList.remove('is-mounted');
        });

        const submenu = document.querySelector('.chars-page .chars-skills-submenu');
        if (submenu && hideSubmenu) {
            submenu.classList.remove('is-visible');
            submenu.style.left = '';
            submenu.style.top = '';
            submenu.style.width = '';
            // Remove any active state from submenu buttons so new character starts fresh
            try {
                submenu.querySelectorAll('.chars-skill-option.active').forEach(b => b.classList.remove('active'));
            } catch (e) {
                // ignore
            }
        }

        const overviewEl = document.querySelector('.chars-page .chars-overview-strip');
        if (overviewEl) overviewEl.classList.remove('is-visible');

    } catch (e) {
        // silently ignore DOM errors
    }
}

// =========================
// BUTTONS
// =========================

async function initMarkdownButtons() {

    const buttons =
        document.querySelectorAll(".nav-right button");

    if (!buttons.length) return;

    const contentElement = document.querySelector("[mkd-content]");
    const hasDirectMarkdown = Boolean(contentElement?.getAttribute("mkd-content"));
    const landingElement = document.querySelector(".chars-page .chars-landing");
    const sectionTabs = document.querySelector(".chars-page .chars-section-tabs");
    const shouldToggleSectionTabs = Boolean(sectionTabs);

    if (shouldToggleSectionTabs) {
        sectionTabs.classList.remove("is-visible");
    }

    function setActiveButton(button, opts = {}) {

        const openAncestors = Boolean(opts.openAncestors);

        buttons.forEach(btn => {

            btn.disabled = false;

            btn.classList.remove("active");
        });

        document
            .querySelectorAll("details.nav-group.active-group")
            .forEach(group => {
                group.classList.remove("active-group");
            });

        button.disabled = true;

        button.classList.add("active");

        if (openAncestors) {
            openParentGroups(button);
        }

        document
            .querySelector(".chars-page .page_container")
            ?.classList.add("is-character-loading");
        updateSelectedCharacterAssets(button);
        setCharacterHeaderName(button.textContent || "");
        // Do not clear the current character here. `loadSkill()` replaces the
        // old data only after the next .skill file has been fully prepared.

        if (shouldToggleSectionTabs) {
            sectionTabs.classList.add("is-visible");
        }

        markActiveParentGroups(button);
    }

    buttons.forEach(button => {

        button.addEventListener("click", () => {

            const path = resolveContentTarget(button);
            const kind = button.getAttribute("data-kind");
        
            if (!path) return;

            const activeCharacter = document.querySelector(".chars-page .nav-right button.active");
            const shouldScrollToTop = activeCharacter !== button;
        
            // Limpa/reseta ANTES de carregar o conteúdo
            setActiveButton(button, { openAncestors: true });
        
            // Agora carrega o .skill corretamente
            const contentLoad = changeContent(path, kind);
            
            // Reset section tabs to "Overview" (first tab) when character is selected
            const sectionTabs = document.querySelectorAll(".chars-page .chars-section-tab");
        
            if (sectionTabs.length) {
                sectionTabs.forEach((tab, index) => {
                    if (index === 0) {
                        tab.classList.add("active");
                    }
                    else {
                        tab.classList.remove("active");
                    }
                });
            }

            if (shouldScrollToTop) {
                const pageContainer = document.querySelector(".chars-page .page_container");
                const characterToken = pageContainer?.dataset.characterImageToken;
                Promise.resolve(contentLoad).then(() => {
                    if (pageContainer?.dataset.characterImageToken !== characterToken) return;
                    scrollCharactersPageToTop();
                });
            }
        });
    });

    const defaultButton =
        [...buttons].find(btn =>
            btn.hasAttribute("data-default")
        );

    const showcaseButton =
        [...buttons].find(btn =>
            btn.hasAttribute("showcase")
        );

    if (defaultButton) {

        const path = resolveContentTarget(defaultButton);
        const kind = defaultButton.getAttribute("data-kind");

        if (path) {
            setActiveButton(defaultButton, { openAncestors: true });
            await changeContent(path, kind);
        }

        return;
    }

    if (showcaseButton) {

        const path = resolveContentTarget(showcaseButton);
        const kind = showcaseButton.getAttribute("data-kind");

        if (path) {
            setActiveButton(showcaseButton, { openAncestors: true });
            await changeContent(path, kind);
        }

        return;
    }

    if (!hasDirectMarkdown) {

        const initialButton = buttons[0];

        if (initialButton) {

            const path = resolveContentTarget(initialButton);
            const kind = initialButton.getAttribute("data-kind");

            setActiveButton(initialButton, { openAncestors: true });
            await changeContent(path, kind);
        }
    }
}

function initSystemCombatSubsections() {

    const systemPage = document.querySelector(".system-page");
    const combatButton = systemPage?.querySelector("[data-system-combat-toggle]");
    const subsectionNav = systemPage?.querySelector(".system-combat-subnav");
    const subsectionButtons = [...(subsectionNav?.querySelectorAll("[data-system-combat-section]") || [])];

    if (!combatButton || !subsectionNav || !subsectionButtons.length) {
        return;
    }

    const defaultSubsection = subsectionButtons.find(button =>
        button.hasAttribute("showcase") || button.hasAttribute("data-default")
    ) || subsectionButtons.find(button =>
        button.getAttribute("aria-selected") === "true"
    ) || subsectionButtons[0];

    const selectSubsection = (selectedButton) => {
        subsectionButtons.forEach((button) => {
            const isSelected = button === selectedButton;
            button.setAttribute("aria-selected", isSelected ? "true" : "false");
            button.classList.toggle("active", isSelected);
        });
    };

    const openDefaultSubsection = () => {
        subsectionNav.hidden = false;
        combatButton.setAttribute("aria-expanded", "true");
        selectSubsection(defaultSubsection);

        const subsectionPath = defaultSubsection.getAttribute("data-md") || "";
        const combatPath = combatButton.getAttribute("data-md") || "";
        if (subsectionPath && subsectionPath !== combatPath) {
            changeContent(subsectionPath);
        }
    };

    systemPage.querySelector(".nav-right")?.addEventListener("click", (event) => {
        const clickedButton = event.target.closest("button");
        if (!clickedButton) return;

        const isCombatTab = clickedButton === combatButton;
        subsectionNav.hidden = !isCombatTab;
        combatButton.setAttribute("aria-expanded", isCombatTab ? "true" : "false");

        if (isCombatTab) {
            openDefaultSubsection();
        }
    });

    subsectionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            selectSubsection(button);
            changeContent(button.getAttribute("data-md") || "");
        });
    });

    if (combatButton.classList.contains("active")) {
        openDefaultSubsection();
    }
}

// =========================
// SECTION TABS
// =========================

function normalizeSectionTabKey(value = "") {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

// As abas representam seções que são opcionais no arquivo .skill. Elas não
// devem aparecer até que o parser confirme que a seção foi definida.
function setCharacterSectionVisibility(tabKey, visible) {
    const normalizedKey = normalizeSectionTabKey(tabKey);
    const sectionTabs = document.querySelectorAll('.chars-page .chars-section-tab');

    sectionTabs.forEach(tab => {
        const currentKey = normalizeSectionTabKey(
            tab.getAttribute('data-section') || tab.textContent || ''
        );
        const matches = currentKey === normalizedKey
            || (normalizedKey === 'weapons' && currentKey === 'armas')
            || (normalizedKey === 'armas' && currentKey === 'weapons');

        if (!matches) return;

        tab.hidden = !visible;
        tab.classList.toggle('disabled', !visible);
        if (visible) tab.removeAttribute('disabled');
        else tab.setAttribute('disabled', 'true');
    });
}

function syncVisibleCharacterSectionTab(preferredKey = 'overview') {
    const tabs = Array.from(document.querySelectorAll('.chars-page .chars-section-tab'));
    const visibleTabs = tabs.filter(tab => !tab.hidden);
    const tabsContainer = document.querySelector('.chars-page .chars-section-tabs');

    if (tabsContainer) {
        // Não deixe a moldura vazia das abas ocupar espaço quando o .skill
        // não declarou nenhuma seção para o personagem.
        tabsContainer.hidden = visibleTabs.length === 0;
    }

    if (!visibleTabs.length) return;

    const activeTab = visibleTabs.find(tab => tab.classList.contains('active'));
    const preferredTab = visibleTabs.find(tab => normalizeSectionTabKey(tab.textContent || '') === preferredKey);
    const nextTab = activeTab || preferredTab || visibleTabs[0];

    tabs.forEach(tab => tab.classList.toggle('active', tab === nextTab));
}

function resetCharacterSectionAvailability() {
    ['overview', 'armas', 'skills', 'ego', 'sanity'].forEach(key => setCharacterSectionVisibility(key, false));

    const submenu = document.querySelector('.chars-page .chars-skills-submenu');
    if (submenu) {
        submenu.hidden = true;
        submenu.querySelectorAll('.chars-skill-option').forEach(button => {
            button.hidden = true;
            button.classList.remove('active');
            button.classList.add('disabled');
            button.setAttribute('disabled', 'true');
        });
    }

    syncVisibleCharacterSectionTab();
}

function updateOverviewTabAvailability(hasOverview) {
    setCharacterSectionVisibility('overview', Boolean(hasOverview));
    syncVisibleCharacterSectionTab();
}

function hasOverviewContent(overviewData) {
    if (!overviewData) return false;

    const scalarFields = [
        overviewData.life,
        overviewData.stagger,
        overviewData.level,
        overviewData.speed,
        overviewData.ca
    ];
    const attributes = Object.values(overviewData.attributes || {});
    const resistances = Object.values(overviewData.resistances || {})
        .flatMap(resistance => Object.values(resistance || {}));

    return [...scalarFields, ...attributes, ...resistances]
        .some(value => String(value || '').trim().length > 0);
}

function initSectionTabs() {

    const sectionTabs = document.querySelectorAll(".chars-page .chars-section-tab");

    if (!sectionTabs.length) return;

    sectionTabs.forEach((tab, index) => {

        tab.addEventListener("click", () => {

            // Prevent click if tab is disabled
            if (tab.classList.contains('disabled') || tab.hasAttribute('disabled')) {
                return;
            }

            // Remove active class de todas as abas
            sectionTabs.forEach(t => t.classList.remove("active"));

            // Marca esta aba como ativa
            tab.classList.add("active");

            const tabText = tab.textContent.trim();
            const tabKey = normalizeSectionTabKey(
                tab.getAttribute('data-section') || tabText
            );
            const pageContainer = document.querySelector(".chars-page .page_container");
            const dynamicEl = getCharacterPageDynamicElement(pageContainer);
            const landingEl = getCharacterPageLandingElement(pageContainer);

            // Gerencia visibilidade do submenu de Skills
            const submenu = document.querySelector(".chars-page .chars-skills-submenu");
            if (submenu) submenu.classList.remove("is-visible");

            // Gerencia visibilidade do bloco 'Status' (overview)
            const overviewEl = document.querySelector(".chars-page .chars-overview-strip");
            if (overviewEl) overviewEl.classList.remove("is-visible");

            if (tabKey === "overview") {
                // ensure any previously mounted skill content is removed before showing Overview
                clearDynamicCharacterContent();
                // Overview deve mostrar as skills do personagem selecionado
                const skillPath = pageContainer?.dataset.skillPath || "";
                const kind = "skill";
                if (skillPath && dynamicEl && landingEl) {
                    landingEl.style.display = "none";
                    changeContent(skillPath, kind);
                }
            }
            else if (tabKey === "skills") {
                // Ao entrar em Skills, limpe qualquer renderização anterior antes de abrir o submenu
                clearDynamicCharacterContent({ hideSubmenu: false });
                if (dynamicEl && landingEl) {
                    landingEl.style.display = "none";
                }
                if (submenu) {
                    // Make submenu visible and extend it to the right edge of the page container
                    submenu.classList.add("is-visible");
                    submenu.style.left = '';
                    submenu.style.top = '';
                    submenu.style.width = '';
                }

                // Ensure skill content loads immediately: if there's no dynamic content mounted yet,
                // trigger click on the active skill button (or first one) so the skill appears without extra user action.
                try {
                    const hasDynamic = Boolean(dynamicEl && dynamicEl.querySelector('.skills-wrapper'));
                    if (submenu && !hasDynamic) {
                        const activeSkillBtn = submenu.querySelector('.chars-skill-option.active:not(.disabled):not([disabled]):not([hidden])')
                            || submenu.querySelector('.chars-skill-option:not(.disabled):not([disabled]):not([hidden])');
                        if (activeSkillBtn) {
                            // trigger click to reuse existing handler
                            activeSkillBtn.click();
                        }
                    }
                } catch (e) {
                    // ignore any DOM timing issues
                }

                syncCharacterSkillViewport();
            }
            else if (tabKey === "weapons" || tabKey === "armas") {
                clearDynamicCharacterContent({ hideSubmenu: true });

                const skillPath = pageContainer?.dataset.skillPath || '';
                if (!skillPath || !pageContainer) {
                    return;
                }

                if (landingEl) {
                    landingEl.style.display = "none";
                }

                const header = document.querySelector('.chars-page .chars-header');
                const nav = document.querySelector('.chars-page .chars-section-tabs');
                let mount = null;

                if (header && nav) {
                    mount = header.querySelector('.chars-dynamic');
                    if (!mount) {
                        mount = document.createElement('div');
                        mount.className = 'chars-dynamic';
                        nav.insertAdjacentElement('afterend', mount);
                    }

                    try {
                        const gap = 6;
                        mount.style.marginTop = `${gap}px`;
                    } catch (e) {
                        // ignore
                    }
                }

                const dynamicElArmas = mount || getCharacterPageDynamicElement(pageContainer);
                if (!dynamicElArmas) {
                    return;
                }

                dynamicElArmas.classList.remove('is-mounted');
                dynamicElArmas.innerHTML = "";

                const tempMount = document.createElement('div');
                tempMount.style.position = 'absolute';
                tempMount.style.left = '-9999px';
                tempMount.style.width = '1px';
                tempMount.style.height = '1px';
                tempMount.style.overflow = 'hidden';
                document.body.appendChild(tempMount);

                loadContent(skillPath, tempMount, 'skill-silent');

                const triesMax = 30;
                let tries = 0;

                const findAndInsertWeapons = () => {
                    tries++;
                    const wrapper = tempMount.querySelector('.skills-wrapper');
                    if (!wrapper) {
                        if (tries < triesMax) setTimeout(findAndInsertWeapons, 100);
                        else if (tempMount.parentElement) tempMount.parentElement.removeChild(tempMount);
                        return;
                    }

                    try { updateWeaponsTabAvailability(wrapper); } catch (e) {}

                    const allWeapons = Array.from(wrapper.querySelectorAll('.skill-card-row.weapon-row'));
                    const configuredMax = parseInt(pageContainer.dataset.weaponsMax || '3', 10);
                    const maxWeapons = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 3;
                    const selectedWeapons = allWeapons.slice(0, maxWeapons);

                    if (selectedWeapons.length) {
                        const combined = selectedWeapons.map(r => r.outerHTML).join(`\n<div class="skills-divider"></div>\n`);
                        dynamicElArmas.innerHTML = combined;
                        try { initTooltips(); } catch (e) {}
                        dynamicElArmas.classList.add('is-mounted');
                        syncCharacterSkillViewport();
                    } else {
                        dynamicElArmas.innerHTML = '';
                        if (dynamicElArmas.parentElement) {
                            dynamicElArmas.parentElement.removeChild(dynamicElArmas);
                        }
                    }

                    if (tempMount.parentElement) tempMount.parentElement.removeChild(tempMount);
                };

                setTimeout(findAndInsertWeapons, 150);
            }
            else if (tabKey === "ego") {
                clearDynamicCharacterContent({ hideSubmenu: true });

                const skillPath = pageContainer?.dataset.skillPath || '';
                if (!skillPath || !pageContainer) {
                    return;
                }

                if (landingEl) {
                    landingEl.style.display = "none";
                }

                const header = document.querySelector('.chars-page .chars-header');
                const nav = document.querySelector('.chars-page .chars-section-tabs');
                let mount = null;

                if (header && nav) {
                    mount = header.querySelector('.chars-dynamic');
                    if (!mount) {
                        mount = document.createElement('div');
                        mount.className = 'chars-dynamic';
                        nav.insertAdjacentElement('afterend', mount);
                    }

                    try {
                        const gap = 6;
                        mount.style.marginTop = `${gap}px`;
                    } catch (e) {
                        // ignore
                    }
                }

                const dynamicElEgo = mount || getCharacterPageDynamicElement(pageContainer);
                if (!dynamicElEgo) {
                    return;
                }

                dynamicElEgo.classList.remove('is-mounted');
                dynamicElEgo.innerHTML = "";

                const tempMount = document.createElement('div');
                tempMount.style.position = 'absolute';
                tempMount.style.left = '-9999px';
                tempMount.style.width = '1px';
                tempMount.style.height = '1px';
                tempMount.style.overflow = 'hidden';
                document.body.appendChild(tempMount);

                loadContent(skillPath, tempMount, 'skill-silent');

                const triesMax = 30;
                let tries = 0;

                const findAndInsertEgo = () => {
                    tries++;
                    const wrapper = tempMount.querySelector('.skills-wrapper');
                    if (!wrapper) {
                        if (tries < triesMax) setTimeout(findAndInsertEgo, 100);
                        else if (tempMount.parentElement) tempMount.parentElement.removeChild(tempMount);
                        return;
                    }

                    try { updateEgoTabAvailability(wrapper); } catch (e) {}

                    const allEgo = Array.from(wrapper.querySelectorAll('.skill-card-row.ego-row'));
                    const egoPassives = Array.from(wrapper.querySelectorAll('.skills-ego-passives-section .skill-card-row.passive-row'));
                    const configuredMax = parseInt(pageContainer.dataset.egoMax || '3', 10);
                    const maxEgo = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 3;
                    const selectedEgo = allEgo.slice(0, maxEgo);

                    const combinedParts = [];

                    if (selectedEgo.length) {
                        combinedParts.push(selectedEgo.map(r => r.outerHTML).join(`\n<div class="skills-divider"></div>\n`));
                    }

                    if (egoPassives.length) {
                        if (selectedEgo.length) {
                            combinedParts.push(`<div class="skills-divider"></div>`);
                        }

                        combinedParts.push(egoPassives.map(r => r.outerHTML).join(`\n<div class="skills-divider"></div>\n`));
                    }

                    if (combinedParts.length) {
                        const combined = combinedParts.join('\n');
                        dynamicElEgo.innerHTML = combined;
                        try { initTooltips(); } catch (e) {}
                        dynamicElEgo.classList.add('is-mounted');
                        syncCharacterSkillViewport();
                    } else {
                        dynamicElEgo.innerHTML = '';
                        if (dynamicElEgo.parentElement) {
                            dynamicElEgo.parentElement.removeChild(dynamicElEgo);
                        }
                    }

                    if (tempMount.parentElement) tempMount.parentElement.removeChild(tempMount);
                };

                setTimeout(findAndInsertEgo, 150);
            }
            else if (tabKey === "sanity") {
                clearDynamicCharacterContent({ hideSubmenu: true });

                const skillPath = pageContainer?.dataset.skillPath || '';
                if (!skillPath || !pageContainer) {
                    return;
                }

                if (landingEl) {
                    landingEl.style.display = "none";
                }

                const header = document.querySelector('.chars-page .chars-header');
                const nav = document.querySelector('.chars-page .chars-section-tabs');
                let mount = header?.querySelector('.chars-dynamic');

                if (header && nav && !mount) {
                    mount = document.createElement('div');
                    mount.className = 'chars-dynamic';
                    nav.insertAdjacentElement('afterend', mount);
                }

                const dynamicElSanity = mount || getCharacterPageDynamicElement(pageContainer);
                if (!dynamicElSanity) {
                    return;
                }

                dynamicElSanity.classList.remove('is-mounted');
                dynamicElSanity.innerHTML = "";

                const tempMount = document.createElement('div');
                tempMount.style.position = 'absolute';
                tempMount.style.left = '-9999px';
                tempMount.style.width = '1px';
                tempMount.style.height = '1px';
                tempMount.style.overflow = 'hidden';
                document.body.appendChild(tempMount);

                loadContent(skillPath, tempMount, 'skill-silent');

                const findAndInsertSanity = () => {
                    const wrapper = tempMount.querySelector('.skills-wrapper');
                    if (!wrapper) {
                        if (tempMount.parentElement) tempMount.parentElement.removeChild(tempMount);
                        return;
                    }

                    try { updateSanityTabAvailability(wrapper); } catch (e) {}

                    const sanity = wrapper.querySelector('.skills-sanity-section');
                    if (sanity) {
                        dynamicElSanity.innerHTML = sanity.outerHTML;
                        dynamicElSanity.classList.add('is-mounted');
                        syncCharacterSkillViewport();
                    }

                    if (tempMount.parentElement) tempMount.parentElement.removeChild(tempMount);
                };

                setTimeout(findAndInsertSanity, 150);
            }
            else {
                // Para outras abas, limpar conteúdo dinâmico
                if (dynamicEl && landingEl) {
                    dynamicEl.innerHTML = "";
                    landingEl.style.display = "none";
                }
                    // Também remova quaisquer skills renderizados diretamente no header (abaixo das tabs)
                    try {
                        const header = document.querySelector('.chars-page .chars-header');
                        const headerDynamic = header ? header.querySelector('.chars-dynamic') : null;
                        if (headerDynamic) headerDynamic.innerHTML = "";
                    }
                    catch (e) {
                        // ignore
                    }
            }
        });
    });
}

// Initialize skill submenu buttons to load specific skill sections
function initSkillSubmenu() {
    const buttons = document.querySelectorAll('.chars-page .chars-section-tabs .chars-skill-option');
    if (!buttons.length) return;

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Prevent click if button is disabled
            if (btn.classList.contains('disabled') || btn.hasAttribute('disabled')) {
                return;
            }

            // Visual active state will be set only after confirming content exists

            // Ensure the 'Skills' section tab is active and hide the overview/status strip
            try {
                const sectionTabs = document.querySelectorAll('.chars-page .chars-section-tab');
                if (sectionTabs.length) {
                    sectionTabs.forEach(t => {
                        if (t.textContent && t.textContent.trim() === 'Skills') t.classList.add('active');
                        else t.classList.remove('active');
                    });
                }

                const overviewEl = document.querySelector('.chars-page .chars-overview-strip');
                if (overviewEl) overviewEl.classList.remove('is-visible');
            }
            catch (e) {
                // ignore
            }

            const type = btn.getAttribute('data-skill-type') || 'skill';
            const index = parseInt(btn.getAttribute('data-skill-index'));

            const pageContainer = document.querySelector('.page_container');
            const skillPath = pageContainer?.dataset.skillPath || '';

            if (!skillPath || !pageContainer) return;

            // Ensure there is a `.chars-dynamic` container immediately after the nav inside the header
            const header = document.querySelector('.chars-page .chars-header');
            const nav = document.querySelector('.chars-page .chars-section-tabs');
            let mount = null;

            if (header && nav) {
                mount = header.querySelector('.chars-dynamic');
                if (!mount) {
                    // Clear any leftover dynamic content before creating a new mount
                    // but keep the submenu visible while selecting skills
                    clearDynamicCharacterContent({ hideSubmenu: false });
                    mount = document.createElement('div');
                    mount.className = 'chars-dynamic';
                    // insert after nav but ensure header absolute positioning will place the mount to the right
                    nav.insertAdjacentElement('afterend', mount);
                    // position mount below the tabs + submenu by computing their heights
                    try {
                        const submenuEl = document.querySelector('.chars-page .chars-skills-submenu');
                        const submenuHeight = submenuEl ? (submenuEl.getBoundingClientRect().height || submenuEl.offsetHeight) : 0;
                        const navHeight = nav ? (nav.getBoundingClientRect().height || nav.offsetHeight) : 0;
                        const base = submenuHeight || navHeight;
                        const gap = 6; // small gap between submenu and mount
                        mount.style.marginTop = `${base + gap}px`;
                    } catch (e) {
                        // ignore
                    }
                }
            }

            const dynamicEl = mount || getCharacterPageDynamicElement(pageContainer);

            if (!dynamicEl) return;

            // Clear any previously rendered skills in this mount before loading a new one
            dynamicEl.classList.remove('is-mounted');
            dynamicEl.innerHTML = "";

            // Load the skill HTML into a hidden temporary container to avoid flashing
            const tempMount = document.createElement('div');
            tempMount.style.position = 'absolute';
            tempMount.style.left = '-9999px';
            tempMount.style.width = '1px';
            tempMount.style.height = '1px';
            tempMount.style.overflow = 'hidden';
            document.body.appendChild(tempMount);

            loadContent(skillPath, tempMount, 'skill-silent');

            const triesMax = 30;
            let tries = 0;

            const findAndInsert = () => {
                tries++;
                const wrapper = tempMount.querySelector('.skills-wrapper');
                if (!wrapper) {
                    if (tries < triesMax) setTimeout(findAndInsert, 100);
                    else if (tempMount.parentElement) tempMount.parentElement.removeChild(tempMount);
                    return;
                }

                // Update submenu buttons availability based on the hidden parsed wrapper
                try { updateSkillSubmenuAvailability(wrapper); } catch (e) {}

                // Determine target row(s) inside the hidden wrapper
                let target = null;
                    if (type === 'skill' && !isNaN(index)) {
                    const skillRows = Array.from(wrapper.querySelectorAll('.skill-card-row')).filter(r => !r.classList.contains('defense-row') && !r.classList.contains('passive-row') && !r.classList.contains('weapon-row') && !r.classList.contains('ego-row'));
                    const desiredMp = (typeof index === 'number' && !isNaN(index)) ? String(index + 1) : null;

                    if (desiredMp) {
                        // Only render if there are skills with matching MP
                        const matching = skillRows.filter(r => {
                            const mp = (r.getAttribute('data-mp') || '').trim();
                            return mp && mp === desiredMp;
                        });

                        if (matching.length) {
                            // show all skills that have this MP
                            const combined = matching.map(r => r.outerHTML).join(`\n<div class="skills-divider"></div>\n`);
                            target = { outerHTML: combined };
                        } else {
                            // no skills with desired MP -> render nothing
                            target = null;
                        }
                    } else {
                        target = null;
                    }
                }
                else if (type === 'defense') {
                    // collect all defense rows and join them with dividers for submenu view
                    const defRows = Array.from(wrapper.querySelectorAll('.skill-card-row.defense-row'));
                    if (defRows.length > 1) {
                        const combined = defRows.map(r => r.outerHTML).join(`\n<div class="skills-divider"></div>\n`);
                        target = { outerHTML: combined };
                    } else if (defRows.length === 1) {
                        target = defRows[0];
                    } else {
                        target = wrapper.querySelector('.skills-defense-section') || null;
                    }
                }
                else if (type === 'passives') {
                    // collect all passive rows and join them with dividers for submenu view
                    const pRows = Array.from(wrapper.querySelectorAll('.skills-passives-section:not(.skills-ego-passives-section) .skill-card-row.passive-row'));
                    if (pRows.length > 1) {
                        const combined = pRows.map(r => r.outerHTML).join(`\n<div class="skills-divider"></div>\n`);
                        target = { outerHTML: combined };
                    } else if (pRows.length === 1) {
                        target = pRows[0];
                    } else {
                        target = wrapper.querySelector('.skills-passives-section:not(.skills-ego-passives-section)') || null;
                    }
                }

                if (target) {

                    try {
                        const selectedHtml = target.outerHTML;
                        dynamicEl.innerHTML = selectedHtml;
                    } catch (e) {
                        dynamicEl.innerHTML = wrapper.outerHTML;
                    }

                    // Now that content was inserted, mark the clicked submenu button active
                    try {
                        buttons.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    } catch (e) {}

                    // ensure dynamic mount is offset below tabs/submenu (recompute in case sizes changed)
                    try {
                        const navEl = document.querySelector('.chars-page .chars-section-tabs');
                        const submenuEl = document.querySelector('.chars-page .chars-skills-submenu');
                        const submenuHeight = submenuEl ? (submenuEl.getBoundingClientRect().height || submenuEl.offsetHeight) : 0;
                        const navHeight = navEl ? (navEl.getBoundingClientRect().height || navEl.offsetHeight) : 0;
                        const base = submenuHeight || navHeight;
                        const gap = 6;
                        dynamicEl.style.marginTop = `${base + gap}px`;
                    } catch (e) {
                        // ignore
                    }

                    try { initTooltips(); } catch (e) {}

                    dynamicEl.classList.add('is-mounted');

                    // Ensure the mount is scrolled to top before showing the new content
                    try {
                        dynamicEl.scrollTop = 0;
                    } catch (e) {}

                    syncCharacterSkillViewport();

                    if (tempMount.parentElement) tempMount.parentElement.removeChild(tempMount);

                    // Only reset the internal panel scroll. Calling
                    // `scrollIntoView()` here also scrolls the document and
                    // made the whole viewport jump when switching sections.
                    dynamicEl.scrollTop = 0;
                } else if (tries < triesMax) {
                    setTimeout(findAndInsert, 100);
                } else {
                    // No target found - remove the chars-dynamic mount if it exists and is empty
                    try {
                        if (dynamicEl && !dynamicEl.innerHTML.trim()) {
                            if (dynamicEl.parentElement) {
                                dynamicEl.parentElement.removeChild(dynamicEl);
                            }
                        }
                    } catch (e) {
                        // ignore
                    }

                    if (tempMount.parentElement) tempMount.parentElement.removeChild(tempMount);
                }
            };

            setTimeout(findAndInsert, 150);
        });
    });
}

// Enable/disable skill submenu buttons based on presence of content in a given skills wrapper.
function updateSkillSubmenuAvailability(wrapper = null) {
    const submenu = document.querySelector('.chars-page .chars-skills-submenu');
    if (!submenu) return;

    const buttons = Array.from(submenu.querySelectorAll('.chars-skill-option'));

    const searchRoot = wrapper || getCharacterPageDynamicElement() || document;

    let hasAnyEnabled = false;

    buttons.forEach(btn => {
        const type = (btn.getAttribute('data-skill-type') || 'skill').toLowerCase();

        let enabled = false;

        if (type === 'skill') {
            const idx = parseInt(btn.getAttribute('data-skill-index'));
            const desiredMp = !isNaN(idx) ? String(idx + 1) : null;
                if (desiredMp) {
                // Ensure we only consider true skill rows (exclude weapons, ego, defenses and passives)
                enabled = Boolean(searchRoot.querySelector(`.skill-card-row[data-mp="${desiredMp}"]:not(.weapon-row):not(.ego-row):not(.defense-row):not(.passive-row)`));
            }
        } else if (type === 'passives') {
            enabled = Boolean(searchRoot.querySelector('.skills-passives-section:not(.skills-ego-passives-section) .skill-card-row.passive-row'));
        } else if (type === 'defense') {
            enabled = Boolean(searchRoot.querySelector('.skill-card-row.defense-row'));
        }

        if (enabled) {
            btn.hidden = false;
            btn.classList.remove('disabled');
            btn.removeAttribute('disabled');
            hasAnyEnabled = true;
        } else {
            btn.hidden = true;
            btn.classList.add('disabled');
            try { btn.setAttribute('disabled', 'true'); } catch (e) {}
        }
    });

    submenu.hidden = !hasAnyEnabled;

    // If no submenu button is currently active, select the first enabled one by default
    try {
        const enabledButtons = buttons.filter(b => !b.classList.contains('disabled'));
        const anyActive = buttons.some(b => b.classList.contains('active'));
        if (!anyActive && enabledButtons.length > 0) {
            buttons.forEach(b => b.classList.remove('active'));
            enabledButtons[0].classList.add('active');
        }
    } catch (e) {
        // ignore
    }

    // Disable/enable the main "Skills" tab button based on whether any kit content exists
    setCharacterSectionVisibility('skills', hasAnyEnabled);
    syncVisibleCharacterSectionTab();
}

function updateWeaponsTabAvailability(wrapper = null) {
    const sectionTabs = document.querySelectorAll('.chars-page .chars-section-tab');
    if (!sectionTabs.length) return;

    const searchRoot = wrapper || getCharacterPageDynamicElement() || document;

    const hasWeapons = Boolean(searchRoot.querySelector('.skill-card-row.weapon-row'));

    setCharacterSectionVisibility('armas', hasWeapons);
    syncVisibleCharacterSectionTab();
}

function updateEgoTabAvailability(wrapper = null) {
    const sectionTabs = document.querySelectorAll('.chars-page .chars-section-tab');
    if (!sectionTabs.length) return;

    const searchRoot = wrapper || getCharacterPageDynamicElement() || document;

    const hasEgo = Boolean(searchRoot.querySelector('.skill-card-row.ego-row, .skills-ego-passives-section .skill-card-row.passive-row'));

    setCharacterSectionVisibility('ego', hasEgo);
    syncVisibleCharacterSectionTab();
}

function updateSanityTabAvailability(wrapper = null) {
    const searchRoot = wrapper || getCharacterPageDynamicElement() || document;
    const hasSanity = Boolean(searchRoot.querySelector('.skills-sanity-section'));

    setCharacterSectionVisibility('sanity', hasSanity);
    syncVisibleCharacterSectionTab();
}

// =========================
// TOOLTIP SYSTEM
// =========================

let tooltipData = {};
let tooltipLookup = {};

const SCRIPT_BASE_URL = new URL(
    window.__moonAppBaseUrl ? "src/scripts/" : ".",
    window.__moonAppBaseUrl || document.currentScript?.src || window.location.href
);

function resolveScriptAssetPath(path) {
    return new URL(path, SCRIPT_BASE_URL).href;
}

const INFO_TOOLTIP_PATH = resolveScriptAssetPath("../../bd/info.json");
const EFFECT_TOOLTIP_PATH = resolveScriptAssetPath("../../bd/effects.json");

let effectData = {};
let effectLookup = {};

function normalizeLookupKey(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function buildLookupTable(source = {}) {
    const table = {};

    Object.entries(source).forEach(([key, value]) => {
        table[key] = value;

        const normalizedKey = normalizeLookupKey(key);

        if (normalizedKey) {
            table[normalizedKey] = value;
        }
    });

    return table;
}

const TOOLTIP_TYPE_COLORS = 
{
    negative: "#ff0000",
    positive: "#5793e2",
    alert: "#d7d713",
    neutral: "#ffffff",
    condition: "#2f7d44",
    panic_type: "#ff69b4"
};

function resolveTooltipEntry(key) {

    const normalizedKey = normalizeLookupKey(key);
    const entry = tooltipData[key] || tooltipLookup[normalizedKey];

    if (typeof entry === "string") {
        return {
            text: entry,
            type: "neutral"
        };
    }

    if (entry && typeof entry === "object") {
        return {
            text: entry.desc || "Texto não encontrado",
            type: entry.type || "neutral"
        };
    }

    return {
        text: "Texto não encontrado",
        type: "neutral"
    };
}

function formatTooltipMarkupText(text) {
    let formattedText = String(text || "");
    formattedText = formattedText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\\n/g, "<br>")
        .replace(
            /c\((#[0-9a-fA-F]{3,8})\)\{([\s\S]+?)\}/g,
            '<span style="color:$1;">$2</span>'
        )
        .replace(/_\*\*\*~([\s\S]+?)~\*\*\*_/g, '<u><b><i>$1</i></b></u>')
        .replace(/\*\*\*~([\s\S]+?)~\*\*\*/g, '<b><i>$1</i></b>')
        .replace(/_\*\*([\s\S]+?)\*\*_/g, '<u><b>$1</b></u>')
        .replace(/\*\*_([\s\S]+?)_\*\*/g, '<b><u>$1</u></b>')
        .replace(/_~([\s\S]+?)~_/g, '<u><i>$1</i></u>')
        .replace(/~_([\s\S]+?)_~/g, '<i><u>$1</u></i>')
        .replace(/_([\s\S]+?)_/g, '<u>$1</u>')
        .replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>')
        .replace(/~([\s\S]+?)~/g, '<i>$1</i>');

    return formattedText;
}

function getTooltipTextColor(type) {

    return TOOLTIP_TYPE_COLORS[type] || TOOLTIP_TYPE_COLORS.neutral;
}

function getEffectTextColor(effectKey) {

    const normalizedKey = normalizeLookupKey(effectKey);
    const entry = effectData[effectKey] || effectLookup[normalizedKey];

    if (!entry || typeof entry !== "object") {
        return TOOLTIP_TYPE_COLORS.neutral;
    }

    return getTooltipTextColor(entry.type);
}

async function loadTooltipJson(path) {

    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Falha ao carregar ${path}: ${response.status}`);
    }

    return response.json();
}

async function loadTooltips() {

    try {

        const [infoResult, effectsResult] =
            await Promise.allSettled([
                loadTooltipJson(INFO_TOOLTIP_PATH),
                loadTooltipJson(EFFECT_TOOLTIP_PATH)
            ]);

        const infoData =
            infoResult.status === "fulfilled"
                ? infoResult.value
                : {};

        const effectsData =
            effectsResult.status === "fulfilled"
                ? effectsResult.value
                : {};

        effectData = effectsData;
        effectLookup = buildLookupTable(effectsData);

        tooltipData = {
            ...infoData,
            ...effectsData
        };
        tooltipLookup = buildLookupTable(tooltipData);
    }
    catch (err) {

        console.error(
            "Erro ao carregar tooltips:",
            err
        );
    }
}

const tooltip = document.createElement("div");
let tooltipsInitialised = false;

tooltip.classList.add("tooltip-box");

tooltip.addEventListener("pointermove", (event) => {
    const scrollArea = tooltip.querySelector(".tooltip-scroll");
    if (!scrollArea) return;

    const scrollbarWidth = scrollArea.offsetWidth - scrollArea.clientWidth;
    const bounds = scrollArea.getBoundingClientRect();
    const isOverScrollbar = scrollbarWidth > 0 && event.clientX >= bounds.right - scrollbarWidth;

    scrollArea.classList.toggle("is-scrollbar-hovered", isOverScrollbar);
}, { passive: true });

tooltip.addEventListener("pointerleave", () => {
    tooltip.querySelector(".tooltip-scroll")?.classList.remove("is-scrollbar-hovered");
});

document.body.appendChild(tooltip);

function initTooltips() {

    // The listeners are delegated from document, so registering them again for
    // every markdown refresh duplicates tooltip state and leaves stale popups.
    if (tooltipsInitialised) {
        // Skills may have just inserted new effect-icon placeholders. The
        // delegated listeners already exist, but these new images still need
        // their asset paths resolved.
        resolveEffectImages().catch(() => {});
        return;
    }
    tooltipsInitialised = true;

    let activeTooltipTarget = null;
    let isTooltipPinned = false;
    let lastPointerX = null;
    let lastPointerY = null;
    let tooltipScrollFrame = 0;
    let tooltipScrollTarget = 0;
    let tooltipScrollElement = null;

    const scrollTooltip = (scrollArea, delta, deltaMode = 0) => {
        if (tooltipScrollElement !== scrollArea && tooltipScrollFrame) {
            cancelAnimationFrame(tooltipScrollFrame);
            tooltipScrollFrame = 0;
        }

        tooltipScrollElement = scrollArea;
        const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
        const normalizedDelta = delta * (
            deltaMode === 1
                ? 16
                : deltaMode === 2
                    ? scrollArea.clientHeight
                    : 1
        ) * 0.75;
        const currentTarget = tooltipScrollFrame
            ? tooltipScrollTarget
            : scrollArea.scrollTop;
        tooltipScrollTarget = Math.max(0, Math.min(currentTarget + normalizedDelta, maxScroll));

        if (tooltipScrollFrame) {
            return;
        }

        const animateScroll = () => {
            const distance = tooltipScrollTarget - scrollArea.scrollTop;

            if (Math.abs(distance) < 0.5) {
                scrollArea.scrollTop = tooltipScrollTarget;
                tooltipScrollFrame = 0;
                return;
            }

            scrollArea.scrollTop += distance * 0.78;
            tooltipScrollFrame = requestAnimationFrame(animateScroll);
        };

        tooltipScrollFrame = requestAnimationFrame(animateScroll);
    };

    tooltip.addEventListener("wheel", (event) => {
        const scrollArea = tooltip.querySelector(".tooltip-scroll");
        if (!scrollArea || scrollArea.scrollHeight <= scrollArea.clientHeight) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        scrollTooltip(scrollArea, event.deltaY, event.deltaMode);
    }, { passive: false });

    const isTooltipVisible =
        () => tooltip.classList.contains("is-visible");

    const rememberPointerPosition = (event) => {
        if (!Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) {
            return;
        }

        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
    };

    const positionTooltip = () => {
        if (lastPointerX === null || lastPointerY === null) {
            return;
        }

        const padding = 12;
        const offset = 20;
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;

        let x = lastPointerX + offset;
        let y = lastPointerY + offset;

        if (x + tooltipWidth > window.innerWidth - padding) {
            x = lastPointerX - tooltipWidth - offset;
        }

        if (y + tooltipHeight > window.innerHeight - padding) {
            y = lastPointerY - tooltipHeight - offset;
        }

        x = Math.max(padding, Math.min(x, window.innerWidth - tooltipWidth - padding));
        y = Math.max(padding, Math.min(y, window.innerHeight - tooltipHeight - padding));

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    };

    const formatTooltipMarkup = formatTooltipMarkupText;

    const buildEffectTooltipHeader = (target) => {
        const effectIcon = target.querySelector("img.effect-icon[data-effect-asset-name]");

        // An effect title is shown only after its icon has resolved successfully.
        // Missing assets are removed by resolveEffectImages(), so ordinary and
        // iconless tooltips keep their text-only layout.
        if (!effectIcon || !effectIcon.complete || effectIcon.naturalWidth < 1) {
            return "";
        }

        const imageSource = effectIcon.getAttribute("src");
        if (!imageSource) {
            return "";
        }

        let effectName = "";
        try {
            effectName = decodeURIComponent(effectIcon.dataset.effectAssetName || "");
        }
        catch (error) {
            effectName = effectIcon.dataset.effectAssetName || "";
        }

        effectName = effectName.replace(/_/g, " ").trim();
        if (!effectName.length) {
            return "";
        }

        return `
            <div class="tooltip-effect-header">
                <img class="tooltip-effect-icon" src="${escapeHtml(imageSource)}" alt="">
                <strong>${escapeHtml(effectName)}</strong>
            </div>
        `;
    };

    const showTooltip = (target, tooltipEntry, pointerEvent) => {

        const previousScrollArea = tooltip.querySelector(".tooltip-scroll");
        const shouldPreserveScroll = activeTooltipTarget === target && previousScrollArea;
        const previousScrollTop = shouldPreserveScroll ? previousScrollArea.scrollTop : 0;

        rememberPointerPosition(pointerEvent);
        activeTooltipTarget = target;

        const customTooltipText = target.getAttribute("data_tooltip_text");
        const formattedText = formatTooltipMarkup(
            customTooltipText === null ? tooltipEntry.text : customTooltipText
        );

        tooltip.innerHTML = `<div class="tooltip-scroll">${buildEffectTooltipHeader(target)}<div class="tooltip-content">${formattedText}</div></div>`;

        const scrollArea = tooltip.querySelector(".tooltip-scroll");
        if (scrollArea) {
            scrollArea.scrollTop = shouldPreserveScroll
                ? Math.min(previousScrollTop, scrollArea.scrollHeight - scrollArea.clientHeight)
                : 0;
        }

        tooltip.classList.toggle("is-pinned", isTooltipPinned);
        tooltip.classList.add("is-visible");
        requestAnimationFrame(positionTooltip);
    };

    const hideTooltip = () => {

        activeTooltipTarget = null;
        isTooltipPinned = false;

        tooltip.classList.remove("is-visible", "is-pinned");
        tooltip.replaceChildren();
        tooltip.style.removeProperty("left");
        tooltip.style.removeProperty("top");
    };

    // The SPA calls this when it returns to the home screen, where pages.css
    // is intentionally disabled. Without it, a previously visible tooltip is
    // rendered as unstyled text over the menu.
    window.hideMoonTooltip = hideTooltip;

    tooltip.addEventListener("mouseenter", () => {
        tooltip.classList.add("is-visible");
    });

    document.addEventListener("wheel", (event) => {
        if (!activeTooltipTarget || !isTooltipVisible()) {
            return;
        }

        if (isTooltipPinned && !tooltip.contains(event.target)) {
            hideTooltip();
            return;
        }

        const scrollArea = tooltip.querySelector(".tooltip-scroll");
        if (
            tooltip.contains(event.target) ||
            !scrollArea ||
            scrollArea.scrollHeight <= scrollArea.clientHeight
        ) {
            return;
        }

        event.preventDefault();
        scrollTooltip(scrollArea, event.deltaY, event.deltaMode);
    }, { passive: false });

    document.addEventListener("click", (event) => {
        const target = event.target.closest("[data_tooltip]");

        if (target) {
            event.preventDefault();

            if (target === activeTooltipTarget && isTooltipVisible()) {
                isTooltipPinned = true;
                tooltip.classList.add("is-pinned");
                return;
            }

            isTooltipPinned = true;
            showTooltip(target, resolveTooltipEntry(target.getAttribute("data_tooltip")), event);
            return;
        }

        if (isTooltipPinned && !tooltip.contains(event.target)) {
            hideTooltip();
        }
    });

    document.addEventListener("mouseover", (e) => {

        const target =
            e.target.closest("[data_tooltip]");

        if (!target) return;

        if (isTooltipPinned) {
            return;
        }

        const key =
            target.getAttribute("data_tooltip");

        showTooltip(
            target,
            resolveTooltipEntry(key),
            e
        );
    });

    document.addEventListener("mousemove", (e) => {

        rememberPointerPosition(e);

        const target =
            e.target.closest("[data_tooltip]");

        if (!target && !tooltip.contains(e.target))
            return;

        if (tooltip.contains(e.target))
            return;

        if (isTooltipPinned)
            return;

        positionTooltip();
    });

    document.addEventListener("scroll", (event) => {
        if (tooltip.contains(event.target)) {
            return;
        }

        if (activeTooltipTarget && isTooltipVisible()) {
            positionTooltip();
        }
    }, true);

    document.addEventListener("mouseout", (e) => {

        if (isTooltipPinned) {
            return;
        }

        const from =
            e.target.closest("[data_tooltip]");

        const to = e.relatedTarget;

        if (
            from &&
            (
                to?.closest("[data_tooltip]") ||
                tooltip.contains(to)
            )
        ) {
            return;
        }

        if (from) {
            hideTooltip();
        }
    });

    resolveEffectImages().catch(() => {});

}

function formatPrintTooltipMarkup(text) {
    return formatTooltipMarkupText(text);
}

let kitExportDialog = null;
let kitExportConfirmButton = null;
let kitExportCancelButton = null;
let kitExportStatus = null;
let pendingKitExportTarget = null;
const kitExportDialogsWithListeners = new WeakSet();

function setKitExportStatus(message, isError = false) {
    if (!kitExportStatus) return;
    kitExportStatus.textContent = message;
    kitExportStatus.hidden = !message;
    kitExportStatus.classList.toggle("is-error", isError);
}

function initializeKitExportDialog() {
    let dialog = document.querySelector(".kit-export-dialog");
    if (!dialog) {
        dialog = document.createElement("dialog");
        dialog.className = "kit-export-dialog";
        dialog.setAttribute("aria-labelledby", "kit-export-title");
        dialog.setAttribute("aria-describedby", "kit-export-description");
        dialog.innerHTML = `
            <div class="kit-export-dialog-content">
                <h2 id="kit-export-title">Imprimir Kit em PDF</h2>
                <p id="kit-export-description">A janela de impressão será aberta. Escolha "Salvar como PDF" para baixar o arquivo.</p>
                <p class="kit-export-status" role="status" aria-live="polite" hidden></p>
                <div class="kit-export-actions">
                    <button type="button" class="kit-export-cancel">Cancelar</button>
                    <button type="button" class="kit-export-confirm">Imprimir / Salvar PDF</button>
                </div>
            </div>`;
        document.body.appendChild(dialog);
    }

    kitExportDialog = dialog;
    kitExportConfirmButton = dialog.querySelector(".kit-export-confirm");
    kitExportCancelButton = dialog.querySelector(".kit-export-cancel");
    kitExportStatus = dialog.querySelector(".kit-export-status");
    if (!kitExportConfirmButton || !kitExportCancelButton || !kitExportStatus) {
        return false;
    }

    if (!kitExportDialogsWithListeners.has(dialog)) {
        dialog.addEventListener("cancel", event => {
            if (dialog.dataset.busy === "true") {
                event.preventDefault();
                return;
            }
            pendingKitExportTarget = null;
        });

        dialog.addEventListener("click", event => {
            if (event.target === dialog && dialog.dataset.busy !== "true") {
                closeKitExportDialog();
                pendingKitExportTarget = null;
            }
        });

        kitExportCancelButton.addEventListener("click", () => {
            if (dialog.dataset.busy === "true") return;
            closeKitExportDialog();
            pendingKitExportTarget = null;
        });

        kitExportConfirmButton.addEventListener("click", async () => {
            if (!pendingKitExportTarget || dialog.dataset.busy === "true") return;

            const printWindow = window.open("", "_blank");
            if (!printWindow) {
                setKitExportStatus("O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.", true);
                return;
            }
            printWindow.document.open();
            printWindow.document.write("<!doctype html><html lang=\"pt-br\"><head><meta charset=\"utf-8\"><title>Preparando o Kit</title></head><body>Preparando a impressão do Kit...</body></html>");
            printWindow.document.close();

            dialog.dataset.busy = "true";
            kitExportConfirmButton.disabled = true;
            kitExportCancelButton.disabled = true;
            setKitExportStatus("Preparando a impressão do Kit...");

            try {
                await generateCharacterKitPdf(pendingKitExportTarget, printWindow);
                closeKitExportDialog();
                pendingKitExportTarget = null;
            } catch (error) {
                if (!printWindow.closed) printWindow.close();
                setKitExportStatus(error.message || "Não foi possível gerar o PDF do Kit.", true);
            } finally {
                delete dialog.dataset.busy;
                kitExportConfirmButton.disabled = false;
                kitExportCancelButton.disabled = false;
            }
        });

        kitExportDialogsWithListeners.add(dialog);
    }

    return true;
}

function openKitExportDialog(kitElement) {
    if (!initializeKitExportDialog()) {
        console.error("O diálogo de exportação do Kit não está disponível nesta página.");
        return;
    }

    pendingKitExportTarget = kitElement;
    setKitExportStatus("");
    kitExportConfirmButton.disabled = false;
    kitExportCancelButton.disabled = false;
    const characterName = kitElement.querySelector(".chars-kit-character")?.textContent.trim();
    const description = kitExportDialog.querySelector("#kit-export-description");
    if (description && characterName) {
        description.textContent = `A janela de impressão do Kit de ${characterName} será aberta. Escolha "Salvar como PDF" para baixar o arquivo.`;
    }
    if (typeof kitExportDialog.showModal === "function") {
        kitExportDialog.showModal();
    } else {
        kitExportDialog.setAttribute("open", "");
    }
}

function closeKitExportDialog() {
    if (!kitExportDialog) return;
    if (typeof kitExportDialog.close === "function") {
        kitExportDialog.close();
    } else {
        kitExportDialog.removeAttribute("open");
    }
}

function initializeKitExportTriggers() {
    if (document.documentElement.dataset.kitExportHandlers === "true") return;
    document.documentElement.dataset.kitExportHandlers = "true";

    document.addEventListener("click", event => {
        const trigger = event.target instanceof Element
            ? event.target.closest(".chars-kit-name")
            : null;
        if (!trigger) return;

        const kitElement = trigger.closest(".chars-kit");
        if (!kitElement) return;

        event.preventDefault();
        openKitExportDialog(kitElement);
    });
}

async function generateCharacterKitPdf(kitElement, printWindow) {
    const pageContainer = document.querySelector(".chars-page .page_container");
    const skillPath = kitElement?.dataset.skillPath || pageContainer?.dataset.skillPath || "";
    if (!skillPath || !pageContainer) {
        throw new Error("Não foi possível localizar o arquivo de Skills deste personagem.");
    }
    if (!printWindow || printWindow.closed) {
        throw new Error("A janela de impressão foi fechada antes de preparar o Kit.");
    }
    const characterName = String(
        kitElement.querySelector(".chars-kit-character")?.textContent ||
        pageContainer.dataset.characterName ||
        "Personagem"
    ).trim();
    const parseCharacterName = kitElement.dataset.characterName || pageContainer.dataset.characterName || characterName;
    const charFolder = kitElement.dataset.charFolder || pageContainer.dataset.charFolder || "";
    const exportRoot = document.createElement("div");
    exportRoot.className = "chars-page kit-pdf-export";
    exportRoot.dataset.kitPdfExport = "true";

    const page = document.createElement("main");
    page.className = "page_container skills-mode kit-pdf-page";
    const content = document.createElement("div");
    content.className = "chars-dynamic is-mounted";
    const kitHeader = kitElement.cloneNode(true);
    kitHeader.removeAttribute("role");
    kitHeader.removeAttribute("tabindex");
    kitHeader.removeAttribute("aria-label");
    kitHeader.removeAttribute("data-skill-path");
    const skillsSource = document.createElement("div");

    try {
        const response = await fetch(skillPath, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Não foi possível carregar o arquivo .skill (${response.status}).`);
        }

        const source = await response.text();
        skillsSource.innerHTML = resolveAppRootImagePaths(
            parseSkill(
                source,
                skillPath.replace(/\\/g, "/"),
                charFolder,
                parseCharacterName
            )
        );
        const skillsWrapper = skillsSource.querySelector(".skills-wrapper");
        if (!skillsWrapper) {
            throw new Error("O arquivo não contém um Kit para imprimir.");
        }

        await resolveEffectImages(skillsSource);

        content.appendChild(kitHeader);
        const interactiveKitTitle = kitHeader.querySelector(".chars-kit-name");
        if (interactiveKitTitle) {
            const printableKitTitle = document.createElement("div");
            printableKitTitle.className = interactiveKitTitle.className;
            printableKitTitle.textContent = interactiveKitTitle.textContent;
            interactiveKitTitle.replaceWith(printableKitTitle);
        }
        const skillsClone = skillsWrapper.cloneNode(true);
        skillsClone.querySelectorAll(".skill-flavor-label").forEach(flavorLabel => {
            flavorLabel.className = "skill-flavor-label";
            flavorLabel.removeAttribute("style");
        });
        skillsClone.removeAttribute("data-showcase-section");
        skillsClone.removeAttribute("data-showcase-skill-type");
        skillsClone.removeAttribute("data-showcase-skill-index");

        content.appendChild(skillsClone);

        const effectEntries = new Map();
        skillsClone.querySelectorAll(".tooltip-inline[data_tooltip]").forEach(target => {
            let ancestor = target;
            while (ancestor) {
                if (
                    ancestor.hidden
                    || ancestor.getAttribute("aria-hidden") === "true"
                    || ancestor.classList.contains("hidden")
                    || ancestor.classList.contains("is-hidden")
                    || ancestor.style.display === "none"
                ) {
                    return;
                }
                ancestor = ancestor.parentElement;
            }

            const key = target.getAttribute("data_tooltip") || "";
            const normalizedKey = normalizeLookupKey(key);
            const entry = effectData[key] || effectLookup[normalizedKey];
            if (!entry || effectEntries.has(normalizedKey)) return;

            const icon = target.querySelector("img.effect-icon[data-effect-asset-name]");
            let name = "";
            try {
                name = decodeURIComponent(icon?.dataset.effectAssetName || "");
            } catch (error) {
                name = icon?.dataset.effectAssetName || "";
            }
            name = name.replace(/_/g, " ").trim() || target.textContent.trim() || key;
            const description = typeof entry === "string" ? entry : entry.desc || "Texto não encontrado";
            effectEntries.set(normalizedKey, {
                key,
                name,
                description,
                type: typeof entry === "object" ? entry.type || "neutral" : "neutral",
                icon
            });
        });

        const effectsSection = document.createElement("section");
        effectsSection.className = "kit-print-effects";
        const effectsTitle = document.createElement("h2");
        effectsTitle.className = "kit-print-effects-title";
        effectsTitle.textContent = "Efeitos do Kit";
        effectsSection.appendChild(effectsTitle);

        if (!effectEntries.size) {
            const emptyMessage = document.createElement("p");
            emptyMessage.textContent = "Este Kit não possui efeitos com tooltip.";
            effectsSection.appendChild(emptyMessage);
        } else {
            Array.from(effectEntries.values())
                .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
                .forEach((effect, index) => {
                    const tooltipCard = document.createElement("article");
                    tooltipCard.className = "tooltip-box is-visible kit-print-tooltip";
                    if (/hardblood\s*armor/i.test(`${effect.name} ${effect.key}`)) {
                        tooltipCard.classList.add("kit-print-tooltip-hardblood-armor");
                        if (index > 0) {
                            tooltipCard.classList.add("kit-print-tooltip-hardblood-armor-new-page");
                        }
                    }
                    const scrollArea = document.createElement("div");
                    scrollArea.className = "tooltip-scroll";
                    const effectHeader = document.createElement("div");
                    effectHeader.className = "tooltip-effect-header";

                    if (effect.icon) {
                        const icon = document.createElement("img");
                        icon.className = "tooltip-effect-icon";
                        icon.src = effect.icon.currentSrc || effect.icon.src;
                        icon.alt = "";
                        effectHeader.appendChild(icon);
                    }

                    const effectName = document.createElement("strong");
                    effectName.textContent = effect.name;
                    effectHeader.appendChild(effectName);
                    const effectDescription = document.createElement("div");
                    effectDescription.className = "tooltip-content";
                    effectDescription.innerHTML = formatPrintTooltipMarkup(effect.description);
                    scrollArea.append(effectHeader, effectDescription);
                    tooltipCard.appendChild(scrollArea);
                    effectsSection.appendChild(tooltipCard);
                });
        }

        content.appendChild(effectsSection);
        page.appendChild(content);
        exportRoot.appendChild(page);
        const stylesheetUrl = resolveScriptAssetPath("../styles/pages.css");
        const printDocument = printWindow.document;
        const suggestedFilename = `${characterName} - Kit`
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
            .trim() || "Kit";
        printDocument.title = suggestedFilename;
        const printStyles = `
            @page { size: 297mm 210mm; margin: 0; background: #000; }
            html, body {
                width: 297mm !important;
                min-height: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: #000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            body {
                display: block !important;
                background: #000 !important;
            }
            .kit-pdf-export {
                position: static !important;
                display: block !important;
                width: 297mm !important;
                min-width: 297mm !important;
                max-width: 297mm !important;
                min-height: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                pointer-events: auto !important;
                background: #000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                -webkit-box-decoration-break: clone !important;
                box-decoration-break: clone !important;
            }
            .kit-pdf-export .kit-pdf-page {
                width: 297mm !important;
                min-height: 210mm !important;
                background: #000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                -webkit-box-decoration-break: clone !important;
                box-decoration-break: clone !important;
            }
        `;
        exportRoot.style.cssText = [
            "position: static !important",
            "left: auto !important",
            "top: auto !important",
            "display: block !important",
            "width: 297mm !important",
            "min-width: 297mm !important",
            "max-width: 297mm !important",
            "min-height: 210mm !important",
            "margin: 0 !important",
            "padding: 0 !important",
            "overflow: visible !important",
            "pointer-events: auto !important",
            "background: #000 !important",
            "-webkit-print-color-adjust: exact !important",
            "print-color-adjust: exact !important",
            "-webkit-box-decoration-break: clone !important",
            "box-decoration-break: clone !important"
        ].join("; ");

        printDocument.open();
        printDocument.write(`<!doctype html>
            <html lang="pt-br">
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <base href="${escapeHtml(document.baseURI)}">
                    <title>${escapeHtml(suggestedFilename)}</title>
                    <link rel="stylesheet" href="${escapeHtml(stylesheetUrl)}">
                    <style>${printStyles}</style>
                </head>
                <body>${exportRoot.outerHTML}</body>
            </html>`);
        printDocument.close();
        printDocument.title = suggestedFilename;

        const stylesheet = printDocument.querySelector('link[rel="stylesheet"]');
        if (stylesheet && !stylesheet.sheet) {
            await new Promise((resolve, reject) => {
                const timeout = window.setTimeout(
                    () => reject(new Error("Não foi possível carregar os estilos para imprimir o Kit.")),
                    10000
                );
                stylesheet.addEventListener("load", () => {
                    window.clearTimeout(timeout);
                    resolve();
                }, { once: true });
                stylesheet.addEventListener("error", () => {
                    window.clearTimeout(timeout);
                    reject(new Error("Não foi possível carregar os estilos para imprimir o Kit."));
                }, { once: true });
            });
        }

        await Promise.all(Array.from(printDocument.querySelectorAll(".kit-pdf-export img"), image => new Promise(resolve => {
            if (image.complete) {
                if (image.naturalWidth && typeof image.decode === "function") {
                    image.decode().then(resolve, resolve);
                } else {
                    resolve();
                }
                return;
            }

            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
            window.setTimeout(resolve, 8000);
        })));
        if (printDocument.fonts?.ready) {
            await printDocument.fonts.ready;
        }

        await new Promise(resolve => {
            printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(resolve));
        });

        if (printWindow.closed) {
            throw new Error("A janela de impressão foi fechada antes de abrir o diálogo de impressão.");
        }

        printWindow.addEventListener("afterprint", () => {
            if (!printWindow.closed) printWindow.close();
        }, { once: true });
        printWindow.focus();
        printWindow.print();
    } catch (error) {
        console.error("Erro ao preparar a impressão do Kit:", error);
        throw error;
    }
}

// =========================
// SKILL PARSER {skills}
// =========================

function parseSkill(text, sourcePath = "", charFolder = "", characterName = "") {

    const lines = text
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length);

    let html = `<div class="skills-wrapper">`;

    let currentSkill = null;
    let currentWeapon = null;
    let currentEgo = null;
    let currentPassive = null;
    let currentDefense = null;
    let currentCostTarget = null;
    let mode = null;
    let pendingCoinBtw = [];
    let started = false;
    let inPassives = false;
    let inDefense = false;
    let inWeapons = false;
    let inEgo = false;
    let hideEgoSession = false;
    let inSanity = false;
    const skillSections = [];
    const passiveSections = [];
    const egoPassiveSections = [];
    const defenseSections = [];
    const weaponSections = [];
    const egoSections = [];
    const sanitySections = [];
    let skillsCount = 0;
    let showcaseTarget = null;

    const pushCurrentPassive = () => {

        if (!currentPassive) {
            return;
        }

        if (currentPassive._hidden || (currentPassive._target === "ego" && hideEgoSession)) {
            currentPassive = null;
            return;
        }

        const targetSections = currentPassive._target === "ego"
            ? egoPassiveSections
            : passiveSections;

        targetSections.push(currentPassive);
        currentPassive = null;
    };

    const sinMap =
    {
        wrath: "../../res/skills/slots/wrath",
        lust: "../../res/skills/slots/lust",
        sloth: "../../res/skills/slots/sloth",
        gloom: "../../res/skills/slots/gloom",
        pride: "../../res/skills/slots/pride",
        envy: "../../res/skills/slots/envy",
        gluttony: "../../res/skills/slots/gluttony"
    };

    const dmgMap =
    {
        slash: "../../res/skills/slash.png",
        pierce: "../../res/skills/pierce.png",
        blunt: "../../res/skills/blunt.png"
    };

    const defenseIconMap =
    {
        evade: "../../res/skills/evade.png",
        clash: "../../res/skills/clash.png",
        defense: "../../res/skills/defense.png",
        counter: "../../res/skills/counter.png"
    };

    function finalizeCurrentWeapon() {
        if (!currentWeapon) {
            return;
        }

        if (currentWeapon._pendingDmgText) {
            if (currentWeapon._hasExplicitWeaponFields) {
                currentWeapon.dmg = formatSkillText(currentWeapon._pendingDmgText);
            }
            else {
                currentWeapon.dmg_type = currentWeapon._pendingDmgText;
            }
        }

        currentWeapon._pendingDmgText = "";
    }

    const keywordMap =
    {
        "(on_use)": `<color ="#9394e4"><b>[Ao Usar]</b></color>`,
        "(combat_start)": `<color ="#d7d713"><b>[Ínicio do Combate]</b></color>`,

        "(on_evade)": `<color ="#d7d713">[Ao Esquivar]</color>`,
        "(after_defense)": `<color ="#d7d713">[Ao Defender]</color>`,
        
        "(clash_win)": `<color ="#fbb22a">**[Ao Ganhar o Clash]**</color>`,
        "(clash_lose)": `<color ="#ff5757">**[Ao Perder o Clash]**</color>`,

        "(on_hit)": `<color ="#FFFF00">[Em um Acerto]</color>`,
        "(on_hit_without_cracking)": `<color ="#FFFF00">[Em um Acerto - Sem a Moeda Quebrar]</color>`,
        "(heads_hit)": `<color ="#b5b503">[Em um Acerto - Cara]</color>`,
        "(tails_hit)": `<color ="#ad94b2">[Em um Acerto - Coroa]</color>`,

        "(before_attack)": `<color ="#caca6c">**[Antes do Ataque]**</color>`,
        "(on_nohit)": `<color ="#d42727">[Ao Errar]</color>`,
        "(on_crit)": `<color ="#cfcf34">[Em um Crítico]</color>`,
        "(head)": `<color ="#eaea8f">[Ao Acertar Cara]</color>`,
        "(tail)": `<color ="#dcdc07">[Ao Acertar Coroa]</color>`,
        "(on_crit10)": `<color ="#14d758">[Em um Crítico Natural]</color>`,
        "(turn_end)": `<color ="#8f7fb4"><b>[Fim do Turno]</b></color>`,
        "(scene_end)": `<color ="#8f7fb4"><b>[Fim da Cena]</b></color>`,
        "(skill_end)": `<color ="#d2be05"><b>[Fim da Skill]</b></color>`,
        "(attack_end)": `<color ="#fffb08"><b>[Fim do Ataque]</b></color>`,
        "(defense_end)": `<color ="#fffb08"><b>[Fim da Defesa]</b></color>`,

        "(hability)": `<color ="#ffffff"><b>[Habilidade]</b></color>`
    };

    const sinColorMap =
    {
         wrath:    "#FE0000",
         lust:     "#FE4000",
         sloth:    "#FEFE00",
         gloom:    "#00FEFE",
         pride:    "#0040FE",
         envy:     "#FE00FE",
         gluttony: "#40FE00"
    };

    // Extract character name from sourcePath (e.g., "/bd/chars/moon_office/axel.skill" -> "axel")
    const characterMatch = sourcePath.match(/\/bd\/chars\/(?:[^/]+\/)*([^/]+)\.skill$/);
    const character = characterMatch ? characterMatch[1] : null;
    const characterAssetFolder = resolveCharacterFolderName(characterName);

    function formatEffects(text) {

        const iconlessEffects = new Set([
            "Mang (望)",
            "Shin (心) - The White Knight",
            "Unwanted Synergy",
            "Count",
            "Atk_Weight"
        ].map(normalizeLookupKey));

        return text.replace(
                /@\(((?:[^()]|\([^()]*\))*)\)|@\{([^}]+)\}(?:\(([^)]+)\))?|@([A-Za-z0-9_&[\]\-]+)(?:\(([^)]+)\))?/g,

            (
                match,
                wrappedEffect,
                complexEffect,
                complexFolder,
                simpleEffect,
                simpleFolder
            ) => {

                // The parenthesized form preserves names such as
                // "Shin (心) - The White Knight" as one reference.
                const effect =
                    (wrappedEffect || complexEffect || simpleEffect || "")
                        .trim()
                        // Keep effect lookup consistent when a description was
                        // HTML-escaped before reaching this formatter.
                        .replace(/&amp;/gi, "&");

                const folder =
                    (complexFolder || simpleFolder || "").trim();

                const effectAssetAttributes = `data-effect-asset-name="${encodeURIComponent(effect)}" data-effect-asset-folder="${encodeURIComponent(folder)}"`;

                let tooltipKey =
                    normalizeLookupKey(effect);

                if (folder.length) {
                    tooltipKey =
                        `${normalizeLookupKey(folder)}_${tooltipKey}`;
                }

                const effectColor = getEffectTextColor(tooltipKey);
                const effectEntry = effectData[tooltipKey] || effectLookup[tooltipKey] || {};
                const effectDisplay = effect.replace(/_/g, " ");
                const effectName = effectEntry.noUnderline
                    ? `<color="${effectColor}">${effectDisplay}</color>`
                    : `<span style="color:${effectColor}; text-decoration: underline; text-decoration-color: ${effectColor}; text-decoration-thickness: from-font; text-underline-offset: 0.08em; text-decoration-skip-ink: auto;">${effectDisplay}</span>`;

                const effectMarkup = iconlessEffects.has(normalizeLookupKey(effect))
                    ? effectName
                    : `<img class="effect-icon" ${effectAssetAttributes}>${effectName}`;

                return `[${effectMarkup}]{${tooltipKey}}`;
            }
        );
    }

    function formatSkillText(text) {

        let formatted = text;

        // Keep escaped line breaks consistent across every skill field.
        formatted = formatted.replace(/\\n/g, "<br><br>");

        formatted = formatted.replace(
            /atkw\((\d+)\)/gi,
            (match, value) => {
                const count = Math.max(0, Number.parseInt(  value, 10) || 0);

                if (!count) {
                    return match;
                }

                return `<span class="skill-atkw">${"⯀|" + "⯀".repeat(count - 1)}</span>`;
            }
        );

        Object.keys(keywordMap).forEach(key => {
            formatted = formatted.replace(
                key,
                keywordMap[key]
            );
        });

        formatted = formatSkillInlineStyles(formatted);
        formatted = formatEffects(formatted);
        formatted = parseCustomTooltips(formatted);

        return formatted;
    }

    function resolveSkillIconPath(imageName) {

    if (!imageName) {
        return "";
    }

    const normalizedImage =
        String(imageName)
            .trim()
            .replace(/^\/+/, "");

    const hasExtension =
        /\.[^./\\]+$/.test(normalizedImage);

    const finalFile =
        hasExtension
            ? normalizedImage
            : `${normalizedImage}.png`;

    // Prioriza:
    // bd/chars/<grupo>/<personagem>/<imagem>
    if (charFolder && characterAssetFolder) {

        return `../../bd/chars/${charFolder}/${characterAssetFolder}/${finalFile}`;
    }

    // Fallback:
    // bd/chars/<personagem>/<imagem>
    if (character) {

        return `../../bd/chars/${character}/${finalFile}`;
    }

    // Último fallback
    return `../../bd/chars/${finalFile}`;
}
    function resolveWeaponIconPath(imageName) {

        const normalized = String(imageName || "").trim();

        if (!normalized) {
            return "";
        }

        const hasExtension = /\.[^./\\]+$/.test(normalized);
        const candidate = hasExtension ? normalized : `${normalized}.png`;

        if (normalized.includes("/") || normalized.includes("\\")) {
            return `../../bd/chars/${candidate}`;
        }

        if (charFolder && characterAssetFolder) {
            return `../../bd/chars/${charFolder}/${characterAssetFolder}/${candidate}`;
        }

        if (charFolder) {
            return `../../bd/chars/${charFolder}/${candidate}`;
        }

        if (characterName) {
            return `../../bd/chars/${characterName}/${candidate}`;
        }

        if (character) {
            return `../../bd/chars/${character}/${candidate}`;
        }

        return `../../bd/chars/${candidate}`;
    }

    function resolveSkillCenterIconPath(entity, fallbackSin = "") {

        const customImage = String(entity?.img || "").trim();

        if (customImage) {
            return resolveSkillIconPath(customImage);
        }

        const normalizedSin = String(fallbackSin || entity?.sin || "").trim().toLowerCase();

        if (!normalizedSin || normalizedSin === "sinless") {
            return "";
        }

        return `../../res/skills/sins/${normalizedSin}.png`;
    }

    function resolveDefenseCenterIconPath(def) {

        const customImage = String(def?.img || def?.c_img || "").trim();

        if (!customImage) return "";

        const builtInIcon = customImage
            .replace(/^.*[\\/]/, "")
            .replace(/\.png$/i, "")
            .toLowerCase();

        if (["d_defense", "d_counter"].includes(builtInIcon)) {
            const iconName = builtInIcon === "d_counter" ? "counter" : "defense";
            return `../../res/skills/${iconName}.png`;
        }

        return resolveSkillIconPath(customImage);
    }

    function resolveDefenseTypeIconPath(type) {

        switch (String(type || "").trim().toLowerCase()) {
            case "evade":
            case "evader":
                return "../../res/skills/evade.png";
            case "clash":
            case "counter":
                return "../../res/skills/counter.png";
            case "defense":
            case "guard":
                return "../../res/skills/defense.png";
            default:
                return "";
        }
    }

    function resolveEgoRiskIconPath(level) {

        const normalized = String(level || "").trim().toLowerCase();
        const allowedLevels = ["zayin", "teth", "he", "waw", "aleph", "unknow", "undef"];

        if (!allowedLevels.includes(normalized)) {
            return "";
        }

        return `../../res/skills/risk/${normalized}.png`;
    }

    function resolveEgoCostIconPath(sin) {

        const normalized = String(sin || "").trim().toLowerCase();

        if (!normalized) {
            return "";
        }

        return `../../res/skills/sins/${normalized}.png`;
    }

    function buildResourceCostItem(cost) {

        const resource = String(cost?.sin || "").trim().toLowerCase();
        const value = escapeHtml(cost?.value || "");

        if (!resource || !value.length) {
            return "";
        }

        if (resource === "sp") {
            return `
                <div class="skill-ego-cost-item skill-sp-cost-item">
                    <span>SP ${value}</span>
                </div>
            `;
        }

        // MP uses the existing Moon Point effect artwork rather than a
        // Sin-affinity icon.
        if (resource === "mp") {
            return `
                <div class="skill-ego-cost-item skill-mp-cost-item">
                    <img src="../../res/effects/Moon_Point.png" alt="Moon Points" width="20">
                    <span>x${value}</span>
                </div>
            `;
        }

        const iconPath = resolveEgoCostIconPath(resource);

        if (!iconPath) {
            return "";
        }

        return `
            <div class="skill-ego-cost-item">
                <img src="${iconPath}" alt="${escapeHtml(resource)}" width="20">
                <span>x${value}</span>
            </div>
        `;
    }

    function buildSkill(skill) {

        const sinBase = sinMap[skill.sin] || sinMap.gloom;
        const skillColor = sinColorMap[skill.sin] || "#b9782d";
        const normalizedSin = String(skill.sin || "").trim().toLowerCase();
        const hasCustomImage = Boolean(String(skill.img || skill.c_img || "").trim());
        const sinIconPath = !skill._isDefense && !hasCustomImage && sinMap[normalizedSin]
            ? `../../res/skills/sins/${normalizedSin}.png`
            : "";
        const slotSinIconHtml = sinIconPath
            ? `
                <img class="slot-center-icon slot-sin-affinity slot-sin-logo"
                     src="${sinIconPath}"
                     alt=""
                     onerror="this.remove()">
            `
            : "";

        let slotIconHtml = "";
        let defenseTypeIconHtml = "";
        if (skill._isDefense) {
            const customDefenseImage = String(skill.img || skill.c_img || "").trim();
            const defenseImageName = customDefenseImage
                .replace(/^.*[\\/]/, "")
                .replace(/\.png$/i, "")
                .toLowerCase();
            const usesBuiltInDefenseIcon = ["d_defense", "d_counter"].includes(defenseImageName);
            const iconPath = resolveDefenseCenterIconPath(skill);

            if (iconPath) {
                slotIconHtml = `
                 <img class="slot-center-icon${usesBuiltInDefenseIcon ? " slot-defense-icon" : ""}"
                     src="${iconPath}"
                     width="88"
                     onerror="this.remove()">
                `;
            }

            const typeIconPath = !customDefenseImage
                ? resolveDefenseTypeIconPath(skill.type || "evade")
                : "";

            if (typeIconPath) {
                defenseTypeIconHtml = `
                 <img class="slot-center-icon slot-defense-icon"
                     src="${typeIconPath}"
                     onerror="this.remove()">
                `;
            }
        }
        else if (skill._isWeapon || skill._isEgo) {
            const iconPath = resolveWeaponIconPath(skill.img || skill.c_img || "");

            if (iconPath) {
                slotIconHtml = `
                 <img class="slot-center-icon"
                     src="${iconPath}"
                     width="88"
                     onerror="this.remove()">
                `;
            }
        }
        else {
            const iconPath = resolveSkillCenterIconPath(skill);
            const usesSinAffinityIcon = !String(skill.img || "").trim();

            if (iconPath && !usesSinAffinityIcon) {
                slotIconHtml = `
                 <img class="slot-center-icon"
                     src="${iconPath}"
                     width="88"
                     onerror="this.remove()">
                `;
            }
        }

        let coinsHtml = "";
        let coinTextHtml = "";
        let coinsTopHtml = "";
        const basePowerText = String(skill.basePower || skill.base_power || "").trim();
        const coinPowerText = String(skill.coinPower || skill.coin_power || "").trim();
        const coinAmount = Array.isArray(skill.coins) && skill.coins.length
            ? skill.coins.length
            : (skill._defenseDefaultCoin ? 1 : 0);
        const basePowerValue = Number(basePowerText);
        const coinPowerValue = coinPowerText ? Number(coinPowerText) : 0;
        const calculatedPower = basePowerValue + coinPowerValue * coinAmount;
        const calculatedPowerText = Number.isFinite(calculatedPower) ? ` = ${calculatedPower}` : "";
        const coinPowerTerm = Number.isFinite(coinPowerValue) ? String(coinPowerValue) : (coinPowerText || "0");
        const coinPowerSum = coinAmount
            ? `(${Array(coinAmount).fill(coinPowerTerm).join(" + ")})`
            : "0";
        const powerTooltipText = `Skill Power:\\n${basePowerText} + ${coinPowerSum}${calculatedPowerText}`;
        const basePowerHtml = basePowerText
            ? `<span class="slot-base-power" data_tooltip="skill_power_calculation" data_tooltip_text="${escapeHtml(powerTooltipText)}">${escapeHtml(basePowerText)}</span>`
            : "";
        const coinPowerHtml = coinPowerText ? `<span class="slot-coin-power">${escapeHtml(coinPowerText)}</span>` : "";
        const normalizedDefenseType = String(skill.type || "").trim().toLowerCase();
        const normalizedDefenseDmgType = String(skill.dmg_type || "").trim().toLowerCase();
        const showDefenseDmgType = Boolean(
            skill._isDefense
            && (normalizedDefenseType === "clash" || normalizedDefenseType === "counter")
            && dmgMap[normalizedDefenseDmgType]
        );

        skill.coins.forEach((coin, index) => {

            const coinText = String(coin.text || "").trim();
            const beforeText = String(coin.beforeText || "").trim();
            const isEmptyWeaponCoin = skill._isWeapon && !coinText.length;
            const weaponEmptyCoinIcon = `../../res/skills/coin_${index + 1}.png`;

            const icon = (coin.type === 'unbreakable')
                ? "../../res/skills/coin_unbreakable.png"
                : (coin.type === 'excision')
                    ? "../../res/skills/coin_excision.png"
                    : (coin.type === 'sever')
                        ? "../../res/skills/coin_sever.png"
                        : "../../res/skills/coin.png";

            coinsHtml += `
                 <img class="skill-coins"
                     src="${icon}"
                     width="28">
            `;

            if (beforeText.length) {
                coinTextHtml += `<p class="solo-desc">${beforeText}</p>`;
            }

            if (!coinText.length && !isEmptyWeaponCoin) {
                return;
            }

              if (!isEmptyWeaponCoin) {
                 coinTextHtml += `
                 <img class="skill-text-coin"
                     src="../../res/skills/coin_${index + 1}.png"
                     width="32">

                 <p>${coin.text}</p>
                 `;
              }
        });

        // default coin shown above the name for defense skills when no explicit coins provided
        if (skill._defenseDefaultCoin && (!skill.coins || skill.coins.length === 0)) {
            coinsTopHtml = `
                <div class="skill-default-coin">
                    <img src="../../res/skills/coin.png" width="28">
                </div>
            `;
        }

        const slotLevel = skill.mp || skill.c_mp || "1";
        const costClass = skill.c_mp || skill.mp || "1";
        const customFlavor = String(skill.flavor || "").trim();
        const costText = customFlavor || (
            skill._isWeapon || skill._isEgo
                ? ""
                : (skill._defenseLabel || `Skill ${skill.c_mp || skill.mp}`)
        );
        const hasCustomFlavor = Boolean(customFlavor);
        const flavorReserve = (skill._isWeapon || skill._isEgo)
            ? `${Math.max(skill.coins.length * 28 + Math.max(skill.coins.length - 1, 0) * 4 + 20, 20)}px`
            : "0px";
        const weaponHitText = (skill._isWeapon || skill._isEgo) ? String(skill.hit || "").trim() : "";
        const weaponDmgText = (skill._isWeapon || skill._isEgo) ? String(skill.dmg || "").trim() : "";
        const skillDmgText = (!skill._isWeapon && !skill._isEgo && !skill._isDefense)
            ? String(skill.dmg || "").trim()
            : "";
        const egoRiskPath = skill._isEgo ? resolveEgoRiskIconPath(skill.level) : "";
        const resourceCostHtml = Array.isArray(skill.cost) && skill.cost.length
            ? `
                <div class="skill-resource-costs">
                    ${skill.cost.map(buildResourceCostItem).join("")}
                </div>
            `
            : "";

        const rowMp = (skill.mp || skill.c_mp || slotLevel || "");

        // Determine slot images based on sin type
        let slotBaseSrc, slotBackgroundSrc;
        if (skill.sin === "sinless") {
            slotBaseSrc = "../../res/skills/slots/no_sin.png";
            slotBackgroundSrc = "../../res/skills/slots/bkg_no_sin.png";
        } else {
                slotBaseSrc = `${sinBase}_${slotLevel}.png`;
            slotBackgroundSrc = `${sinBase.replace("/slots/", "/slots/bkg_")}_${slotLevel}.png`;
        }

        return `
        <div class="skill-card-row${skill._isDefense ? ' defense-row' : ''}${skill._isWeapon ? ' weapon-row' : ''}${skill._isEgo ? ' ego-row' : ''}" data-mp="${escapeHtml(rowMp)}">

            ${skill._isEgo ? `
            <div class="skill-slot-column">
                <div class="skill-slot">

                    <img class="slot-base"
                         src="${slotBaseSrc}"
                         width="128">

                    <img class="slot-background"
                         src="${slotBackgroundSrc}"
                         width="128">

                     ${slotIconHtml}
                    ${slotSinIconHtml}
                     ${defenseTypeIconHtml}

                     ${basePowerHtml}
                     ${coinPowerHtml}

                     ${skill._isDefense && !showDefenseDmgType ? "" : `
                     <img class="slot-dmgtype"
                         src="${showDefenseDmgType ? dmgMap[normalizedDefenseDmgType] : (skill._defenseIcon || dmgMap[skill._isDefense ? skill.dmg : skill.dmg_type])}"
                         width="56">
                     `}

                </div>

                ${egoRiskPath ? `
                <div class="skill-ego-risk">
                    <img src="${egoRiskPath}" alt="${escapeHtml(skill.level || "")}" width="76">
                </div>
                ` : ""}

                ${resourceCostHtml}
            </div>
            ` : `
            <div class="skill-slot-column">
                <div class="skill-slot">

                    <img class="slot-base"
                         src="${slotBaseSrc}"
                         width="128">

                    <img class="slot-background"
                         src="${slotBackgroundSrc}"
                         width="128">

                     ${slotIconHtml}
                     ${slotSinIconHtml}
                     ${defenseTypeIconHtml}

                     ${basePowerHtml}
                     ${coinPowerHtml}

                     ${skill._isDefense && !showDefenseDmgType ? "" : `
                     <img class="slot-dmgtype"
                         src="${showDefenseDmgType ? dmgMap[normalizedDefenseDmgType] : dmgMap[skill._isDefense ? skill.dmg : skill.dmg_type]}"
                         width="56">
                     `}

                </div>

                ${resourceCostHtml}
            </div>
            `}

            <div class="skill_description">

                <div class="skill-coins-row">
                    ${coinsHtml}
                </div>

                ${coinsTopHtml}

                <div class="skill-name-wrap" style="--skill-main:${skillColor};">
                    ${costText.length ? `<p class="skill-cost-label skill-cost-${costClass}${hasCustomFlavor ? " skill-flavor-label" : ""}"${hasCustomFlavor && (skill._isWeapon || skill._isEgo) ? ` style="--skill-flavor-reserve: ${flavorReserve};"` : ""}>${costText}</p>` : ""}

                    <p class="skill-name">
                        ${skill.title}
                    </p>
                </div>

                ${weaponHitText.length ? `<div class="weapon-hit-label"><img src="../../res/skills/hit.png" alt="hit" width="28"> <span>${weaponHitText}</span></div>` : ""}

                ${weaponDmgText.length ? `<div class="weapon-dmg-label"><img src="../../res/skills/dmg.png" alt="dmg" width="28"> <span>${weaponDmgText}</span></div>` : ""}

                ${skillDmgText.length ? `<div class="skill-dmg-label"><img src="../../res/skills/dmg.png" alt="dmg" width="28"> <span>${skillDmgText}</span></div>` : ""}

                <div class="skill-text">

                    ${skill.info.map(i =>
                        `<p class="solo-desc">${i}</p>`
                    ).join("")}

                    ${coinTextHtml}

                    ${skill.end.map(i => `<p class="solo-desc">${i}</p>`).join("")}

                </div>

            </div>

        </div>
        `;
    }

    function buildPassive(passive) {

        const pMp = (passive.mp || passive.c_mp || "");
        const labelText = passive._target === 'ego' ? 'E.G.O. Passive' : 'Passive';
        const renderPassiveLine = (line) => String(line || "").replace(/\\n/g, "<br>");

        return `
        <div class="skill-card-row passive-row" data-mp="${escapeHtml(pMp)}">
        
            <div class="skill_description">
            
                <div class="skill-name-wrap passive-name-wrap" style="--skill-main:#b9782d;">
                    <p class="skill-cost-label skill-cost-passive">${labelText}</p>
                    <p class="skill-name passive-name">${passive.title}</p>
                </div>

                <div class="skill-text">
                    ${passive.text.map(line => `<p class="solo-desc">${renderPassiveLine(line)}</p>`).join("")}
                </div>

            </div>

        </div>
        `;
    }

    function buildDefense(def) {

        const sinBase = sinMap[def.sin] || sinMap.gloom;
        const skillColor = sinColorMap[def.sin] || "#b9782d";

        const dMp = (def.mp || def.c_mp || "");

        // Determine slot images based on sin type
        let slotBaseSrc, slotBackgroundSrc;
        if (def.sin === "sinless") {
            slotBaseSrc = "../../res/skills/slots/no_sin.png";
            slotBackgroundSrc = "../../res/skills/slots/bkg_no_sin.png";
        } else {
            slotBaseSrc = `${sinBase}_1.png`;
            slotBackgroundSrc = `${sinBase.replace("/slots/", "/slots/bkg_")}_1.png`;
        }

        return `
        <div class="skill-card-row${def._isDefense ? ' defense-row' : ''}" data-mp="${escapeHtml(dMp)}">

            <div class="skill-slot">

                <img class="slot-base"
                     src="${slotBaseSrc}"
                     width="128">

                <img class="slot-background"
                     src="${slotBackgroundSrc}"
                     width="128">

                
                 ${def._isDefense ? "" : `
                 <img class="slot-dmgtype"
                     src="${skillColor}"
                     width="56">
                 `}

            </div>

            <div class="skill_description">

                <div class="skill-name-wrap" style="--skill-main:${skillColor};">
                    <p class="skill-cost-label skill-cost-1">Skill 1</p>

                    <p class="skill-name">
                        ${def.title}
                    </p>
                </div>

                <div class="skill-text">
                    ${(def.info || []).map(i => `<p class="solo-desc">${i}</p>`).join("")}
                </div>

            </div>

        </div>
        `;
    }

    const matchesSessionMarker = (value, sessionName, direction) => {
        const normalizedLine = String(value || "").trim();
        const normalizedSession = String(sessionName || "").trim().toUpperCase();
        const legacyStart = `!${normalizedSession.toLowerCase()}-start`;
        const legacyEnd = `!${normalizedSession.toLowerCase()}-end`;

        if (direction === "start") {
            return normalizedLine.toUpperCase() === `S-${normalizedSession}` || normalizedLine === legacyStart;
        }

        return normalizedLine.toUpperCase() === `E-${normalizedSession}` || normalizedLine === legacyEnd;
    };

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];
        const showcaseMarkerMatch = line.match(/^S-(SKILLS|DEFENSE|PASSIVES?)\s+SHOWCASE(?:\s*\(\s*(S[1-3]|DEFENSE|PASSIVE)\s*\))?$/i);
        const egoShowcaseMatch = /^S-EGO\s+SHOWCASE$/i.test(line);
        const egoHideMarkerMatch = /^S-EGO\s+HIDE$/i.test(line);
        const weaponShowcaseMatch = /^S-WEAPONS\s+SHOWCASE$/i.test(line);

        // =========================
        // SKILL START
        // =========================

        if (matchesSessionMarker(line, "skills", "start") || showcaseMarkerMatch?.[1].toUpperCase() === "SKILLS") {

            pushCurrentPassive();

            started = true;
            if (showcaseMarkerMatch?.[1].toUpperCase() === "SKILLS") {
                const showcaseValue = (showcaseMarkerMatch[2] || "S1").toUpperCase();
                const skillNumberMatch = showcaseValue.match(/^S([1-3])$/);
                showcaseTarget = {
                    section: "skills",
                    skillType: showcaseValue === "DEFENSE"
                        ? "defense"
                        : showcaseValue === "PASSIVE"
                            ? "passives"
                            : "skill",
                    skillIndex: skillNumberMatch
                        ? String(Number(skillNumberMatch[1]) - 1)
                        : ""
                };
            }

            currentSkill = {
                title: "",
                flavor: "",
                sin: "",
                dmg: "",
                dmg_type: "slash",
                mp: "",
                c_mp: "",
                c_img: "",
                img: "",
                basePower: "",
                coinPower: "",
                cost: [],
                info: [],
                end: [],
                coins: []
            };
            pendingCoinBtw = [];

            currentPassive = null;
            inPassives = false;
            inWeapons = false;
            passiveSections.length = 0;

            continue;
        }

        if (matchesSessionMarker(line, "weapons", "start") || weaponShowcaseMatch) {

            pushCurrentPassive();

            if (weaponShowcaseMatch && !showcaseTarget) {
                showcaseTarget = { section: "armas" };
            }

            started = true;
            inWeapons = true;
            inPassives = false;
            inDefense = false;
            mode = null;

            currentWeapon = {
                title: "",
                flavor: "",
                hit: "",
                dmg: "",
                sin: "sinless",
                dmg_type: "slash",
                _hasExplicitWeaponFields: false,
                _pendingDmgText: "",
                mp: "1",
                c_mp: "",
                c_img: "",
                img: "",
                basePower: "",
                coinPower: "",
                cost: [],
                info: [],
                end: [],
                coins: []
            };

            continue;
        }

        if (matchesSessionMarker(line, "ego", "start") || egoShowcaseMatch || egoHideMarkerMatch) {

            pushCurrentPassive();

            // Allow multiple independent E.G.O blocks in the same .skill file.
            // If a previous E.G.O was left open, persist it before starting a new one.
            if (currentEgo) {
                egoSections.push(currentEgo);
                currentEgo = null;
            }

            started = true;
            if (egoShowcaseMatch && !showcaseTarget) {
                showcaseTarget = { section: "ego" };
            }
            inEgo = true;
            inPassives = false;
            inDefense = false;
            inWeapons = false;
            mode = null;
            hideEgoSession = egoHideMarkerMatch;

            currentEgo = {
                title: "",
                flavor: "",
                hit: "",
                sin: "sinless",
                dmg: "",
                dmg_type: "slash",
                mp: "3",
                level: "",
                c_mp: "",
                c_img: "",
                basePower: "",
                coinPower: "",
                cost: [],
                info: [],
                end: [],
                coins: []
            };
            if (hideEgoSession) {
                currentEgo._hidden = true;
            }

            continue;
        }

        if (matchesSessionMarker(line, "sanity", "start")) {

            pushCurrentPassive();

            if (currentEgo) {
                egoSections.push(currentEgo);
                currentEgo = null;
            }

            started = true;
            inSanity = true;
            inEgo = false;
            inPassives = false;
            inDefense = false;
            inWeapons = false;
            mode = null;

            sanitySections.push({
                name: "Pânico",
                img: "",
                increase: null,
                decrease: null,
                effects: []
            });

            continue;
        }

        if (matchesSessionMarker(line, "sanity", "end")) {

            pushCurrentPassive();
            inSanity = false;
            mode = null;

            continue;
        }

        if (matchesSessionMarker(line, "ego", "end")) {

            pushCurrentPassive();

            if (currentEgo) {
                egoSections.push(currentEgo);
                currentEgo = null;
            }

            inEgo = false;
            hideEgoSession = false;
            mode = null;

            continue;
        }

        if (matchesSessionMarker(line, "weapons", "end")) {

            pushCurrentPassive();

            if (currentWeapon) {
                finalizeCurrentWeapon();
                weaponSections.push(currentWeapon);
                currentWeapon = null;
            }

            inWeapons = false;
            mode = null;

            continue;
        }

        // =========================
        // SKILL END
        // =========================

        if (matchesSessionMarker(line, "skills", "end")) {

            pushCurrentPassive();

            if (currentSkill) {
                skillSections.push(currentSkill);
                currentSkill = null;
            }

            inPassives = true;
            mode = null;

            continue;
        }

        if (matchesSessionMarker(line, "defense", "start") || showcaseMarkerMatch?.[1].toUpperCase() === "DEFENSE") {

            pushCurrentPassive();

            // Ensure parser is activated even if no prior !skills-start block
            started = true;
            if (showcaseMarkerMatch?.[1].toUpperCase() === "DEFENSE" && !showcaseTarget) {
                showcaseTarget = {
                    section: "skills",
                    skillType: "defense",
                    skillIndex: ""
                };
            }

            inDefense = true;
            inWeapons = false;
            mode = null;

            continue;
        }

        if (matchesSessionMarker(line, "defense", "end")) {

            pushCurrentPassive();

            if (currentDefense) {
                defenseSections.push(currentDefense);
                currentDefense = null;
            }

            inDefense = false;
            mode = null;

            continue;
        }

        if (
            matchesSessionMarker(line, "passives", "start")
            || ["PASSIVE", "PASSIVES"].includes(showcaseMarkerMatch?.[1].toUpperCase())
        ) {

            pushCurrentPassive();

            // Ensure parser is activated when passives appear standalone
            started = true;
            if (["PASSIVE", "PASSIVES"].includes(showcaseMarkerMatch?.[1].toUpperCase()) && !showcaseTarget) {
                showcaseTarget = {
                    section: "skills",
                    skillType: "passives",
                    skillIndex: ""
                };
            }

            inPassives = true;
            mode = null;

            continue;
        }

        if (matchesSessionMarker(line, "passives", "end")) {

            pushCurrentPassive();

            mode = null;

            continue;
        }

        // =========================
        // NEXT SKILL
        // =========================

        if (line === "---") {

            pushCurrentPassive();

            if (currentSkill) {
                skillSections.push(currentSkill);
                currentSkill = null;
                skillsCount++;
            }

            if (currentDefense) {
                defenseSections.push(currentDefense);
                currentDefense = null;
            }

            if (currentWeapon) {
                finalizeCurrentWeapon();
                weaponSections.push(currentWeapon);
                currentWeapon = null;
            }

            if (inPassives) {
                mode = null;
            }
            else if (inWeapons) {
                currentWeapon = {
                    title: "",
                    flavor: "",
                    hit: "",
                    dmg: "",
                    sin: "sinless",
                    dmg_type: "slash",
                    _hasExplicitWeaponFields: false,
                    _pendingDmgText: "",
                    mp: "1",
                    c_mp: "",
                    c_img: "",
                    img: "",
                    cost: [],
                    info: [],
                    end: [],
                    coins: []
                };
            }
            else if (inEgo) {
                if (currentEgo) {
                    egoSections.push(currentEgo);
                }
                mode = null;
                currentEgo = null;
            }
            else {
                currentSkill = {
                    title: "",
                    flavor: "",
                    sin: "",
                    dmg: "",
                    dmg_type: "slash",
                    mp: "",
                    c_mp: "",
                    c_img: "",
                    cost: [],
                    info: [],
                    end: [],
                    coins: []
                };
            }

            continue;
        }

        if (!started || (!currentSkill && !currentWeapon && !currentEgo && !currentPassive && !inPassives && !inDefense && !inWeapons && !inEgo && !inSanity))
            continue;

        if (/^HIDE$/i.test(line)) {
            if (inEgo && !currentPassive) {
                hideEgoSession = true;
                if (currentEgo) {
                    currentEgo._hidden = true;
                }
            } else {
                const hiddenItem = currentPassive || currentDefense || currentWeapon || currentEgo || currentSkill;
                if (hiddenItem) {
                    hiddenItem._hidden = true;
                }
            }
            continue;
        }

        if ((inPassives || inEgo) && /^(?:passive|passive\s*\(|passive\s*\()\s*\(/i.test(line) === false && /^(?:passive|PASSIVE)\s*\(/i.test(line)) {
            pushCurrentPassive();

            const passiveMatch = line.match(/^(?:passive|PASSIVE)\s*\(\s*(.*?)\s*\)\s*(?::\s*(.*?))?\s*(\{)?\s*$/i);
            const passiveTitle = passiveMatch ? (passiveMatch[1] || "").trim() : line.replace(/^(?:passive|PASSIVE)\s*\(/i, "").replace(/\)\s*\{?\s*$/, "").trim();
            const passiveInlineText = passiveMatch && passiveMatch[2] ? passiveMatch[2].trim() : "";

            currentPassive = {
                title: passiveTitle,
                text: [],
                _target: inEgo ? "ego" : "normal"
            };

            if (passiveInlineText.length) {
                currentPassive.text.push(formatSkillText(passiveInlineText));
            }

            mode = passiveMatch && passiveMatch[3] ? "passive" : (passiveInlineText.length ? null : "passive");

            continue;
        }

        if ((inPassives || inEgo) && /^(?:passive|PASSIVE)\s*\(/i.test(line)) {
            pushCurrentPassive();

            const passiveMatch = line.match(/^(?:passive|PASSIVE)\s*\(\s*(.*?)\s*\)\s*(?::\s*(.*?))?\s*(\{)?\s*$/i);
            const passiveTitle = passiveMatch ? (passiveMatch[1] || "").trim() : line.replace(/^(?:passive|PASSIVE)\s*\(/i, "").replace(/\)\s*\{?\s*$/, "").trim();
            const passiveInlineText = passiveMatch && passiveMatch[2] ? passiveMatch[2].trim() : "";

            currentPassive = {
                title: passiveTitle,
                text: [],
                _target: inEgo ? "ego" : "normal"
            };

            if (passiveInlineText.length) {
                currentPassive.text.push(formatSkillText(passiveInlineText));
            }

            mode = passiveMatch && passiveMatch[3] ? "passive" : (passiveInlineText.length ? null : "passive");

            continue;
        }

        if (inDefense && line.startsWith("defense(")) {

            if (currentDefense) {
                defenseSections.push(currentDefense);
            }

            const defTitle = line
                .replace(/^defense\(/, "")
                .replace(/\)\s*\{$/, "")
                .replace(/\)$/, "")
                .trim();

            currentDefense = {
                title: defTitle,
                sin: "",
                dmg: "",
                dmg_type: "",
                mp: "1",
                c_mp: "1",
                c_img: "",
                img: "",
                basePower: "",
                coinPower: "",
                cost: [],
                info: [],
                end: [],
                coins: [],
                _hasExplicitType: false,
                _defenseIcon: defenseIconMap['evade']
            };

            mode = "info";

            continue;
        }

        // =========================
        // PROPERTIES
        // =========================

        const readPropertyValue = (rawLine, keyNames) => {
            const aliases = Array.isArray(keyNames) ? keyNames : [keyNames];
            const pattern = new RegExp(
                `^(?:${aliases
                    .map(alias => String(alias || "").trim())
                    .filter(Boolean)
                    .map(alias => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                    .join("|")})\\s*:?\\s*`,
                "i"
            );
            const clean = String(rawLine || "").replace(pattern, "").replace(/;\s*$/, "").trim();
            return clean;
        };

        if (/^(?:name|NAME)\s*:/i.test(line) && inSanity && sanitySections.length) {
            const name = readPropertyValue(line, ["name", "NAME"]);
            sanitySections[sanitySections.length - 1].name = name || "Pânico";
            continue;
        }

        if (/^(?:custom_img|CUSTOM_IMG)\s*:/i.test(line) && inSanity && sanitySections.length) {
            sanitySections[sanitySections.length - 1].img = readPropertyValue(line, ["custom_img", "CUSTOM_IMG"]);
            continue;
        }

        if (/^SANITY_EFFECTS\s*:?[\s]*$/i.test(line) && inSanity && sanitySections.length) {
            sanitySections[sanitySections.length - 1].effects = [];
            mode = "sanity-effects";
            continue;
        }

        if (/^SANITY_INCREASE\s*:?[\s]*$/i.test(line) && inSanity && sanitySections.length) {
            sanitySections[sanitySections.length - 1].increase = [];
            mode = "sanity-increase";
            continue;
        }

        if (/^SANITY_DECREASE\s*:?[\s]*$/i.test(line) && inSanity && sanitySections.length) {
            sanitySections[sanitySections.length - 1].decrease = [];
            mode = "sanity-decrease";
            continue;
        }

        if (/^(?:title|NAME)\s*:/i.test(line) && currentSkill) {
            currentSkill.title = readPropertyValue(line, ["title", "NAME"]);
        }

        if (/^(?:title|NAME)\s*:/i.test(line) && currentWeapon) {
            currentWeapon.title = readPropertyValue(line, ["title", "NAME"]);
        }

        if (/^(?:title|NAME)\s*:/i.test(line) && currentEgo) {
            currentEgo.title = readPropertyValue(line, ["title", "NAME"]);
        }

        if (/^(?:flavor|FLAVOR)\s*:/i.test(line) && currentEgo) {
            currentEgo.flavor = readPropertyValue(line, ["flavor", "FLAVOR"]);
        }

        if (/^(?:flavor|FLAVOR)\s*:/i.test(line) && currentSkill) {
            currentSkill.flavor = readPropertyValue(line, ["flavor", "FLAVOR"]);
        }

        if (/^(?:hit|HIT)\s*:/i.test(line) && currentEgo) {
            const rawHit = readPropertyValue(line, ["hit", "HIT"]);
            currentEgo.hit = formatSkillText(rawHit);
        }

        if (/^(?:name|NAME)\s*:/i.test(line) && currentEgo && !currentEgo.title) {
            currentEgo.title = readPropertyValue(line, ["name", "NAME"]);
        }

        if (/^(?:title|NAME)\s*:/i.test(line) && inWeapons && !currentWeapon) {
            const t = readPropertyValue(line, ["title", "NAME"]);
            currentWeapon = {
                title: t,
                flavor: "",
                hit: "",
                dmg: "",
                sin: "sinless",
                dmg_type: "slash",
                _hasExplicitWeaponFields: false,
                _pendingDmgText: "",
                mp: "1",
                c_mp: "",
                c_img: "",
                img: "",
                cost: [],
                info: [],
                end: [],
                coins: []
            };
        }

        if (/^(?:title|NAME)\s*:/i.test(line) && inEgo && !currentEgo) {
            const t = readPropertyValue(line, ["title", "NAME"]);
            currentEgo = {
                title: t,
                flavor: "",
                hit: "",
                sin: "sinless",
                dmg: "",
                dmg_type: "slash",
                mp: "3",
                level: "",
                c_mp: "",
                c_img: "",
                img: "",
                cost: [],
                info: [],
                end: [],
                coins: []
            };
        }

        if (/^(?:flavor|FLAVOR)\s*:/i.test(line) && currentWeapon) {
            currentWeapon.flavor = readPropertyValue(line, ["flavor", "FLAVOR"]);
        }

        if (/^(?:dmg_type|DMG_TYPE)\s*:/i.test(line) && currentWeapon) {
            const rawDmgType = readPropertyValue(line, ["dmg_type", "DMG_TYPE"]);

            if (currentWeapon._pendingDmgText) {
                currentWeapon.dmg = formatSkillText(currentWeapon._pendingDmgText);
            }

            currentWeapon.dmg_type = rawDmgType;
            currentWeapon._hasExplicitWeaponFields = true;
            currentWeapon._pendingDmgText = "";
        }

        if (/^(?:hit|HIT)\s*:/i.test(line) && currentWeapon) {
            const rawHit = readPropertyValue(line, ["hit", "HIT"]);
            currentWeapon.hit = formatSkillText(rawHit);
            currentWeapon._hasExplicitWeaponFields = true;
        }

        if (/^(?:title|NAME)\s*:/i.test(line) && inDefense && !currentDefense) {
            const t = readPropertyValue(line, ["title", "NAME"]);
            currentDefense = {
                title: t,
                sin: "",
                dmg: "",
                dmg_type: "",
                mp: "1",
                c_mp: "1",
                c_img: "",
                cost: [],
                info: [],
                end: [],
                coins: [],
                type: 'evade',
                _hasExplicitType: false,
                _defenseIcon: defenseIconMap['evade']
            };
        }

        if (/^(?:title|NAME)\s*:/i.test(line) && currentDefense) {
            currentDefense.title = readPropertyValue(line, ["title", "NAME"]);
        }

        if (/^(?:sin|SIN)\s*:/i.test(line) && currentSkill) {
            currentSkill.sin = readPropertyValue(line, ["sin", "SIN"]);
        }

        if (/^(?:sin|SIN)\s*:/i.test(line) && currentWeapon) {
            currentWeapon.sin = readPropertyValue(line, ["sin", "SIN"]);
        }

        if (/^(?:sin|SIN)\s*:/i.test(line) && currentEgo) {
            currentEgo.sin = readPropertyValue(line, ["sin", "SIN"]);
        }

        if (/^(?:sin|SIN)\s*:/i.test(line) && currentDefense) {
            currentDefense.sin = readPropertyValue(line, ["sin", "SIN"]);
        }

        if (/^(?:type|TYPE)\s*:/i.test(line) && currentDefense) {
            const t = readPropertyValue(line, ["type", "TYPE"]);
            currentDefense.type = t;
            currentDefense._hasExplicitType = true;
            currentDefense._defenseIcon = defenseIconMap[t] || defenseIconMap['evade'];
        }

        if (/^(?:dmg_type|DMG_TYPE)\s*:/i.test(line) && currentSkill) {
            currentSkill.dmg_type = readPropertyValue(line, ["dmg_type", "DMG_TYPE"]).toLowerCase();
        }

        if (/^dmg\b(?:\s*:|\s+)/i.test(line) && currentSkill) {
            currentSkill.dmg = formatSkillText(readPropertyValue(line, ["dmg", "DMG"]));
        }

        if (/^(?:dmg|DMG)\s*:/i.test(line) && currentWeapon) {
            const rawValue = readPropertyValue(line, ["dmg", "DMG"]);

            if (currentWeapon._hasExplicitWeaponFields) {
                currentWeapon.dmg = formatSkillText(rawValue);
            }
            else {
                currentWeapon._pendingDmgText = rawValue;
            }
        }

        if (/^(?:dmg|DMG)\s*:/i.test(line) && currentEgo) {
            currentEgo.dmg = readPropertyValue(line, ["dmg", "DMG"]);
        }

        if (/^(?:dmg_type|DMG_TYPE)\s*:/i.test(line) && currentEgo) {
            currentEgo.dmg_type = readPropertyValue(line, ["dmg_type", "DMG_TYPE"]).toLowerCase();
        }

        if (/^(?:dmg_type|DMG_TYPE)\s*:/i.test(line) && currentDefense) {
            currentDefense.dmg_type = readPropertyValue(line, ["dmg_type", "DMG_TYPE"]).toLowerCase();
        }

        if (/^(?:mp|MP)\s*:/i.test(line) && currentSkill) {
            currentSkill.mp = readPropertyValue(line, ["mp", "MP"]);
        }

        if (/^(?:mp|MP)\s*:/i.test(line) && currentWeapon) {
            currentWeapon.mp = readPropertyValue(line, ["mp", "MP"]);
        }

        if (/^(?:mp|MP)\s*:/i.test(line) && currentEgo) {
            currentEgo.mp = readPropertyValue(line, ["mp", "MP"]);
        }

        if (/^(?:level|LEVEL)\s*:/i.test(line) && currentEgo) {
            const rawLevel = readPropertyValue(line, ["level", "LEVEL"]).toLowerCase();

            const allowedLevels = ["zayin", "teth", "he", "waw", "aleph", "unknow", "undef"];
            currentEgo.level = allowedLevels.includes(rawLevel) ? rawLevel : "";
        }

        const costTarget = inDefense
            ? currentDefense
            : inWeapons
                ? currentWeapon
                : inEgo
                    ? currentEgo
                    : !inPassives
                        ? currentSkill
                        : null;

        if (/^(?:cost|COST)\b/i.test(line) && costTarget) {
            const costValue = line.replace(/^\s*(?:cost|COST)\s*:?\s*/i, "").replace(/;\s*$/, "").trim();
            if (costValue.length) {
                const costParts = costValue.split(/\s*[,;]\s*/).filter(Boolean);
                costTarget.cost.push(...costParts.map(part => {
                    const match = part.match(/^([A-Za-z0-9_-]+)\s*[:=]\s*(.+)$/);
                    if (!match) return { sin: "", value: part };
                    return { sin: match[1].toLowerCase(), value: match[2].trim() };
                }).filter(item => item.sin || item.value));
                continue;
            }

            currentCostTarget = costTarget;
            mode = "cost";
            continue;
        }

        if (/^(?:c_mp|CUSTOM_MP)\s*:/i.test(line) && currentSkill) {
            currentSkill.c_mp = readPropertyValue(line, ["c_mp", "CUSTOM_MP"]);
        }

        if (/^(?:c_mp|CUSTOM_MP)\s*:/i.test(line) && currentWeapon) {
            currentWeapon.c_mp = readPropertyValue(line, ["c_mp", "CUSTOM_MP"]);
        }

        if (/^(?:c_mp|CUSTOM_MP)\s*:/i.test(line) && currentEgo) {
            currentEgo.c_mp = readPropertyValue(line, ["c_mp", "CUSTOM_MP"]);
        }

        if (/^(?:c_img|CUSTOM_IMG|CUSTOM-IMG)\s*:/i.test(line) && currentSkill) {
            currentSkill.c_img = readPropertyValue(line, ["c_img", "CUSTOM_IMG", "CUSTOM-IMG"]);
        }

        if (/^(?:img|IMG)\s*:/i.test(line) && currentSkill) {
            currentSkill.img = readPropertyValue(line, ["img", "IMG"]);
        }

        if (/^(?:c_img|CUSTOM_IMG|CUSTOM-IMG)\s*:/i.test(line) && currentWeapon) {
            currentWeapon.c_img = readPropertyValue(line, ["c_img", "CUSTOM_IMG", "CUSTOM-IMG"]);
        }

        if (/^(?:c_img|CUSTOM_IMG|CUSTOM-IMG)\s*:/i.test(line) && currentEgo) {
            currentEgo.c_img = readPropertyValue(line, ["c_img", "CUSTOM_IMG", "CUSTOM-IMG"]);
        }

        if (/^(?:img|IMG)\s*:/i.test(line) && currentWeapon) {
            currentWeapon.img = readPropertyValue(line, ["img", "IMG"]);
        }

        if (/^(?:img|IMG)\s*:/i.test(line) && currentEgo) {
            currentEgo.img = readPropertyValue(line, ["img", "IMG"]);
        }

        if (/^(?:c_img|CUSTOM_IMG|CUSTOM-IMG)\s*:/i.test(line) && currentDefense) {
            currentDefense.c_img = readPropertyValue(line, ["c_img", "CUSTOM_IMG", "CUSTOM-IMG"]);
        }

        if (/^(?:img|IMG)\s*:/i.test(line) && currentDefense) {
            currentDefense.img = readPropertyValue(line, ["img", "IMG"]);
        }

        if (/^(?:coin[-_ ]?power|COIN[-_ ]?POWER|coinpower|COINPOWER)\s*:/i.test(line)) {
            const target = currentDefense || currentWeapon || currentEgo || currentSkill;
            if (target) {
                target.coinPower = readPropertyValue(line, ["coin-power", "COIN-POWER", "coin_power", "COIN_POWER", "coinpower", "COINPOWER"]);
            }
            continue;
        }

        if (/^(?:base[-_ ]?power|BASE[-_ ]?POWER|basepower|BASEPOWER)\s*:/i.test(line)) {
            const target = currentDefense || currentWeapon || currentEgo || currentSkill;
            if (target) {
                target.basePower = readPropertyValue(line, ["base-power", "BASE-POWER", "base_power", "BASE_POWER", "basepower", "BASEPOWER"]);
            }
            continue;
        }

        // =========================
        // INFO
        // =========================

        if (/^(?:info|INFO)\s*:?\s*(.*)$/i.test(line)) {
            const infoValue = line.replace(/^\s*(?:info|INFO)\s*:?\s*/i, "").replace(/;\s*$/, "").trim();
            if (infoValue.length) {
                const target = currentDefense || currentWeapon || currentEgo || currentSkill;
                if (target) {
                    if (currentDefense) currentDefense.info.push(formatSkillText(infoValue));
                    else if (currentWeapon) currentWeapon.info.push(formatSkillText(infoValue));
                    else if (currentEgo) currentEgo.info.push(formatSkillText(infoValue));
                    else if (currentSkill) currentSkill.info.push(formatSkillText(infoValue));
                }
                continue;
            }

            mode = "info";
            continue;
        }

        // =========================
        // END
        // =========================
        
        if (/^(?:end|END)\s*:?\s*(.*)$/i.test(line)) {
            const endValue = line.replace(/^\s*(?:end|END)\s*:?\s*/i, "").replace(/;\s*$/, "").trim();
            if (endValue.length) {
                const target = currentDefense || currentWeapon || currentEgo || currentSkill;
                if (target) {
                    if (currentDefense) currentDefense.end.push(formatSkillText(endValue));
                    else if (currentWeapon) currentWeapon.end.push(formatSkillText(endValue));
                    else if (currentEgo) currentEgo.end.push(formatSkillText(endValue));
                    else if (currentSkill) currentSkill.end.push(formatSkillText(endValue));
                }
                continue;
            }

            mode = "end";
            continue;
        }

        // =========================
        // TEXT BEFORE NEXT SKILL COIN
        // =========================

        if (/^btw\s*:?\s*$/i.test(line) && currentSkill) {
            mode = "btw";
            continue;
        }

        // =========================
        // COIN
        // =========================

        if (/^coin\s*(?:\([ues]\))?\s*:?\s*$/i.test(line)) {

            // support coin type flags: (u) unbreakable, (e) excision, (s) sever
            let coinType = "normal";
            if (line.includes("(u)") || line.includes("(U)")) coinType = "unbreakable";
            else if (line.includes("(e)")) coinType = "excision";
            else if (line.includes("(s)")) coinType = "sever";

            const target = currentDefense || currentWeapon || currentEgo || currentSkill;

            // If there's no active skill or defense, ignore the coin block
            if (!target) {
                mode = null; // skip content until closing brace
                continue;
            }

            const coin = {
                type: coinType,
                text: "",
                beforeText: target === currentSkill ? pendingCoinBtw.join("<br>") : ""
            };
            target.coins.push(coin);
            if (target === currentSkill) {
                pendingCoinBtw = [];
            }

            mode = "coin";

            continue;
        }

        // =========================
        // BLOCK START/END
        // =========================

        if (line === "{") continue;

        if (line === "}") {
            mode = null;
            currentCostTarget = null;
            continue;
        }

        // =========================
        // CONTENT
        // =========================

        if (inSanity && mode === "sanity-effects" && sanitySections.length) {
            const sanity = sanitySections[sanitySections.length - 1];
            const effectLine = String(line || "").trim();

            sanity.effects.push(formatSkillText(effectLine));

            continue;
        }

        if (inSanity && (mode === "sanity-increase" || mode === "sanity-decrease") && sanitySections.length) {
            const sanity = sanitySections[sanitySections.length - 1];
            const target = mode === "sanity-increase" ? sanity.increase : sanity.decrease;
            target.push(formatSkillText(String(line || "").trim()));
            continue;
        }

        const formatted = formatSkillText(line);

        if (mode === "cost" && currentCostTarget) {
            const rawCost = String(line || "").replace(/;\s*$/, "").trim();

            if (rawCost.length) {
                const costMatch = rawCost.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);

                if (costMatch) {
                    currentCostTarget.cost.push({
                        sin: costMatch[1].toLowerCase(),
                        value: costMatch[2].trim()
                    });
                }
            }

            continue;
        }

        if (mode === "info") {
            if (currentDefense) currentDefense.info.push(formatted);
            else if (currentWeapon) currentWeapon.info.push(formatted);
            else if (currentEgo) currentEgo.info.push(formatted);
            else if (currentSkill) currentSkill.info.push(formatted);
        }
        
        if (mode === "end") {
            if (currentDefense) currentDefense.end.push(formatted);
            else if (currentWeapon) currentWeapon.end.push(formatted);
            else if (currentEgo) currentEgo.end.push(formatted);
            else if (currentSkill) currentSkill.end.push(formatted);
        }

        if (mode === "btw") {
            if (currentSkill) {
                pendingCoinBtw.push(formatted);
            }
            continue;
        }

        if (mode === "coin") {

            const target = currentDefense || currentWeapon || currentEgo || currentSkill;
            if (!target) {
                continue;
            }

            const coinsArr = target.coins;
            const coin = coinsArr[coinsArr.length - 1];

            if (!coin) {
                continue;
            }

            if (coin.text.length) {
                coin.text += "<br>";
            }

            coin.text += formatted;
        }

            if (mode === "passive" && currentPassive) {
            currentPassive.text.push(formatted);
        }

        // defense content is collected via mode === 'info' into currentDefense.info
    }

    if (currentPassive) {
        pushCurrentPassive();
    }

    if (currentDefense) {
        defenseSections.push(currentDefense);
        currentDefense = null;
    }

    if (currentEgo) {
        egoSections.push(currentEgo);
        currentEgo = null;
    }

    if (currentWeapon) {
            finalizeCurrentWeapon();
        weaponSections.push(currentWeapon);
        currentWeapon = null;
    }

    const removeHiddenItems = sections => {
        for (let index = sections.length - 1; index >= 0; index--) {
            if (sections[index]._hidden) {
                sections.splice(index, 1);
            }
        }
    };

    [
        skillSections,
        passiveSections,
        egoPassiveSections,
        defenseSections,
        weaponSections,
        egoSections
    ].forEach(removeHiddenItems);

    if (weaponSections.length) {
        html += `<div class="skills-weapons-section">`;
        weaponSections.forEach((weapon) => {
            weapon._isWeapon = true;
            html += buildSkill(weapon);
        });

        html += `</div>`;
    }

    // Only add a generic separator after weapons if the following sections
    // include skills/passives/ego content. Defense sections render their own
    // ::before separator, so avoid adding the extra <div> when the next
    // block is solely defenses to prevent duplicate lines.
    const shouldSeparateAfterWeapons =
        weaponSections.length && (
            skillSections.length ||
            passiveSections.length ||
            (egoSections.length || egoPassiveSections.length) && !defenseSections.length
        );

    if (shouldSeparateAfterWeapons) {
        html += `<div class="skills-separator"></div>`;
    }

    if (skillSections.length) {
        html += `<div class="skills-section">`;
        skillSections.forEach((skill) => {
            html += buildSkill(skill);
        });

        html += `</div>`;
    }

    if (passiveSections.length) {
        // If passives are the first kit section (nothing before them), suppress the separator before them.
        const passiveClass = (!weaponSections.length && !skillSections.length)
            ? 'skills-passives-section no-separator'
            : 'skills-passives-section';

        html += `<div class="${passiveClass}"><br>`;
        passiveSections.forEach((passive) => {
            html += buildPassive(passive);
        });

        html += `</div>`;
    }

    if (defenseSections.length) {
        // If defenses are the first/only kit section, mark it to avoid generating
        // a visual separator before it (UI prefers no separator in that case).
        const defenseClass = (!weaponSections.length && !skillSections.length && !passiveSections.length && !egoSections.length && !egoPassiveSections.length)
            ? 'skills-defense-section no-separator'
            : 'skills-defense-section';

        html += `<div class="${defenseClass}">`;
        // render defenses using buildSkill so they behave exactly like normal skills
        defenseSections.forEach((def) => {
            // Keep `defense` as the file-format value, but present it as
            // Guard in the UI so it is not confused with the section name.
            if (def.type) {
                const defenseType = String(def.type).trim().toLowerCase();
                def._defenseLabel = defenseType === "defense"
                    ? "Guard"
                    : def.type.charAt(0).toUpperCase() + def.type.slice(1);
            }
            // mark defenses to render a default coin above the name when no explicit coins
            def._defenseDefaultCoin = true;
            def._isDefense = true;
            html += buildSkill(def);
        });

        html += `</div>`;
    }

    if (egoSections.length || egoPassiveSections.length) {
        if (weaponSections.length || skillSections.length || passiveSections.length || defenseSections.length) {
            html += `<div class="skills-separator"></div>`;
        }

        html += `<div class="skills-ego-section">`;
        egoSections.forEach((ego) => {
            ego._isEgo = true;
            // ensure mp is 3 so slot backgrounds use variation 3
            ego.mp = ego.mp || '3';
            html += buildSkill(ego);
        });

        if (egoPassiveSections.length) {
            html += `<div class="skills-passives-section skills-ego-passives-section">`;
            egoPassiveSections.forEach((passive) => {
                html += buildPassive(passive);
            });
            html += `</div>`;
        }

        html += `</div>`;
    }

    if (sanitySections.length) {
        if (weaponSections.length || skillSections.length || passiveSections.length || defenseSections.length || egoSections.length || egoPassiveSections.length) {
            html += `<div class="skills-separator"></div>`;
        }

        html += `
            <div class="sanity-section-title">
                <span>Sanidade</span>
            </div>
            <div class="skills-sanity-section">
        `;

        const renderSanityDetail = (items, title, variant = "", image = "") => {
            if (!Array.isArray(items)) {
                return "";
            }

            return `
                <section class="sanity-detail-section${variant ? ` ${variant}` : ""}">
                    <div class="sanity-detail-title"><span>${title}</span></div>
                    <div class="skill-text sanity-detail-content">
                        ${items.map(line => `<p class="solo-desc">${line}</p>`).join("")}
                    </div>
                    <img class="sanity-detail-image" src="../../res/sanity/${image}" alt="${title}" onerror="this.remove()">
                </section>
            `;
        };

        sanitySections.forEach((sanity) => {
            const rawName = String(sanity.name || "Pânico").trim() || "Pânico";
            const name = formatSkillInlineStyles(escapeHtml(rawName));
            const imageName = String(sanity.img || "").trim();
            const imageFile = imageName || "panic.png";
            const normalizedImage = imageFile.replace(/^\/+/, "");
            const imagePath = /\.[^./\\]+$/.test(normalizedImage)
                ? normalizedImage
                : `${normalizedImage}.png`;
            html += `
                <div class="sanity-panel">
                    <div class="sanity-panel-identity">
                        <img class="sanity-panel-image" src="../../res/sanity/${imagePath}" alt="${escapeHtml(rawName.replace(/c\(#[0-9a-fA-F]{3,8}\)\{([^}]*)\}/g, "$1"))}" onerror="this.remove()">
                        <strong class="sanity-panel-name">${name}</strong>
                    </div>
                    <div class="skill-text sanity-panel-effects">
                        ${sanity.effects.map(line => `<p class="solo-desc">${line}</p>`).join("")}
                    </div>
                </div>
                ${renderSanityDetail(sanity.increase, "Ganho de Sanidade", "", "sanity_increase.png")}
                ${renderSanityDetail(sanity.decrease, "Perca de Sanidade", "sanity-detail-decrease", "sanity_loss.png")}
            `;
        });
        html += `</div>`;
    }

    html += `</div>`;

    if (showcaseTarget) {
        const showcaseAttributes = showcaseTarget.section === "skills"
            ? ` data-showcase-section="skills" data-showcase-skill-type="${showcaseTarget.skillType}" data-showcase-skill-index="${showcaseTarget.skillIndex}"`
            : ` data-showcase-section="${showcaseTarget.section === "ego" ? "ego" : "armas"}"`;
        html = html.replace('<div class="skills-wrapper">', `<div class="skills-wrapper"${showcaseAttributes}>`);
    }

    return html;
}

// =========================
// LOAD DIRECT MARKDOWN CONTENT
// =========================

function initDirectMarkdown() {

    const elements =
        document.querySelectorAll("[mkd-content]");

    if (!elements.length) return;

    elements.forEach(element => {

        const path =
            element.getAttribute("mkd-content");

        if (!path) return;

        loadContent(path, element);
    });
}

// =========================
// INIT
// =========================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadTooltips();

        initDirectMarkdown();

        initTooltips();
        initializeKitExportTriggers();

        await initCharsNavigation();

        initCharacterShowcaseSwap();
        initMarkdownButtons();
        initSystemCombatSubsections();
        initCharacterSkillVariantBadge();
        
        initSectionTabs();
        initSkillSubmenu();
        syncCharacterSkillVariantBadge().catch(() => {});

        window.addEventListener("resize", syncCharacterSkillViewport);
        window.addEventListener("resize", syncCharacterOverviewViewport);

        window.dispatchEvent(new Event("moon:app-ready"));
    }
);
