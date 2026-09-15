"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "registrations.db");
const ADMIN_KEY = process.env.ADMIN_KEY || "";

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    patronymic TEXT,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const insertStmt = db.prepare(
  "INSERT INTO registrations (last_name, first_name, patronymic, phone, email) VALUES (?, ?, ?, ?, ?)"
);
const listStmt = db.prepare("SELECT * FROM registrations ORDER BY id DESC");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function digitsOnly(v) {
  return (v || "").replace(/\D/g, "");
}

async function handleRegister(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: "Некорректный JSON" });
  }

  const lastName = String(payload.lastName || "").trim();
  const firstName = String(payload.firstName || "").trim();
  const patronymic = String(payload.patronymic || "").trim();
  const phone = String(payload.phone || "").trim();
  const email = String(payload.email || "").trim();

  const errors = {};
  if (!lastName) errors.lastName = "Укажи фамилию";
  if (!firstName) errors.firstName = "Укажи имя";
  if (digitsOnly(phone).length < 7) errors.phone = "Укажи корректный телефон";
  if (!isValidEmail(email)) errors.email = "Укажи корректный email";

  if (Object.keys(errors).length > 0) {
    return sendJson(res, 400, { ok: false, errors });
  }

  try {
    const info = insertStmt.run(lastName, firstName, patronymic || null, phone, email);
    return sendJson(res, 201, { ok: true, id: Number(info.lastInsertRowid) });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: "Не удалось сохранить запись" });
  }
}

function handleAdminList(req, res, urlObj) {
  if (!ADMIN_KEY || urlObj.searchParams.get("key") !== ADMIN_KEY) {
    return sendJson(res, 401, { ok: false, error: "Unauthorized" });
  }
  const rows = listStmt.all();
  return sendJson(res, 200, { ok: true, count: rows.length, rows });
}

function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  rel = decodeURIComponent(rel);
  const filePath = path.normalize(path.join(ROOT_DIR, rel));

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Не найдено");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (pathname === "/api/register" && req.method === "POST") {
    return handleRegister(req, res);
  }

  if (pathname === "/api/registrations" && req.method === "GET") {
    return handleAdminList(req, res, urlObj);
  }

  if (req.method === "GET") {
    return serveStatic(req, res, pathname);
  }

  res.writeHead(405);
  res.end("Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`Код судьбы: сервер запущен на http://localhost:${PORT}`);
  console.log(`База данных: ${DB_PATH}`);
  if (ADMIN_KEY) {
    console.log(`Просмотр заявок: http://localhost:${PORT}/api/registrations?key=${ADMIN_KEY}`);
  } else {
    console.log("Просмотр заявок отключён (задай переменную окружения ADMIN_KEY, чтобы включить).");
  }
});
