const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");

const rootDir = __dirname;
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".skill": "text/plain; charset=utf-8",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif"
};

function sendText(response, statusCode, text, contentType = "text/plain; charset=utf-8") {
    response.writeHead(statusCode, { "Content-Type": contentType });
    response.end(text);
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify(data, null, 2));
}

function getStaticPath(requestPath) {
    const normalizedPath = decodeURIComponent(requestPath.split("?")[0]);
    const relativePath = normalizedPath === "/" ? "/editor.html" : normalizedPath;
    const resolvedPath = path.resolve(rootDir, `.${relativePath}`);
    const relative = path.relative(rootDir, resolvedPath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return null;
    }

    return resolvedPath;
}

async function readBody(request) {
    const chunks = [];

    for await (const chunk of request) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString("utf8");
}

function normalizeFsSegment(value, fallback = "") {
    const normalized = String(value || "")
        .trim()
        .replace(/[\\/:*?"<>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return normalized || fallback;
}

function resolveCharsDirPath(relativePath) {
    const baseDir = path.resolve(rootDir, "bd", "chars");
    const segments = String(relativePath || "")
        .split(/[\\/]+/)
        .map(segment => segment.trim())
        .filter(Boolean)
        .filter(segment => segment !== "." && segment !== "..");

    const resolved = path.resolve(baseDir, ...segments);

    if (resolved !== baseDir && !resolved.startsWith(`${baseDir}${path.sep}`)) {
        throw new Error("Caminho de imagem inválido.");
    }

    return resolved;
}

function resolveImageExtension(originalName = "", mimeType = "") {
    const extensionFromName = path.extname(String(originalName || "").trim()).toLowerCase();

    if (extensionFromName) {
        return extensionFromName;
    }

    const normalizedMimeType = String(mimeType || "").toLowerCase();

    if (normalizedMimeType === "image/png") return ".png";
    if (normalizedMimeType === "image/jpeg") return ".jpg";
    if (normalizedMimeType === "image/jpg") return ".jpg";
    if (normalizedMimeType === "image/webp") return ".webp";
    if (normalizedMimeType === "image/gif") return ".gif";

    return ".png";
}

function isImageFileName(fileName) {
    return /\.(png|jpe?g|webp|gif)$/i.test(String(fileName || ""));
}

function getNormalizedImageFileName(originalName = "", mimeType = "") {
    const rawName = String(originalName || "").trim();
    const parsed = path.parse(rawName);
    const baseName = normalizeFsSegment(parsed.name || rawName, "imagem");
    const extension = resolveImageExtension(rawName, mimeType);

    return `${baseName}${extension}`;
}

function getSafeImageFileName(fileName = "") {
    const safeName = path.basename(String(fileName || "").trim());

    if (!safeName || safeName === "." || safeName === "..") {
        throw new Error("Nome de arquivo inválido.");
    }

    if (!isImageFileName(safeName)) {
        throw new Error("Apenas arquivos de imagem são permitidos.");
    }

    return safeName;
}

function isProtectedImageBaseName(fileName = "") {
    const baseName = path.parse(String(fileName || "")).name.toLowerCase();
    return baseName === "showcase" || baseName === "combat";
}

async function removeImageVariants(dirPath, baseName) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isFile()) continue;

            const lowerName = entry.name.toLowerCase();
            if (lowerName.startsWith(`${baseName.toLowerCase()}.`)) {
                await fs.rm(path.join(dirPath, entry.name), { force: true });
            }
        }
    } catch (error) {
        // ignore cleanup failures
    }
}

async function renamePathPreservingContents(sourcePath, targetPath) {
    if (!sourcePath || !targetPath || sourcePath === targetPath) {
        return;
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    try {
        await fs.rename(sourcePath, targetPath);
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return;
        }

        if (error && error.code === "EXDEV") {
            await fs.cp(sourcePath, targetPath, { recursive: true });
            await fs.rm(sourcePath, { recursive: true, force: true });
            return;
        }

        throw error;
    }
}

async function listCharacterExtraImages(dirPath) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        return entries
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .filter(name => isImageFileName(name))
            .filter(name => {
                const base = path.parse(name).name.toLowerCase();
                return base !== "showcase" && base !== "combat";
            })
            .sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
    } catch (error) {
        return [];
    }
}

function getGroupFolderName(node) {
    return normalizeFsSegment(node && (node.folder || node.label), "Nova Pasta");
}

function getCharacterFolderName(node) {
    return normalizeFsSegment(node && (node.label || node.target), "Novo Personagem");
}

function getCharacterTargetName(node) {
    const rawTarget = String(node && node.target || "")
        .trim()
        .replace(/\.skill$/i, "");

    const baseName = normalizeFsSegment(
        rawTarget || (node && (node.label || node.target)),
        "novo personagem"
    ).toLowerCase();

    return `${baseName}.skill`;
}

async function ensureFileExists(filePath, content = "") {
    try {
        await fs.access(filePath);
    } catch (error) {
        await fs.writeFile(filePath, content, "utf8");
    }
}

async function syncCharsFilesystem(nodes, parentDir) {
    await fs.mkdir(parentDir, { recursive: true });

    if (!Array.isArray(nodes)) {
        return;
    }

    // Primeiro, crie/garanta os diretórios e arquivos esperados
    const desiredNames = new Set();

    for (const node of nodes) {
        if (!node || typeof node !== "object") {
            continue;
        }

        if (node.type === "group") {
            const name = getGroupFolderName(node);
            desiredNames.add(name);
            const groupDir = path.join(parentDir, name);
            await fs.mkdir(groupDir, { recursive: true });
            await syncCharsFilesystem(Array.isArray(node.children) ? node.children : [], groupDir);
            continue;
        }

        const name = getCharacterFolderName(node);
        desiredNames.add(name);
        const characterDir = path.join(parentDir, name);
        await fs.mkdir(characterDir, { recursive: true });

        const targetFile = path.join(characterDir, getCharacterTargetName(node));
        await ensureFileExists(targetFile, "");
    }

    // Depois, remova diretórios que não estão mais presentes no JSON
    try {
        const entries = await fs.readdir(parentDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            if (!desiredNames.has(entry.name)) {
                const fullPath = path.join(parentDir, entry.name);
                // removendo diretório obsoleto
                await fs.rm(fullPath, { recursive: true, force: true });
            }
        }
    } catch (err) {
        // se não for possível ler/limpar, apenas continue sem quebrar
        // isso evita perda de dados por erro inesperado
    }
}

async function handleDataRequest(request, response, resourceName) {
    const filePath = path.join(rootDir, "bd", `${resourceName}.json`);

    if (request.method === "GET") {
        try {
            const content = await fs.readFile(filePath, "utf8");
            sendText(response, 200, content, "application/json; charset=utf-8");
        } catch (error) {
            sendText(response, 500, `Falha ao ler ${resourceName}.json: ${error.message}`);
        }

        return;
    }

    if (request.method === "PUT") {
        try {
            const body = await readBody(request);
            const parsed = JSON.parse(body);
            await fs.writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

            if (resourceName === "chars") {
                await syncCharsFilesystem(parsed, path.join(rootDir, "bd", "chars"));
            }

            sendJson(response, 200, { ok: true });
        } catch (error) {
            sendJson(response, 400, {
                ok: false,
                error: error.message
            });
        }

        return;
    }

    sendText(response, 405, "Method Not Allowed");
}

async function handleCharacterImageRequest(request, response) {
    if (request.method !== "POST") {
        sendText(response, 405, "Method Not Allowed");
        return;
    }

    try {
        const body = JSON.parse(await readBody(request));
        const folderPath = String(body.folderPath || "").trim();
        const baseName = String(body.baseName || "").trim().toLowerCase();
        const action = String(body.action || "upload").trim().toLowerCase();
        const originalName = String(body.originalName || "").trim();
        const mimeType = String(body.mimeType || "").trim();
        const data = String(body.data || "").trim();

        if (!folderPath) {
            throw new Error("folderPath ausente.");
        }

        if (action === "delete") {
            if (baseName !== "showcase" && baseName !== "combat") {
                throw new Error("Nome de imagem inválido.");
            }

            const targetDir = resolveCharsDirPath(folderPath);
            await removeImageVariants(targetDir, baseName);

            sendJson(response, 200, {
                ok: true,
                deleted: true,
                folderPath,
                baseName
            });

            return;
        }

        if (action === "delete-file") {
            const targetDir = resolveCharsDirPath(folderPath);
            const fileName = getSafeImageFileName(body.fileName || "");

            if (isProtectedImageBaseName(fileName)) {
                throw new Error("Esse arquivo deve ser removido pelos controles de Showcase/Combat.");
            }

            await fs.rm(path.join(targetDir, fileName), { force: true });

            sendJson(response, 200, {
                ok: true,
                deleted: true,
                folderPath,
                fileName
            });

            return;
        }

        if (action === "list") {
            const targetDir = resolveCharsDirPath(folderPath);
            const images = await listCharacterExtraImages(targetDir);

            sendJson(response, 200, {
                ok: true,
                images,
                folderPath
            });

            return;
        }

        if (action === "upload-file") {
            if (!data) {
                throw new Error("Dados da imagem ausentes.");
            }

            const targetDir = resolveCharsDirPath(folderPath);
            const fileName = getNormalizedImageFileName(originalName, mimeType);
            const targetFile = path.join(targetDir, fileName);

            await fs.mkdir(targetDir, { recursive: true });
            await fs.writeFile(targetFile, Buffer.from(data, "base64"));

            sendJson(response, 200, {
                ok: true,
                fileName,
                folderPath
            });

            return;
        }

        if (baseName !== "showcase" && baseName !== "combat") {
            throw new Error("Nome de imagem inválido.");
        }

        if (!data) {
            throw new Error("Dados da imagem ausentes.");
        }

        const targetDir = resolveCharsDirPath(folderPath);
        const extension = resolveImageExtension(originalName, mimeType);
        const targetFile = path.join(targetDir, `${baseName}${extension}`);

        await fs.mkdir(targetDir, { recursive: true });
        await removeImageVariants(targetDir, baseName);

        const buffer = Buffer.from(data, "base64");
        await fs.writeFile(targetFile, buffer);

        sendJson(response, 200, {
            ok: true,
            fileName: path.basename(targetFile),
            folderPath
        });
    } catch (error) {
        sendJson(response, 400, {
            ok: false,
            error: error.message
        });
    }
}

async function handleCharacterRenameRequest(request, response) {
    if (request.method !== "POST") {
        sendText(response, 405, "Method Not Allowed");
        return;
    }

    try {
        const body = JSON.parse(await readBody(request));
        const oldFolderPath = String(body.oldFolderPath || "").trim();
        const newFolderPath = String(body.newFolderPath || "").trim();
        const oldFileName = String(body.oldFileName || "").trim();
        const newFileName = String(body.newFileName || "").trim();
        const type = String(body.type || "").trim().toLowerCase();

        if (!oldFolderPath || !newFolderPath) {
            throw new Error("oldFolderPath ou newFolderPath ausente.");
        }

        const sourceDir = resolveCharsDirPath(oldFolderPath);
        const targetDir = resolveCharsDirPath(newFolderPath);

        await renamePathPreservingContents(sourceDir, targetDir);

        if (type !== "group" && oldFileName && newFileName && oldFileName !== newFileName) {
            const sourceFile = path.join(targetDir, path.basename(oldFileName));
            const targetFile = path.join(targetDir, path.basename(newFileName));

            try {
                await fs.rename(sourceFile, targetFile);
            } catch (error) {
                if (!error || error.code !== "ENOENT") {
                    throw error;
                }
            }
        }

        sendJson(response, 200, {
            ok: true,
            oldFolderPath,
            newFolderPath,
            oldFileName,
            newFileName,
            type
        });
    } catch (error) {
        sendJson(response, 400, {
            ok: false,
            error: error.message
        });
    }
}

async function handleCharacterSkillRequest(request, response) {
    if (request.method !== "GET" && request.method !== "PUT") {
        sendText(response, 405, "Method Not Allowed");
        return;
    }

    try {
        const url = new URL(request.url, `http://localhost:${port}`);
        const folderPath = String(url.searchParams.get("folderPath") || "").trim();
        const fileName = String(url.searchParams.get("fileName") || "").trim();

        if (!folderPath || !fileName) {
            throw new Error("folderPath ou fileName ausente.");
        }

        const targetDir = resolveCharsDirPath(folderPath);
        const safeFileName = path.basename(fileName);

        if (!/\.skill$/i.test(safeFileName)) {
            throw new Error("Apenas arquivos .skill são permitidos.");
        }

        const targetFile = path.join(targetDir, safeFileName);

        if (request.method === "GET") {
            const content = await fs.readFile(targetFile, "utf8");
            sendText(response, 200, content, "text/plain; charset=utf-8");
            return;
        }

        const body = JSON.parse(await readBody(request));
        const content = String(body.content || "");

        await fs.writeFile(targetFile, content, "utf8");

        sendJson(response, 200, {
            ok: true,
            fileName: safeFileName,
            folderPath
        });
    } catch (error) {
        sendJson(response, 400, {
            ok: false,
            error: error.message
        });
    }
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://localhost:${port}`);

    if (url.pathname === "/api/data/chars" || url.pathname === "/api/data/effects") {
        await handleDataRequest(
            request,
            response,
            url.pathname.endsWith("chars") ? "chars" : "effects"
        );

        return;
    }

    if (url.pathname === "/api/chars/image") {
        await handleCharacterImageRequest(request, response);
        return;
    }

    if (url.pathname === "/api/chars/rename") {
        await handleCharacterRenameRequest(request, response);
        return;
    }

    if (url.pathname === "/api/chars/skill") {
        await handleCharacterSkillRequest(request, response);
        return;
    }

    const staticPath = getStaticPath(url.pathname);

    if (!staticPath) {
        sendText(response, 403, "Forbidden");
        return;
    }

    try {
        const stat = await fs.stat(staticPath);

        if (stat.isDirectory()) {
            const indexPath = path.join(staticPath, "index.html");
            const indexContent = await fs.readFile(indexPath);

            response.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8"
            });
            response.end(indexContent);
            return;
        }

        const content = await fs.readFile(staticPath);
        const ext = path.extname(staticPath).toLowerCase();

        response.writeHead(200, {
            "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
        });
        response.end(content);
    } catch (error) {
        sendText(response, 404, "Not Found");
    }
});

server.listen(port, () => {
    const url = `http://localhost:${port}/editor.html`;

    console.log(`Editor ativo em ${url}`);

    if (process.platform === "win32" && process.env.NO_OPEN_BROWSER !== "1") {
        execFile("cmd", ["/c", "start", "", url], { windowsHide: true }, () => {});
    }
});
