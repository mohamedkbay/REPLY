CREATE TABLE tiktok_accounts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  credentials TEXT NOT NULL,
  videos TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  activated_at TEXT,
  last_checked_at TEXT,
  last_error TEXT,
  lock_until INTEGER NOT NULL DEFAULT 0,
  next_video INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE tiktok_comment_events (
  account_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  username TEXT,
  text TEXT NOT NULL,
  reply_text TEXT,
  reply_key TEXT,
  status TEXT NOT NULL,
  error TEXT,
  received_at TEXT NOT NULL,
  PRIMARY KEY(account_id,comment_id),
  FOREIGN KEY(account_id) REFERENCES tiktok_accounts(id)
);
CREATE INDEX tiktok_comment_events_recent ON tiktok_comment_events(received_at DESC);
