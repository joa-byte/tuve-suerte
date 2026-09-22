PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dinners (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dinner_guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dinner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (dinner_id) REFERENCES dinners(id) ON DELETE CASCADE,
  UNIQUE (dinner_id, name)
);

CREATE TABLE IF NOT EXISTS dishes (
  id TEXT PRIMARY KEY,
  dinner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dinner_id) REFERENCES dinners(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wines (
  id TEXT PRIMARY KEY,
  dinner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Otros',
  winery TEXT NOT NULL DEFAULT '',
  varietal TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dinner_id) REFERENCES dinners(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  dinner_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('dish', 'wine')),
  item_id TEXT NOT NULL,
  author TEXT NOT NULL,
  score REAL NOT NULL CHECK (score >= 1 AND score <= 10),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dinner_id) REFERENCES dinners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dinner_guests_dinner ON dinner_guests(dinner_id);
CREATE INDEX IF NOT EXISTS idx_dishes_dinner ON dishes(dinner_id);
CREATE INDEX IF NOT EXISTS idx_wines_dinner ON wines(dinner_id);
CREATE INDEX IF NOT EXISTS idx_reviews_dinner ON reviews(dinner_id);
CREATE INDEX IF NOT EXISTS idx_reviews_item ON reviews(item_type, item_id);

