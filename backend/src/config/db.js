const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "..", "users.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error(err.message);
  else console.log("📦 Connected to SQLite database");
});

// Enable foreign keys + WAL for integrity & concurrency
db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");
  db.run("PRAGMA journal_mode = WAL;");
});

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    github_id TEXT,
    username TEXT,
    avatar_url TEXT,
    refresh_token TEXT,
    view_history TEXT DEFAULT '[]',
    password_reset_token TEXT,
    password_reset_expires DATETIME,
    preferred_language TEXT DEFAULT 'en',
    preferences TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) console.error("Table creation failed:", err.message);
});

// Ensure UNIQUE constraints via index (safe migration)
db.run(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users(email);
`);

db.run(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id
  ON users(github_id);
`);

// Add indexes for frequently queried fields
db.run(`
  CREATE INDEX IF NOT EXISTS idx_users_reset_token
  ON users(password_reset_token);
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users(created_at);
`);

// Trigger to auto-update updated_at
db.run(`
  CREATE TRIGGER IF NOT EXISTS update_users_updated_at
  AFTER UPDATE ON users
  FOR EACH ROW
  BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;
`);

// Migration for existing tables
db.serialize(() => {
  db.all("PRAGMA table_info(users);", (err, columns) => {
    if (err) {
      console.error("Migration check failed:", err.message);
      return;
    }

    const columnNames = columns.map(col => col.name);

    const addColumnIfMissing = (name, definition) => {
      if (!columnNames.includes(name)) {
        db.run(`ALTER TABLE users ADD COLUMN ${definition}`, (err) => {
          if (err) console.error(`Failed to add column ${name}:`, err.message);
        });
      }
    };

    addColumnIfMissing("github_id", "github_id TEXT");
    addColumnIfMissing("username", "username TEXT");
    addColumnIfMissing("avatar_url", "avatar_url TEXT");
  });
});

module.exports = db;
