CREATE TABLE IF NOT EXISTS app_guests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS guest_devices (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES app_guests(id),
  token_hash TEXT NOT NULL UNIQUE,
  device_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_guest_devices_status ON guest_devices(status);
CREATE INDEX IF NOT EXISTS idx_guest_devices_guest ON guest_devices(guest_id);
ALTER TABLE reviews ADD COLUMN guest_id TEXT REFERENCES app_guests(id);
