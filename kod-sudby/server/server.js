"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const CSV_PATH = path.join(DATA_DIR, "registrations.csv");
const ADMIN_KEY = process.env.ADMIN_KEY || "";

const CSV_COLUMNS = ["id", "last_name", "first_name", "patronymic", "phone", "email", "created_at"];

fs.mkdirSync(DATA_DIR, { recursive: true });

function csvEscape(value) {
  const s = String(value == null ? "" : value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(values) {
  return values.map(csvEscape).join(",") + "\n";
}

// Parses the whole CSV file content into an array of field arrays, handling
// quoted fields that may contain commas or embedded newlines.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

if (!fs.existsSync(CSV_PATH)) {
  fs.writeFileSync(CSV_PATH, csvRow(CSV_COLUMNS));
}

function readRegistrations() {
  const text = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const [header, ...dataRows] = rows;
  return dataRows.map((cols) => {
    const rec = {};
    header.forEach((key, i) => { rec[key] = cols[i] !== undefined ? cols[i] : ""; });
    rec.id = Number(rec.id);
    return rec;
  });
}

let nextId = (() => {
  const rows = readRegistrations();
  return rows.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
})();

function insertRegistration(lastName, firstName, patronymic, phone, email) {
  const id = nextId++;
  const createdAt = new Date().toISOString();
  fs.appendFileSync(CSV_PATH, csvRow([id, lastName, firstName, patronymic || "", phone, email, createdAt]));
  return id;
}

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
    const id = insertRegistration(lastName, firstName, patronymic, phone, email);
    return sendJson(res, 201, { ok: true, id });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: "Не удалось сохранить запись" });
  }
}

function handleAdminList(req, res, urlObj) {
  if (!ADMIN_KEY || urlObj.searchParams.get("key") !== ADMIN_KEY) {
    return sendJson(res, 401, { ok: false, error: "Unauthorized" });
  }
  const rows = readRegistrations().sort((a, b) => b.id - a.id);
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
  console.log(`Файл регистраций (CSV): ${CSV_PATH}`);
  if (ADMIN_KEY) {
    console.log(`Просмотр заявок: http://localhost:${PORT}/api/registrations?key=${ADMIN_KEY}`);
  } else {
    console.log("Просмотр заявок отключён (задай переменную окружения ADMIN_KEY, чтобы включить).");
  }
});
