const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.resolve(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'tracecore.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'personal' CHECK(account_type IN ('personal','business')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan TEXT NOT NULL,
    price_minor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ZAR',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','cancelled')),
    started_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recovery_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT NOT NULL,
    serial_number TEXT,
    imei TEXT,
    status TEXT NOT NULL DEFAULT 'protected' CHECK(status IN ('protected','suspicious','lost','stolen','recovery','recovered')),
    registered_at TEXT NOT NULL,
    last_seen_at TEXT,
    device_token_hash TEXT UNIQUE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recovery_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY(recovery_id) REFERENCES devices(recovery_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recovery_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    details TEXT,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY(recovery_id) REFERENCES devices(recovery_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    account_type TEXT NOT NULL DEFAULT 'personal' CHECK(account_type IN ('personal','business')),
    message TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    recovery_id TEXT,
    action TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);


function addColumn(sql){ try { db.exec(sql); } catch(e) { if(!String(e.message).includes('duplicate column name')) throw e; } }
addColumn("ALTER TABLE subscriptions ADD COLUMN provider TEXT DEFAULT 'manual'");
addColumn("ALTER TABLE subscriptions ADD COLUMN provider_customer_id TEXT");
addColumn("ALTER TABLE subscriptions ADD COLUMN provider_subscription_id TEXT");
addColumn("ALTER TABLE subscriptions ADD COLUMN checkout_session_id TEXT");
addColumn("ALTER TABLE subscriptions ADD COLUMN payment_status TEXT DEFAULT 'unpaid'");

console.log(`TraceCore database initialized: ${dbPath}`);
db.close();
