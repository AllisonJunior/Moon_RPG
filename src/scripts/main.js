// =========================
// NAV
// =========================

function nav(_page) {
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
        /\[([^\]]+)\]\{([^}]+)\}/g,
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

function formatEffectReferences(text, folder = "") {

    return String(text || "").replace(
        /@\{([^}]+)\}(?:\(([^)]+)\))?|@([A-Za-z0-9_&-]+)(?:\(([^)]+)\))?/g,
        (
            match,
            complexEffect,
            complexFolder,
            simpleEffect,
            simpleFolder,
            offset,
            fullString
        ) => {
            const effect = (complexEffect || simpleEffect || "").trim();
            const effectFolder = String(complexFolder || simpleFolder || folder || "").trim();

            if (!effect.length) {
                return match;
            }

            const imageName = effect.replace(/\s+/g, "_");
            const iconPath = effectFolder.length
                ? `../../res/effects/${effectFolder}/${imageName}.png`
                : `../../res/effects/${imageName}.png`;

            let tooltipKey = effect.replace(/\s+/g, "_").toLowerCase();

            if (effectFolder.length) {
                tooltipKey = `${effectFolder.toLowerCase()}_${tooltipKey}`;
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

            return `[<img class="effect-icon" src="${iconPath}" onerror="this.remove()"><span style="color:${effectColor}; text-decoration: underline; text-decoration-color: ${effectColor}; text-decoration-thickness: from-font; text-underline-offset: 0.08em; text-decoration-skip-ink: auto;">${effect}</span>]{${tooltipKey}}`;
        }
    );
}

// =========================
// LOAD MARKDOWN
// =========================

function loadMarkdown(path, element) {

    fetch(path)
        .then(response => response.text())
        .then(text => {


            // Apply custom parsing used by .skill files so Markdown files
            // support the same effect and inline formatting syntaxes.

            // Expand shorthand color tokens (!b{}, !g{}) before any further processing
            let preprocessed = String(text || "");
            preprocessed = preprocessed.replace(/!b\{([\s\S]*?)\}/g, (m, c) => `c(#ff0000){${c}}`);
            preprocessed = preprocessed.replace(/!g\{([\s\S]*?)\}/g, (m, c) => `c(#2E2EFF){${c}}`);

            // First, apply inline formatting (bold, italic, color tokens)
            const inlineFormatted = formatSkillInlineStyles(preprocessed);

            // Convert @Effect or @{Effect} into the intermediate [<img>]{key} form
            const effectsFormatted = formatEffectReferences(inlineFormatted);

            // Finally, convert any [texto]{key} occurrences into tooltip markup
            const parsed = parseCustomTooltips(effectsFormatted);

            const html = marked.parse(parsed);

            element.innerHTML = html;

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

    return fetch(path)
        .then(response => response.text())
        .then(text => {
            try {
                const overviewName = extractOverviewName(text);
                const overviewData = extractOverviewData(text);
                const normalizedPath = (path || "").replace(/\\/g, "/");
                const pageContainer = document.querySelector('.chars-page .page_container');
                const charFolder = pageContainer?.dataset.charFolder || "";
                const characterName = pageContainer?.dataset.characterName || "";
                const html = parseSkill(text, normalizedPath, charFolder, characterName);
                const hasKitContent = /skill-card-row|skills-passives-section|skills-defense-section|skills-weapons-section|skills-ego-section|skills-ego-passives-section/.test(html);
                const hasWeaponsContent = /skill-card-row\s+weapon-row|skills-weapons-section/.test(html);

                if (pageContainer) {
                    pageContainer.dataset.selectedHasKit = hasKitContent ? "true" : "false";
                    pageContainer.dataset.selectedHasOverview = overviewData ? "true" : "false";
                    pageContainer.dataset.selectedHasWeapons = hasWeaponsContent ? "true" : "false";
                }

                // Only update header/overview when not loading in 'silent' mode
                if (!String(kind).toLowerCase().includes('silent')) {
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

                        const kitHtml = `
                            <div class="chars-kit" data-skill-path="${kitTargetPath}">
                                <div class="chars-kit-name">Kit</div>
                                <div class="chars-kit-character">${kitCharacterName}</div>
                                <div class="chars-kit-separator"></div>
                            </div>
                        `;

                        // Render the kit header but do not attach interactive handlers — feature disabled
                        element.innerHTML = kitHtml + html;
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

                // Re-initialize tooltips for dynamically injected content
                try {
                    initTooltips();
                }
                catch (e) {
                    console.error('Erro ao inicializar tooltips após renderizar skill:', e);
                }
            }
            catch (err) {
                console.error('Erro ao parsear .skill:', err);
                if (element) element.innerHTML = "";
            }
        })
        .catch(error => {
            console.error("Erro ao carregar .skill:", error);
            if (element) element.innerHTML = "";
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

    const source = String(text || "");

    if (!source.length) {
        return null;
    }

    const overviewMatch = source.match(/!overview-start([\s\S]*?)!overview-end/i);

    if (!overviewMatch) {
        return null;
    }

    const overviewLines = overviewMatch[1]
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const readValue = (key) => {
        const entry = overviewLines.find(line => new RegExp(`^${key}\\s*:`, "i").test(line));

        if (!entry) {
            return "";
        }

        return entry
            .replace(new RegExp(`^${key}\\s*:`, "i"), "")
            .replace(/;+\s*$/, "")
            .trim()
            .replace(/\\n/g, "\n");
    };

    const readBlock = (key) => {
        const startIndex = overviewLines.findIndex(line => new RegExp(`^${key}\\s*:`, "i").test(line) || new RegExp(`^${key}\\s*$`, "i").test(line));

        if (startIndex < 0) {
            return "";
        }

        const collected = [];
        let started = false;

        for (let i = startIndex; i < overviewLines.length; i++) {
            let line = overviewLines[i];

            if (i === startIndex) {
                line = line.replace(new RegExp(`^${key}\\s*:?(.*)$`, "i"), "$1").trim();
            }

            if (!started) {
                if (line.includes("(") || line.includes("[")) {
                    started = true;
                    line = line.replace(/^.*?[\(\[]\s*/, "");
                }
                else {
                    continue;
                }
            }


            const closingIndex = line.search(/[\)\]]/);

            if (closingIndex >= 0) {
                const after = line.slice(closingIndex + 1).trim();
                // Only treat as block end when there's nothing meaningful after the
                // closing delimiter (handles parentheses inside paragraphs).
                if (after.length === 0) {
                    const content = line.slice(0, closingIndex).trim();
                    if (content.length) {
                        collected.push(content);
                    }
                    break;
                } else {
                    // It's likely an internal parenthesis: keep the whole line.
                    collected.push(line);
                    continue;
                }
            }

            collected.push(line);
        }

        return collected.join("\n").trim().replace(/\\n/g, "\n");
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

    const name = readValue("name") || "";

    return {
        name,
        life: readValue("life"),
        speed: readValue("speed").replace(/\s*~\s*/g, " - "),
        stagger: readValue("stagger"),
        ca: readValue("ca"),
        description: readBlock("description"),
        resistances: {
            blunt: normalizeResistance(readValue("blunt-res")),
            slash: normalizeResistance(readValue("slash-res")),
            pierce: normalizeResistance(readValue("pierce-res"))
        }
    };
}

// =========================
// AUTO LOAD
// =========================

function loadContent(path, element, kind = "") {

    if (resolveContentMode(path, kind) === "skill") {
        loadSkill(path, element, kind);
    }
    else {
        loadMarkdown(path, element);
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

    return normalizedFolder.length
        ? `../../bd/chars/${normalizedFolder}/${normalizedFileName}`
        : `../../bd/chars/${normalizedFileName}`;
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

    const file =
        String(imageFileName || "").trim() || type;

    const base = "../../bd/chars";

    const candidates = [];

    const hasPathSeparators =
        file.includes("/") || file.includes("\\");

    const hasExtension =
        /\.[^./\\]+$/.test(file);

    const fileNames =
        hasPathSeparators || hasExtension
            ? [file]
            : [
                file,
                `${file}.png`,
                `${file}.jpg`,
                `${file}.jpeg`,
                `${file}.webp`,
                `${file}.gif`
            ];

    if (hasPathSeparators) {
        candidates.push(file);
    }

    for (const candidateFile of fileNames) {

        if (characterName && String(characterName).trim()) {

            const c =
                String(characterName).trim();

            if (String(folder || "").trim()) {

                candidates.push(
                    `${base}/${String(folder).trim()}/${c}/${candidateFile}`
                );

            } else {

                candidates.push(
                    `${base}/${c}/${candidateFile}`
                );
            }
        }
    }

    for (const src of candidates) {

        const ok =
            await verifyImageExists(src);

        if (ok) return src;
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
            return `../../bd/chars/${normalizedFolder}/${normalizedCharacterFolder}/${normalizedFileName}`;
        }

        if (normalizedFolder.length) {
            return `../../bd/chars/${normalizedFolder}/${cleanName}/${normalizedFileName}`;
        }

        if (normalizedCharacterFolder.length) {
            return `../../bd/chars/${normalizedCharacterFolder}/${normalizedFileName}`;
        }

        return `../../bd/chars/${cleanName}/${normalizedFileName}`;
    }

    return normalizedFileName;
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

function applyCharacterImage(imageElement, src, altText, token, pageContainer) {

    if (!imageElement) {
        return;
    }

    imageElement.hidden = true;
    imageElement.removeAttribute("src");
    imageElement.alt = "";

    if (!src) {
        return;
    }

    verifyImageExists(src).then(isAvailable => {

        if (pageContainer && token && pageContainer.dataset.characterImageToken !== token) {
            return;
        }

        if (!isAvailable) {
            imageElement.hidden = true;
            imageElement.removeAttribute("src");
            imageElement.alt = "";
            return;
        }

        imageElement.src = src;
        imageElement.alt = altText || "Personagem selecionado";
        imageElement.hidden = false;
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

function buildCharsNode(node, inheritedFolder = "", depth = 0) {

    if (!node || typeof node !== "object") {
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
    const rawTarget = String(node.target || node.content || node.path || "").trim();
    const characterFolder = isGroup
        ? ""
        : resolveCharacterFolderName(node.label || node.title || node.name || "", rawTarget);

    if (isGroup && Array.isArray(node.children) && node.children.length) {
        const isOpen = Boolean(node.open);
        const nextFolder = [
            inheritedFolder,
            node.folder || ""
        ]
        .filter(Boolean)
        .join("/")
        .trim();

        return `
        <details class="nav-group" data-depth="${depth}"${isOpen ? " open" : ""}>
            <summary class="nav-group-toggle">${label}</summary>
            <div class="nav-group-divider" aria-hidden="true"></div>
            <div class="nav-group-content nav-subtree" data-depth="${depth + 1}" style="--nav-depth:${depth + 1};">
                ${node.children.map(child => buildCharsNode(child, nextFolder, depth + 1)).join("")}
            </div>
        </details>
        `;
    }

    if (isGroup) {
        const visiblePath = escapeHtml(node.path || "");
        const targetPath = escapeHtml(resolveCharacterSkillPath(nodeFolder, rawTarget, characterFolder) || rawTarget);
        const kind = (node.kind || resolveContentMode(targetPath)).toString().toLowerCase();
        const defaultAttr = node.default ? " data-default" : "";
        const folderAttr = nodeFolder ? ` data-folder="${escapeHtml(nodeFolder)}"` : "";
        const characterFolderAttr = characterFolder ? ` data-character-folder="${escapeHtml(characterFolder)}"` : "";

        return `
        <button class="nav-group-toggle nav-group-leaf"
            data-md="${visiblePath}"
            data-target="${targetPath}"
            data-kind="${kind}" data-depth="${depth}"${folderAttr}${characterFolderAttr}${defaultAttr}>${label}</button>
        `;
    }

    const visiblePath = escapeHtml(node.path || "");
    const targetPath = escapeHtml(resolveCharacterSkillPath(nodeFolder, rawTarget, characterFolder) || rawTarget);
    const kind = (node.kind || resolveContentMode(targetPath)).toString().toLowerCase();
    const defaultAttr = node.default ? " data-default" : "";
    const folderAttr = nodeFolder ? ` data-folder="${escapeHtml(nodeFolder)}"` : "";
    const characterFolderAttr = characterFolder ? ` data-character-folder="${escapeHtml(characterFolder)}"` : "";

    return `
    <button
        data-target="${targetPath}" data-depth="${depth}"
        data-kind="${kind}"${folderAttr}${characterFolderAttr}${defaultAttr}>${label}</button>
    `;
}

async function initCharsNavigation() {

    const mount = document.querySelector("[data-chars-tree]");

    if (!mount) return;

    try {
        const response = await fetch("../../bd/chars.json");
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
    }
    catch (error) {
        console.error("Erro ao carregar chars.json:", error);
        mount.innerHTML = "<p>Não foi possível carregar os personagens.</p>";
    }
}

// =========================
// CONTENT CHANGE
// =========================

function changeContent(path, kind = "") {

    // Prefer dynamic content container for character selections so the
    // initial landing markdown (mkd-content) is not overwritten.
    const pageContainer = document.querySelector('.page_container');
    const dynamicEl = pageContainer?.querySelector('.page-dynamic, .chars-dynamic');
    const landingEl = pageContainer?.querySelector('.page-landing, .chars-landing');
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

    loadContent(path, element, kind);
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
    pageContainer.dataset.characterImageMode = "showcase";
    pageContainer.dataset.characterImageToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const showcaseSrc = button.getAttribute("data-showcase-src") || "";
    const combatSrc = button.getAttribute("data-combat-src") || "";
    const canSwap = Boolean(showcaseSrc && combatSrc);
    const currentToken = pageContainer.dataset.characterImageToken;

    if (header) {
        header.classList.add("has-showcase");
    }

    if (swapButton) {
        swapButton.hidden = !canSwap;
        swapButton.disabled = !canSwap;
        swapButton.dataset.mode = "showcase";
        swapButton.setAttribute("aria-pressed", "false");
        swapButton.setAttribute("aria-label", canSwap ? "Trocar para combate" : "Sem imagem de combate");
    }

    if (showcaseImage) {
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
            const folder = pageContainer.dataset.charFolder || "";
            const character = pageContainer.dataset.characterFolder || pageContainer.dataset.characterName || "";

            // Resolve showcase
            const resolvedShowcase = await resolveCharacterImageSrc(folder, character, pageContainer.dataset.showcaseImg || showcaseSrc, "showcase");

            if (resolvedShowcase) {
                pageContainer.dataset.showcaseSrc = resolvedShowcase;
                if (header) {
                    header.classList.add("has-showcase");
                }
                if (showcaseImage) applyCharacterImage(showcaseImage, resolvedShowcase, pageContainer.dataset.characterName || "Personagem selecionado", currentToken, pageContainer);
            }

            // Resolve combat
            const resolvedCombat = await resolveCharacterImageSrc(folder, character, pageContainer.dataset.combatImg || combatSrc, "combat");

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

    return nameElement;
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
    const headerInfo = nameElement?.parentElement;

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
    const safeCA = data.ca ? escapeHtml(data.ca) : "";
    const safeDescription = parseCustomTooltips(
        formatSkillInlineStyles(
            formatEffectReferences(escapeHtml(data.description || ""))
        )
    ).replace(/\n/g, "<br>");

    const buildResistance = (type, iconPath, resistance) => {
        if (!resistance) return "";

        const label = escapeHtml(resistance.label || "Normal");
        const multiplier = escapeHtml(resistance.multiplier || "");
        const tone = escapeHtml(resistance.tone || "normal");

        return `
            <div class="overview-item overview-item-resistance">
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
            <div class="overview-item">
                <img class="overview-icon" src="../../res/skills/hp.png" alt="Life">
                <span class="overview-main-value">${safeLife}</span>
            </div>
        `);
    }

    if (safeSpeed) {
        statusItems.push(`
            <div class="overview-item">
                <img class="overview-icon" src="../../res/skills/speed.png" alt="Speed">
                <span class="overview-main-value">${safeSpeed}</span>
            </div>
        `);
    }

    if (safeStagger) {
        statusItems.push(`
            <div class="overview-item">
                <img class="overview-icon" src="../../res/skills/stagger.png" alt="Stagger">
                <span class="overview-main-value">${safeStagger}</span>
            </div>
        `);
    }

    if (safeCA) {
        statusItems.push(`
            <div class="overview-item">
                <img class="overview-icon" src="../../res/skills/defense.png" alt="CA">
                <span class="overview-main-value">${safeCA}</span>
            </div>
        `);
    }

    // Build Resistances items conditionally
    const resistanceItems = [];

    resistanceItems.push(buildResistance("Blunt", "../../res/skills/blunt.png", data.resistances?.blunt));
    resistanceItems.push(buildResistance("Slash", "../../res/skills/slash.png", data.resistances?.slash));
    resistanceItems.push(buildResistance("Pierce", "../../res/skills/pierce.png", data.resistances?.pierce));

    // Filter out empty resistance entries
    const resistanceItemsFiltered = resistanceItems.filter(Boolean);

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

    if (safeDescription) {
        finalHtml += `
            <div class="overview-group">
                <p class="overview-group-title">Descrição</p>
                <div class="overview-description">${safeDescription}</div>
            </div>
        `;
    }

    overviewElement.innerHTML = finalHtml;

    overviewElement.classList.add("is-visible");
    syncCharacterOverviewViewport();
}

function syncCharacterSkillViewport() {

    const pageContainer = document.querySelector(".chars-page .page_container");
    const showcaseWrap = document.querySelector(".chars-page .chars-showcase-wrap");
    const dynamicEl = document.querySelector(".chars-page .chars-header .chars-dynamic");

    if (!pageContainer || !showcaseWrap || !dynamicEl) {
        return;
    }

    const hasSkillContent = Boolean(dynamicEl.querySelector(".skills-wrapper"));

    if (!pageContainer.classList.contains("skills-mode") && !hasSkillContent) {
        dynamicEl.style.maxHeight = "";
        dynamicEl.style.overflowY = "";
        dynamicEl.style.overflowX = "";
        return;
    }

    window.requestAnimationFrame(() => {
        const showcaseRect = showcaseWrap.getBoundingClientRect();
        const dynamicRect = dynamicEl.getBoundingClientRect();
        const availableHeight = Math.floor(showcaseRect.bottom - dynamicRect.top - 4);

        dynamicEl.style.overflowY = "auto";
        dynamicEl.style.overflowX = "hidden";
        dynamicEl.style.maxHeight = `${Math.max(120, availableHeight)}px`;
    });
}

function syncCharacterOverviewViewport() {

    const showcaseWrap = document.querySelector(".chars-page .chars-showcase-wrap");
    const descriptionEl = document.querySelector(".chars-page .chars-overview-strip .overview-description");

    if (!showcaseWrap || !descriptionEl) {
        return;
    }

    const overviewStrip = descriptionEl.closest(".chars-overview-strip");

    if (!overviewStrip || !overviewStrip.classList.contains("is-visible")) {
        descriptionEl.style.maxHeight = "";
        descriptionEl.style.overflowY = "";
        descriptionEl.style.overflowX = "";
        return;
    }

    window.requestAnimationFrame(() => {
        const showcaseRect = showcaseWrap.getBoundingClientRect();
        const descriptionRect = descriptionEl.getBoundingClientRect();
        const availableHeight = Math.floor(showcaseRect.bottom - descriptionRect.top - 4);

        descriptionEl.style.overflowY = "auto";
        descriptionEl.style.overflowX = "hidden";
        descriptionEl.style.maxHeight = `${Math.max(80, availableHeight)}px`;
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

function initMarkdownButtons() {

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

        updateSelectedCharacterAssets(button);
        setCharacterHeaderName(button.textContent || "");
        setCharacterOverviewData(null);
        clearDynamicCharacterContent();

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
        
            // Limpa/reseta ANTES de carregar o conteúdo
            setActiveButton(button, { openAncestors: true });
        
            // Agora carrega o .skill corretamente
            changeContent(path, kind);
            
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
            changeContent(path, kind);
        }

        return;
    }

    if (showcaseButton) {

        const path = resolveContentTarget(showcaseButton);
        const kind = showcaseButton.getAttribute("data-kind");

        if (path) {
            setActiveButton(showcaseButton, { openAncestors: true });
            changeContent(path, kind);
        }

        return;
    }

    if (!hasDirectMarkdown) {

        const initialButton = buttons[0];

        if (initialButton) {

            const path = resolveContentTarget(initialButton);
            const kind = initialButton.getAttribute("data-kind");

            setActiveButton(initialButton, { openAncestors: true });
            changeContent(path, kind);
        }
    }
}

// =========================
// SECTION TABS
// =========================

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
            const pageContainer = document.querySelector(".chars-page .page_container");
            const dynamicEl = pageContainer?.querySelector(".chars-dynamic");
            const landingEl = pageContainer?.querySelector(".chars-landing");

            // Gerencia visibilidade do submenu de Skills
            const submenu = document.querySelector(".chars-page .chars-skills-submenu");
            if (submenu) submenu.classList.remove("is-visible");

            // Gerencia visibilidade do bloco 'Status' (overview)
            const overviewEl = document.querySelector(".chars-page .chars-overview-strip");
            if (overviewEl) overviewEl.classList.remove("is-visible");

            if (tabText === "Overview") {
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
            else if (tabText === "Skills") {
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
                        const activeSkillBtn = submenu.querySelector('.chars-skill-option.active') || submenu.querySelector('.chars-skill-option');
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
            else if (tabText === "Armas") {
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

                const dynamicElArmas = mount || pageContainer.querySelector('.chars-dynamic');
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
            else if (tabText === "E.G.O") {
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

                const dynamicElEgo = mount || pageContainer.querySelector('.chars-dynamic');
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

            const dynamicEl = mount || pageContainer.querySelector('.chars-dynamic');

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

                    // Wait one frame to allow browser layout, then scroll the first card into view inside the mount
                    window.requestAnimationFrame(() => {
                        try {
                            const onlyTarget = dynamicEl.querySelector('.skill-card-row');
                            if (onlyTarget) {
                                onlyTarget.scrollIntoView({ behavior: 'auto', block: 'start' });
                                // also ensure container top is zero
                                dynamicEl.scrollTop = 0;
                            }
                        } catch (e) {}
                    });
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

    // Determine search root: prefer provided wrapper, otherwise search mounted dynamic content or document
    const searchRoot = wrapper || document.querySelector('.chars-dynamic') || document;

    let hasAnyEnabled = false;

    buttons.forEach(btn => {
        const type = (btn.getAttribute('data-skill-type') || 'skill').toLowerCase();

        let enabled = false;

        if (type === 'skill') {
            const idx = parseInt(btn.getAttribute('data-skill-index'));
            const desiredMp = !isNaN(idx) ? String(idx + 1) : null;
                if (desiredMp) {
                enabled = Boolean(searchRoot.querySelector(`.skill-card-row[data-mp="${desiredMp}"]:not(.weapon-row):not(.ego-row)`));
            }
        } else if (type === 'passives') {
            enabled = Boolean(searchRoot.querySelector('.skills-passives-section:not(.skills-ego-passives-section) .skill-card-row.passive-row'));
        } else if (type === 'defense') {
            enabled = Boolean(searchRoot.querySelector('.skill-card-row.defense-row'));
        }

        if (enabled) {
            btn.classList.remove('disabled');
            btn.removeAttribute('disabled');
            hasAnyEnabled = true;
        } else {
            btn.classList.add('disabled');
            try { btn.setAttribute('disabled', 'true'); } catch (e) {}
        }
    });

    // Disable/enable the main "Skills" tab button based on whether any kit content exists
    const sectionTabs = document.querySelectorAll('.chars-page .chars-section-tab');
    if (sectionTabs.length) {
        sectionTabs.forEach(tab => {
            if (tab.textContent && tab.textContent.trim() === 'Skills') {
                if (!hasAnyEnabled) {
                    tab.classList.add('disabled');
                    try { tab.setAttribute('disabled', 'true'); } catch (e) {}
                } else {
                    tab.classList.remove('disabled');
                    tab.removeAttribute('disabled');
                }
            }
        });
    }
}

function updateWeaponsTabAvailability(wrapper = null) {
    const sectionTabs = document.querySelectorAll('.chars-page .chars-section-tab');
    if (!sectionTabs.length) return;

    const searchRoot = wrapper || document.querySelector('.chars-dynamic') || document;
    const hasWeapons = Boolean(searchRoot.querySelector('.skill-card-row.weapon-row'));

    sectionTabs.forEach(tab => {
        if (tab.textContent && tab.textContent.trim() === 'Armas') {
            if (!hasWeapons) {
                tab.classList.add('disabled');
                try { tab.setAttribute('disabled', 'true'); } catch (e) {}
            } else {
                tab.classList.remove('disabled');
                tab.removeAttribute('disabled');
            }
        }
    });
}

function updateEgoTabAvailability(wrapper = null) {
    const sectionTabs = document.querySelectorAll('.chars-page .chars-section-tab');
    if (!sectionTabs.length) return;

    const searchRoot = wrapper || document.querySelector('.chars-dynamic') || document;
    const hasEgo = Boolean(searchRoot.querySelector('.skill-card-row.ego-row, .skills-ego-passives-section .skill-card-row.passive-row'));

    sectionTabs.forEach(tab => {
        if (tab.textContent && tab.textContent.trim() === 'E.G.O') {
            if (!hasEgo) {
                tab.classList.add('disabled');
                try { tab.setAttribute('disabled', 'true'); } catch (e) {}
            } else {
                tab.classList.remove('disabled');
                tab.removeAttribute('disabled');
            }
        }
    });
}

// =========================
// TOOLTIP SYSTEM
// =========================

let tooltipData = {};
let tooltipLookup = {};

const SCRIPT_BASE_URL = new URL(
    ".",
    document.currentScript?.src || window.location.href
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
    condition: "#2f7d44"
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

tooltip.classList.add("tooltip-box");

document.body.appendChild(tooltip);

function initTooltips() {

    let activeTooltipTarget = null;

    const isTooltipVisible =
        () => tooltip.classList.contains("is-visible");

    const formatTooltipMarkup = (text) => {

        let formattedText = String(text || "");

        // Escape básico
        formattedText = formattedText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Quebra de linha
        formattedText = formattedText.replace(
            /\\n/g,
            "<br>"
        );

        // c(#fff){Texto}
        formattedText = formattedText.replace(
            /c\((#[0-9a-fA-F]{3,8})\)\{([\s\S]+?)\}/g,
            '<span style="color:$1;">$2</span>'
        );

        // _***underline + bold + italic***_
        formattedText = formattedText.replace(
            /_\*\*\*~([\s\S]+?)~\*\*\*_/g,
            '<u><b><i>$1</i></b></u>'
        );

        // ***~bold + italic~***
        formattedText = formattedText.replace(
            /\*\*\*~([\s\S]+?)~\*\*\*/g,
            '<b><i>$1</i></b>'
        );

        // _**underline + bold**_
        formattedText = formattedText.replace(
            /_\*\*([\s\S]+?)\*\*_/g,
            '<u><b>$1</b></u>'
        );

        // **_bold + underline_**
        formattedText = formattedText.replace(
            /\*\*_([\s\S]+?)_\*\*/g,
            '<b><u>$1</u></b>'
        );

        // _~underline + italic~_
        formattedText = formattedText.replace(
            /_~([\s\S]+?)~_/g,
            '<u><i>$1</i></u>'
        );

        // ~_italic + underline_~
        formattedText = formattedText.replace(
            /~_([\s\S]+?)_~/g,
            '<i><u>$1</u></i>'
        );

        // _underline_
        formattedText = formattedText.replace(
            /_([\s\S]+?)_/g,
            '<u>$1</u>'
        );

        // **bold**
        formattedText = formattedText.replace(
            /\*\*([\s\S]+?)\*\*/g,
            '<b>$1</b>'
        );

        // ~italic~
        formattedText = formattedText.replace(
            /~([\s\S]+?)~/g,
            '<i>$1</i>'
        );

        return formattedText;
    };

    const showTooltip = (target, tooltipEntry) => {

    activeTooltipTarget = target;

    const formattedText = formatTooltipMarkup(
        tooltipEntry.text
    );

    tooltip.innerHTML = formattedText;

    tooltip.scrollTop = 0;

    tooltip.classList.add("is-visible");
};

    const hideTooltip = () => {

        activeTooltipTarget = null;

        tooltip.classList.remove("is-visible");
    };

    document.addEventListener("mouseover", (e) => {

        const target =
            e.target.closest("[data_tooltip]");

        if (!target) return;

        const key =
            target.getAttribute("data_tooltip");

        showTooltip(
            target,
            resolveTooltipEntry(key)
        );
    });

    document.addEventListener("mousemove", (e) => {

        const target =
            e.target.closest("[data_tooltip]");

        if (!target && !tooltip.contains(e.target))
            return;

        if (tooltip.contains(e.target))
            return;

        const padding = 12;

        const offset = 20;

        const tooltipWidth = tooltip.offsetWidth;

        const tooltipHeight = tooltip.offsetHeight;

        let x = e.clientX + offset;

        let y = e.clientY + offset;

        if (x + tooltipWidth > window.innerWidth - padding) {
            x = e.clientX - tooltipWidth - offset;
        }

        if (y + tooltipHeight > window.innerHeight - padding) {
            y = e.clientY - tooltipHeight - offset;
        }

        x = Math.max(
            padding,
            Math.min(
                x,
                window.innerWidth - tooltipWidth - padding
            )
        );

        y = Math.max(
            padding,
            Math.min(
                y,
                window.innerHeight - tooltipHeight - padding
            )
        );

        tooltip.style.left = x + "px";

        tooltip.style.top = y + "px";
    });

    document.addEventListener("mouseout", (e) => {

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

    document.addEventListener("wheel", (e) => {

        if (!isTooltipVisible()) return;

        const overTooltip =
            tooltip.matches(":hover") ||
            tooltip.contains(e.target);

        const overActiveTerm =
            Boolean(
                activeTooltipTarget?.isConnected &&
                activeTooltipTarget.matches(":hover")
            );

        const tooltipCanScroll =
            tooltip.scrollHeight > tooltip.clientHeight;

        if (!overTooltip && !overActiveTerm)
            return;

        if (!tooltipCanScroll)
            return;

        e.preventDefault();

        e.stopPropagation();

        tooltip.scrollTop += e.deltaY;

    }, {
        passive: false,
        capture: true
    });
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
    let mode = null;
    let started = false;
    let inPassives = false;
    let inDefense = false;
    let inWeapons = false;
    let inEgo = false;
    const skillSections = [];
    const passiveSections = [];
    const egoPassiveSections = [];
    const defenseSections = [];
    const weaponSections = [];
    const egoSections = [];
    let skillsCount = 0;

    const pushCurrentPassive = () => {

        if (!currentPassive) {
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
        "(on_evade)": `<color ="#d7d713"><b>[Ao Esquivar]</b></color>`,
        "(combat_start)": `<color ="#d7d713"><b>[Ínicio do Combate]</b></color>`,

        "(on_hit)": `<color ="#FFFF00">[Em um Acerto]</color>`,
        "(on_clash_win)": `<color ="#FFFF00">[Ao Ganhar o Clash]</color>`,
        "(on_clash_lose)": `<color ="#ff1d1d">[Ao Perder o Clash]</color>`,
        "(on_nohit)": `<color ="#d42727">[Ao Errar]</color>`,
        "(on_crit)": `<color ="#cfcf34">[Em um Crítico]</color>`,
        "(on_crit10)": `<color ="#14d758">[Em um Crítico Natural]</color>`,
        "(turn_end)": `<color ="#8f7fb4"><b>[Fim do Turno]</b></color>`,
        "(skill_end)": `<color ="#d2be05"><b>[Fim da Skill]</b></color>`,

        "(hability)": `<color ="#ffffff"><b>[Habilidade]</b></color>`
    };

    const sinColorMap =
    {
        wrath: "#ff3e3e",
        lust: "#FFA500",
        sloth: "#FFFF00",
        gloom: "#94a2f2",
        pride: "#10003f",
        envy: "#3dbb78",
        gluttony: "#5eff00"
    };

    // Extract character name from sourcePath (e.g., "/bd/chars/moon_office/axel.skill" -> "axel")
    const characterMatch = sourcePath.match(/\/bd\/chars\/(?:[^/]+\/)*([^/]+)\.skill$/);
    const character = characterMatch ? characterMatch[1] : null;

    function formatEffects(text) {

        return text.replace(
                /@\{([^}]+)\}(?:\(([^)]+)\))?|@([A-Za-z0-9_&-]+)(?:\(([^)]+)\))?/g,

            (
                match,
                complexEffect,
                complexFolder,
                simpleEffect,
                simpleFolder
            ) => {

                const effect =
                    (complexEffect || simpleEffect).trim();

                const folder =
                    (complexFolder || simpleFolder || "").trim();

                const imageName =
                    effect.replace(/\s+/g, "_");

                const path = folder.length
                    ? `../../res/effects/${folder}/${imageName}.png`
                    : `../../res/effects/${imageName}.png`;

                let tooltipKey =
                    normalizeLookupKey(effect);

                if (folder.length) {
                    tooltipKey =
                        `${normalizeLookupKey(folder)}_${tooltipKey}`;
                }

                const effectColor = getEffectTextColor(tooltipKey);
                const effectEntry = effectData[tooltipKey] || {};
                const effectDisplay = effect.replace(/_/g, " ");
                const effectName = effectEntry.noUnderline
                    ? `<color="${effectColor}">${effectDisplay}</color>`
                    : `<span style="color:${effectColor}; text-decoration: underline; text-decoration-color: ${effectColor}; text-decoration-thickness: from-font; text-underline-offset: 0.08em; text-decoration-skip-ink: auto;">${effectDisplay}</span>`;

                return `[<img class="effect-icon" src="${path}" onerror="this.remove()">${effectName}]{${tooltipKey}}`;
            }
        );
    }

    function formatSkillText(text) {

        let formatted = text;

        formatted = formatted.replace(
            /atkw\((\d+)\)/gi,
            (match, value) => {
                const count = Math.max(0, Number.parseInt(value, 10) || 0);

                if (!count) {
                    return match;
                }

                return `<span class="skill-atkw">${"⯀".repeat(count)}</span>`;
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
    if (charFolder && characterName) {

        return `../../bd/chars/${charFolder}/${characterName}/${finalFile}`;
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

        if (charFolder && characterName) {
            return `../../bd/chars/${charFolder}/${characterName}/${candidate}`;
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

        const type = String(def?.type || def?._defenseIcon || "").trim().toLowerCase();

        switch (type) {
            case "evade":
            case "evader":
                return "../../res/skills/evade.png";
            case "clash":
            case "counter":
                return "../../res/skills/counter.png";
            case "defense":
                return "../../res/skills/defense.png";
            default:
                return "../../res/skills/defense.png";
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

    function buildSkill(skill) {

        const sinBase = sinMap[skill.sin] || sinMap.gloom;
        const skillColor = sinColorMap[skill.sin] || "#b9782d";

        let slotIconHtml = "";
        if (skill._isDefense) {
            const iconPath = resolveDefenseCenterIconPath(skill);

            if (iconPath) {
                slotIconHtml = `
                 <img class="slot-center-icon slot-defense-icon"
                     src="${iconPath}"
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

            if (iconPath) {
                slotIconHtml = `
                 <img class="slot-center-icon${usesSinAffinityIcon ? " slot-sin-affinity" : ""}"
                     src="${iconPath}"
                     width="88"
                     onerror="this.remove()">
                `;
            }
        }

        let coinsHtml = "";
        let coinTextHtml = "";
        let coinsTopHtml = "";
        const normalizedDefenseType = String(skill.type || "").trim().toLowerCase();
        const normalizedDefenseDmgType = String(skill.dmg_type || "").trim().toLowerCase();
        const showDefenseDmgType = Boolean(
            skill._isDefense
            && (normalizedDefenseType === "clash" || normalizedDefenseType === "counter")
            && dmgMap[normalizedDefenseDmgType]
        );

        skill.coins.forEach((coin, index) => {

            const coinText = String(coin.text || "").trim();
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
        const costText = (skill._isWeapon || skill._isEgo)
            ? String(skill.flavor || "").trim()
            : (skill._defenseLabel || `Skill ${skill.c_mp || skill.mp}`);
        const weaponHitText = skill._isWeapon ? String(skill.hit || "").trim() : "";
        const weaponDmgText = skill._isWeapon ? String(skill.dmg || "").trim() : "";
        const egoRiskPath = skill._isEgo ? resolveEgoRiskIconPath(skill.level) : "";
        const egoCostHtml = skill._isEgo && Array.isArray(skill.cost) && skill.cost.length
            ? `
                <div class="skill-ego-costs">
                    ${skill.cost.map(cost => {
                        const iconPath = resolveEgoCostIconPath(cost.sin);
                        const value = escapeHtml(cost.value || "");

                        if (!iconPath || !value.length) {
                            return "";
                        }

                        return `
                            <div class="skill-ego-cost-item">
                                <img src="${iconPath}" alt="${escapeHtml(cost.sin || "")}" width="20">
                                <span>x${value}</span>
                            </div>
                        `;
                    }).join("")}
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

                     ${skill._isDefense && !showDefenseDmgType ? "" : `
                     <img class="slot-dmgtype"
                         src="${showDefenseDmgType ? dmgMap[normalizedDefenseDmgType] : (skill._defenseIcon || dmgMap[skill._isWeapon ? skill.dmg_type : skill.dmg])}"
                         width="56">
                     `}

                </div>

                ${egoRiskPath ? `
                <div class="skill-ego-risk">
                    <img src="${egoRiskPath}" alt="${escapeHtml(skill.level || "")}" width="76">
                </div>
                ` : ""}

                ${egoCostHtml}
            </div>
            ` : `
            <div class="skill-slot">

                <img class="slot-base"
                     src="${slotBaseSrc}"
                     width="128">

                <img class="slot-background"
                     src="${slotBackgroundSrc}"
                     width="128">

                 ${slotIconHtml}

                 ${skill._isDefense && !showDefenseDmgType ? "" : `
                 <img class="slot-dmgtype"
                     src="${showDefenseDmgType ? dmgMap[normalizedDefenseDmgType] : dmgMap[skill._isWeapon ? skill.dmg_type : skill.dmg]}"
                     width="56">
                 `}

            </div>
            `}

            <div class="skill_description">

                <div class="skill-coins-row">
                    ${coinsHtml}
                </div>

                ${coinsTopHtml}

                <div class="skill-name-wrap" style="--skill-main:${skillColor};">
                    ${costText.length ? `<p class="skill-cost-label skill-cost-${costClass}">${costText}</p>` : ""}

                    <p class="skill-name">
                        ${skill.title}
                    </p>
                </div>

                ${weaponHitText.length ? `<div class="weapon-hit-label"><img src="../../res/skills/hit.png" alt="hit" width="28"> <span>${weaponHitText}</span></div>` : ""}

                ${weaponDmgText.length ? `<div class="weapon-dmg-label"><img src="../../res/skills/dmg.png" alt="dmg" width="28"> <span>${weaponDmgText}</span></div>` : ""}

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

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];

        // =========================
        // SKILL START
        // =========================

        if (line === "!skills-start") {

            pushCurrentPassive();

            started = true;

            currentSkill = {
                title: "",
                sin: "",
                dmg: "",
                mp: "",
                c_mp: "",
                c_img: "",
                img: "",
                info: [],
                end: [],
                coins: []
            };

            currentPassive = null;
            inPassives = false;
            inWeapons = false;
            passiveSections.length = 0;

            continue;
        }

        if (line === "!weapons-start") {

            pushCurrentPassive();

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
                info: [],
                end: [],
                coins: []
            };

            continue;
        }

        if (line === "!ego-start") {

            pushCurrentPassive();

            // Allow multiple independent E.G.O blocks in the same .skill file.
            // If a previous E.G.O was left open, persist it before starting a new one.
            if (currentEgo) {
                egoSections.push(currentEgo);
                currentEgo = null;
            }

            started = true;
            inEgo = true;
            inPassives = false;
            inDefense = false;
            inWeapons = false;
            mode = null;

            currentEgo = {
                title: "",
                flavor: "",
                hit: "",
                sin: "sinless",
                dmg: "slash",
                mp: "3",
                level: "",
                c_mp: "",
                c_img: "",
                cost: [],
                info: [],
                end: [],
                coins: []
            };

            continue;
        }

        if (line === "!ego-end") {

            pushCurrentPassive();

            if (currentEgo) {
                egoSections.push(currentEgo);
                currentEgo = null;
            }

            inEgo = false;
            mode = null;

            continue;
        }

        if (line === "!weapons-end") {

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

        if (line === "!skills-end") {

            pushCurrentPassive();

            if (currentSkill) {
                skillSections.push(currentSkill);
                currentSkill = null;
            }

            inPassives = true;
            mode = null;

            continue;
        }

        if (line === "!defense-start") {

            pushCurrentPassive();

            inDefense = true;
            inWeapons = false;
            mode = null;

            continue;
        }

        if (line === "!defense-end") {

            pushCurrentPassive();

            if (currentDefense) {
                defenseSections.push(currentDefense);
                currentDefense = null;
            }

            inDefense = false;
            mode = null;

            continue;
        }

        if (line === "!passives-start") {

            pushCurrentPassive();

            inPassives = true;
            mode = null;

            continue;
        }

        if (line === "!passives-end") {

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
                    sin: "",
                    dmg: "",
                    mp: "",
                    c_mp: "",
                    c_img: "",
                    info: [],
                    end: [],
                    coins: []
                };
            }

            continue;
        }

        if (!started || (!currentSkill && !currentWeapon && !currentEgo && !currentPassive && !inPassives && !inDefense && !inWeapons && !inEgo))
            continue;

        if ((inPassives || inEgo) && line.startsWith("passive(")) {

            pushCurrentPassive();

            const passiveTitle = line
                .replace(/^passive\(/, "")
                .replace(/\)\s*\{$/, "")
                .replace(/\)$/, "")
                .trim();

            currentPassive = {
                title: passiveTitle,
                text: [],
                _target: inEgo ? "ego" : "normal"
            };

            mode = "passive";

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
                info: [],
                end: [],
                coins: [],
                _defenseIcon: defenseIconMap['evade']
            };

            mode = "info";

            continue;
        }

        // =========================
        // PROPERTIES
        // =========================

        if (line.startsWith("title:") && currentSkill) {
            currentSkill.title =
                line.replace("title:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("title:") && currentWeapon) {
            currentWeapon.title =
                line.replace("title:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("title:") && currentEgo) {
            currentEgo.title =
                line.replace("title:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("flavor:") && currentEgo) {
            currentEgo.flavor =
                line.replace("flavor:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("hit:") && currentEgo) {
            const rawHit = line
                .replace("hit:", "")
                .replace(";", "")
                .trim();

            currentEgo.hit = formatSkillText(rawHit);
        }

        if (line.startsWith("title:") && inWeapons && !currentWeapon) {
            const t = line.replace("title:", "").replace(";", "").trim();
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
                info: [],
                end: [],
                coins: []
            };
        }

        if (line.startsWith("title:") && inEgo && !currentEgo) {
            const t = line.replace("title:", "").replace(";", "").trim();
            currentEgo = {
                title: t,
                flavor: "",
                hit: "",
                sin: "sinless",
                dmg: "slash",
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

        if (line.startsWith("flavor:") && currentWeapon) {
            currentWeapon.flavor =
                line.replace("flavor:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("dmg_type:") && currentWeapon) {
            const rawDmgType = line
                .replace("dmg_type:", "")
                .replace(";", "")
                .trim();

            if (currentWeapon._pendingDmgText) {
                currentWeapon.dmg = formatSkillText(currentWeapon._pendingDmgText);
            }

            currentWeapon.dmg_type = rawDmgType;
            currentWeapon._hasExplicitWeaponFields = true;
            currentWeapon._pendingDmgText = "";
        }

        if (line.startsWith("hit:") && currentWeapon) {
            const rawHit = line
                .replace("hit:", "")
                .replace(";", "")
                .trim();

            currentWeapon.hit = formatSkillText(rawHit);
            currentWeapon._hasExplicitWeaponFields = true;
        }

        if (line.startsWith("title:") && inDefense && !currentDefense) {
            const t = line.replace("title:", "").replace(";", "").trim();
            currentDefense = {
                title: t,
                sin: "",
                dmg: "",
                dmg_type: "",
                mp: "1",
                c_mp: "1",
                c_img: "",
                info: [],
                end: [],
                coins: [],
                type: 'evade',
                _defenseIcon: defenseIconMap['evade']
            };
        }

        if (line.startsWith("sin:") && currentSkill) {
            currentSkill.sin =
                line.replace("sin:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("sin:") && currentWeapon) {
            currentWeapon.sin =
                line.replace("sin:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("sin:") && currentEgo) {
            currentEgo.sin =
                line.replace("sin:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("sin:") && currentDefense) {
            currentDefense.sin =
                line.replace("sin:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("type:") && currentDefense) {
            const t = line.replace("type:", "").replace(";", "").trim();
            currentDefense.type = t;
            currentDefense._defenseIcon = defenseIconMap[t] || defenseIconMap['evade'];
        }

        if (line.startsWith("dmg:") && currentSkill) {
            currentSkill.dmg =
                line.replace("dmg:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("dmg:") && currentWeapon) {
            const rawValue = line
                .replace("dmg:", "")
                .replace(";", "")
                .trim();

            if (currentWeapon._hasExplicitWeaponFields) {
                currentWeapon.dmg = formatSkillText(rawValue);
            }
            else {
                currentWeapon._pendingDmgText = rawValue;
            }
        }

        if (line.startsWith("dmg:") && currentEgo) {
            currentEgo.dmg =
                line.replace("dmg:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("dmg_type:") && currentDefense) {
            currentDefense.dmg_type =
                line.replace("dmg_type:", "")
                    .replace(";", "")
                    .trim()
                    .toLowerCase();
        }

        if (line.startsWith("mp:") && currentSkill) {
            currentSkill.mp =
                line.replace("mp:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("mp:") && currentWeapon) {
            currentWeapon.mp =
                line.replace("mp:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("mp:") && currentEgo) {
            currentEgo.mp =
                line.replace("mp:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("level:") && currentEgo) {
            const rawLevel = line
                .replace("level:", "")
                .replace(";", "")
                .trim()
                .toLowerCase();

            const allowedLevels = ["zayin", "teth", "he", "waw", "aleph", "unknow", "undef"];
            currentEgo.level = allowedLevels.includes(rawLevel) ? rawLevel : "";
        }

        if (line.startsWith("cost") && currentEgo) {
            mode = "cost";
            continue;
        }

        if (line.startsWith("c_mp:") && currentSkill) {
            currentSkill.c_mp =
                line.replace("c_mp:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("c_mp:") && currentWeapon) {
            currentWeapon.c_mp =
                line.replace("c_mp:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("c_mp:") && currentEgo) {
            currentEgo.c_mp =
                line.replace("c_mp:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("c_img:") && currentSkill) {
            currentSkill.c_img =
                line.replace("c_img:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("img:") && currentSkill) {
            currentSkill.img =
                line.replace("img:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("c_img:") && currentWeapon) {
            currentWeapon.c_img =
                line.replace("c_img:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("c_img:") && currentEgo) {
            currentEgo.c_img =
                line.replace("c_img:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("img:") && currentWeapon) {
            currentWeapon.img =
                line.replace("img:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("img:") && currentEgo) {
            currentEgo.img =
                line.replace("img:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("c_img:") && currentDefense) {
            currentDefense.c_img =
                line.replace("c_img:", "")
                    .replace(";", "")
                    .trim();
        }

        if (line.startsWith("img:") && currentDefense) {
            currentDefense.img =
                line.replace("img:", "")
                    .replace(";", "")
                    .trim();
        }

        // =========================
        // INFO
        // =========================

        if (line.startsWith("info")) {
            mode = "info";
            continue;
        }

        // =========================
        // END
        // =========================
        
        if (line.startsWith("end")) {
            mode = "end";
            continue;
        }

        // =========================
        // COIN
        // =========================

        if (line.startsWith("coin")) {

            // support coin type flags: (u) unbreakable, (e) excision, (s) sever
            let coinType = "normal";
            if (line.includes("(u)")) coinType = "unbreakable";
            else if (line.includes("(e)")) coinType = "excision";
            else if (line.includes("(s)")) coinType = "sever";

            const target = currentDefense || currentWeapon || currentEgo || currentSkill;

            // If there's no active skill or defense, ignore the coin block
            if (!target) {
                mode = null; // skip content until closing brace
                continue;
            }

            target.coins.push({
                type: coinType,
                text: ""
            });

            mode = "coin";

            continue;
        }

        // =========================
        // BLOCK START/END
        // =========================

        if (line === "{") continue;

        if (line === "}") {
            mode = null;
            continue;
        }

        // =========================
        // CONTENT
        // =========================

        const formatted = formatSkillText(line);

        if (mode === "cost" && currentEgo) {
            const rawCost = String(line || "").replace(/;\s*$/, "").trim();

            if (rawCost.length) {
                const costMatch = rawCost.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);

                if (costMatch) {
                    currentEgo.cost.push({
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

    if (weaponSections.length) {
        html += `<div class="skills-weapons-section">`;
        weaponSections.forEach((weapon) => {
            weapon._isWeapon = true;
            html += buildSkill(weapon);
        });

        html += `</div>`;
    }

    if (weaponSections.length && (skillSections.length || passiveSections.length || defenseSections.length || egoSections.length)) {
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
        html += `<div class="skills-passives-section"><br>`;
        passiveSections.forEach((passive) => {
            html += buildPassive(passive);
        });

        html += `</div>`;
    }

    if (defenseSections.length) {
        html += `<div class="skills-defense-section">`;
        // render defenses using buildSkill so they behave exactly like normal skills
        defenseSections.forEach((def) => {
            // ensure label is a capitalized type name when present
            if (def.type) {
                def._defenseLabel = def.type.charAt(0).toUpperCase() + def.type.slice(1);
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

    html += `</div>`;

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

        await initCharsNavigation();

        initCharacterShowcaseSwap();
        initMarkdownButtons();
        
        initSectionTabs();
        initSkillSubmenu();

        window.addEventListener("resize", syncCharacterSkillViewport);
        window.addEventListener("resize", syncCharacterOverviewViewport);
    }
);