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
