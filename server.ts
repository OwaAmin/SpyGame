import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("spygame.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    player_name TEXT PRIMARY KEY,
    score INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    players TEXT,
    spy_count INTEGER,
    winner TEXT,
    difficulty TEXT,
    word TEXT,
    special_roles TEXT
  );
  CREATE TABLE IF NOT EXISTS achievements (
    player_name TEXT,
    achievement_id TEXT,
    date TEXT,
    UNIQUE(player_name, achievement_id)
  );
`);

// Migration: Add special_roles column if it doesn't exist (for existing databases)
try {
  db.prepare("SELECT special_roles FROM history LIMIT 1").get();
} catch (e) {
  try {
    db.exec("ALTER TABLE history ADD COLUMN special_roles TEXT DEFAULT 'غیرفعال'");
    console.log("Migration: Added special_roles column to history table.");
  } catch (migrationError) {
    console.error("Migration failed:", migrationError);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/scores", (req, res) => {
    const scores = db.prepare("SELECT * FROM scores ORDER BY score DESC").all();
    res.json(scores);
  });

  app.post("/api/scores/update", (req, res) => {
    const { player_name, increment } = req.body;
    const stmt = db.prepare(`
      INSERT INTO scores (player_name, score) 
      VALUES (?, ?) 
      ON CONFLICT(player_name) DO UPDATE SET score = score + ?
    `);
    stmt.run(player_name, increment, increment);
    res.json({ success: true });
  });

  app.post("/api/scores/reset", (req, res) => {
    db.prepare("DELETE FROM scores").run();
    res.json({ success: true });
  });

  app.get("/api/history", (req, res) => {
    const history = db.prepare("SELECT * FROM history ORDER BY id DESC").all();
    res.json(history);
  });

  app.get("/api/achievements/:playerName", (req, res) => {
    const achievements = db.prepare("SELECT * FROM achievements WHERE player_name = ?").all(req.params.playerName);
    res.json(achievements);
  });

  app.post("/api/achievements/add", (req, res) => {
    const { player_name, achievement_id } = req.body;
    const stmt = db.prepare("INSERT OR IGNORE INTO achievements (player_name, achievement_id, date) VALUES (?, ?, ?)");
    stmt.run(player_name, achievement_id, new Date().toLocaleString('fa-IR'));
    res.json({ success: true });
  });

  app.post("/api/history/add", (req, res) => {
    const { date, players, spy_count, winner, difficulty, word, special_roles } = req.body;
    const stmt = db.prepare(`
      INSERT INTO history (date, players, spy_count, winner, difficulty, word, special_roles)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(date, JSON.stringify(players), spy_count, winner, difficulty, word, JSON.stringify(special_roles));
    res.json({ success: true });
  });

  app.post("/api/history/reset", (req, res) => {
    db.prepare("DELETE FROM history").run();
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
