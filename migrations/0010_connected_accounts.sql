CREATE TABLE connected_accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'whatsapp', 'telegram')),
  account_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  credentials TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'verified',
  last_error TEXT,
  last_checked_at TEXT NOT NULL,
  webhook_seen_at TEXT,
  subscribed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (platform, account_id)
);
CREATE TABLE channel_events (
  account_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  reply_key TEXT,
  reply_text TEXT,
  status TEXT NOT NULL,
  error TEXT,
  received_at TEXT NOT NULL,
  PRIMARY KEY (account_id, event_id),
  FOREIGN KEY (account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
);
CREATE INDEX channel_events_recent ON channel_events(received_at DESC);
