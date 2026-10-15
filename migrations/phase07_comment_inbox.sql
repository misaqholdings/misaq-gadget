-- Phase 07 comment-to-Messenger processing queue; staging only.
CREATE TABLE IF NOT EXISTS facebook_comment_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 event_key TEXT NOT NULL UNIQUE,
 page_id TEXT NOT NULL,
 post_id TEXT NOT NULL,
 comment_id TEXT NOT NULL,
 commenter_id TEXT,
 comment_text TEXT NOT NULL,
 content_id INTEGER REFERENCES facebook_contents(id),
 product_codes_json TEXT NOT NULL DEFAULT '[]',
 resolution_status TEXT NOT NULL DEFAULT 'unmapped' CHECK(resolution_status IN ('unmapped','single','multiple')),
 public_reply_status TEXT NOT NULL DEFAULT 'not_sent',
 private_reply_status TEXT NOT NULL DEFAULT 'not_sent',
 delivery_status TEXT NOT NULL DEFAULT 'pending_review',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_facebook_comment_events_delivery ON facebook_comment_events(delivery_status,created_at);
