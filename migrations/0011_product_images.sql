CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png')),
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
ALTER TABLE products ADD COLUMN image_id TEXT REFERENCES product_images(id);
ALTER TABLE channel_events ADD COLUMN reply_image_id TEXT;
ALTER TABLE message_events ADD COLUMN reply_image_id TEXT;
