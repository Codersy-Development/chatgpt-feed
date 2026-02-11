-- Migration: Create feed settings and cache tables for OpenAI Commerce Feed

-- Per-store feed configuration
CREATE TABLE IF NOT EXISTS feed_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop TEXT NOT NULL UNIQUE,
  -- Feed eligibility flags
  enable_search INTEGER NOT NULL DEFAULT 1,
  enable_checkout INTEGER NOT NULL DEFAULT 0,
  -- Merchant info (pulled from Shopify but overridable)
  seller_name TEXT,
  seller_url TEXT,
  privacy_policy_url TEXT,
  terms_of_service_url TEXT,
  return_policy_url TEXT,
  -- Returns info
  accepts_returns INTEGER DEFAULT 1,
  return_deadline_days INTEGER DEFAULT 30,
  accepts_exchanges INTEGER DEFAULT 1,
  -- Geo
  store_country TEXT DEFAULT 'US',
  target_countries TEXT DEFAULT 'US',
  -- Feed status
  feed_generated_at INTEGER,
  product_count INTEGER DEFAULT 0,
  -- Timestamps
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_feed_settings_shop ON feed_settings(shop);

-- Cached feed data (stores the generated JSONL content)
CREATE TABLE IF NOT EXISTS feed_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop TEXT NOT NULL UNIQUE,
  feed_data TEXT,
  product_count INTEGER DEFAULT 0,
  generated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_feed_cache_shop ON feed_cache(shop);
