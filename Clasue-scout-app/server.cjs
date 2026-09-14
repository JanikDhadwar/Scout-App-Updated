const express  = require("express");
const cors     = require("cors");
const fs       = require("fs");
const path     = require("path");

const app    = express();
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "db.json");
const DIST_DIR = path.join(__dirname, "dist");
const PORT   = Number(process.env.APP_PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.get("/api/health", (_req, res) => {
  readDB();
  const ready = process.env.NODE_ENV !== "production" || fs.existsSync(path.join(DIST_DIR, "index.html"));
  res.setHeader("Cache-Control", "no-store");
  res.status(ready ? 200 : 503)
    .json({ ok: ready, release: path.basename(path.dirname(__dirname)) });
});
app.use(express.static(DIST_DIR, { setHeaders(res, file) {
  if (file.endsWith(".html") || file.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
} }));


// ─── db.json helpers ──────────────────────────────────────────────────────────
const STORES = ["users","teams","memberships","forms","submissions","session",
                "announcements","scout_events","pit_scouts"];

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const empty = Object.fromEntries(STORES.map(s => [s, s === "session" ? {} : []]));
    writeDB(empty);
    return empty;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDB(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const temporary = `${DB_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, DB_FILE);
}

function handleGetStore(req, res, next) {
  const db   = readDB();
  const store = req.params.store;
  if (!STORES.includes(store)) {
    if (next) return next();
    return res.status(404).json({ error: "Unknown store" });
  }

  if (store === "session") {
    const key = req.query.key;
    if (key) return res.json(db.session[key] ?? null);
    return res.json(Object.values(db.session));
  }

  let rows = db[store] || [];
  for (const [k, v] of Object.entries(req.query)) {
    rows = rows.filter(r => String(r[k]) === String(v));
  }
  res.json(rows);
}

function handleGetStoreItem(req, res, next) {
  const db = readDB();
  const store = req.params.store;
  if (!STORES.includes(store)) {
    if (next) return next();
    return res.status(404).json({ error: "Unknown store" });
  }

  if (store === "session") return res.json(db.session[req.params.id] ?? null);

  const row = (db[store] || []).find(r => r.id === req.params.id);
  res.json(row ?? null);
}

function handlePostStore(req, res, next) {
  const db    = readDB();
  const store = req.params.store;
  if (!STORES.includes(store)) {
    if (next) return next();
    return res.status(404).json({ error: "Unknown store" });
  }

  const row = req.body;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return res.status(400).json({ error: "Expected a JSON object" });
  }
  const key = store === "session" ? row.key : row.id;
  if (typeof key !== "string" || !key || ["__proto__", "constructor", "prototype"].includes(key)) {
    return res.status(400).json({ error: "A valid id (or session key) is required" });
  }

  if (store === "session") {
    db.session[row.key] = row;
    writeDB(db); return res.json(row);
  }

  if (!db[store]) db[store] = [];
  const idx = db[store].findIndex(r => r.id === row.id);
  if (idx >= 0) db[store][idx] = row;
  else          db[store].push(row);

  writeDB(db);
  res.json(row);
}

function handlePatchStoreItem(req, res, next) {
  const db    = readDB();
  const store = req.params.store;
  if (!STORES.includes(store)) {
    if (next) return next();
    return res.status(404).json({ error: "Unknown store" });
  }

  const idx = (db[store] || []).findIndex(r => r.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });

  db[store][idx] = { ...db[store][idx], ...req.body, id: req.params.id };
  writeDB(db);
  res.json(db[store][idx]);
}

function handleDeleteStoreItem(req, res, next) {
  const db    = readDB();
  const store = req.params.store;
  if (!STORES.includes(store)) {
    if (next) return next();
    return res.status(404).json({ error: "Unknown store" });
  }

  if (store === "session") {
    delete db.session[req.params.id];
    writeDB(db); return res.json({ ok: true });
  }

  db[store] = (db[store] || []).filter(r => r.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/:store  — get all rows, with optional ?key=val filters
app.get("/api/:store", handleGetStore);
app.get("/:store", handleGetStore);

// GET /api/:store/:id  — get single row by id
app.get("/api/:store/:id", handleGetStoreItem);
app.get("/:store/:id", handleGetStoreItem);

// POST /api/:store  — insert or upsert a row
app.post("/api/:store", handlePostStore);
app.post("/:store", handlePostStore);

// PATCH /api/:store/:id  — partial update a single row by id
app.patch("/api/:store/:id", handlePatchStoreItem);
app.patch("/:store/:id", handlePatchStoreItem);

// DELETE /api/:store/:id  — delete a single row by id
app.delete("/api/:store/:id", handleDeleteStoreItem);
app.delete("/:store/:id", handleDeleteStoreItem);

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Unknown API route" });
  if (req.method !== "GET") return next();

  const indexFile = path.join(DIST_DIR, "index.html");
  if (!fs.existsSync(indexFile)) {
    return res.status(503).send("App build not found. Run npm run build first.");
  }

  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(indexFile);
});

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: "Request failed. Check server logs." });
});

app.listen(PORT, () => {
  console.log(`Argus DB server running on http://localhost:${PORT}`);
  console.log(`Data file: ${DB_FILE}`);
});
