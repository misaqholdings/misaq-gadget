-- Phase 07: staging-only Product Management foundation.
-- Preserve the existing products table and existing STAGING_TEST_Q86 catalog entry.
CREATE TABLE IF NOT EXISTS product_variants (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 product_id INTEGER NOT NULL REFERENCES products(id),
 sku TEXT NOT NULL UNIQUE,
 variant_name TEXT NOT NULL,
 attributes_json TEXT NOT NULL DEFAULT '{}',
 price_override REAL CHECK(price_override IS NULL OR price_override>=0),
 stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity>=0),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id,status);
CREATE TABLE IF NOT EXISTS product_inventory_movements (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 variant_id INTEGER NOT NULL REFERENCES product_variants(id),
 quantity_delta INTEGER NOT NULL,
 reason TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 request_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_inventory_movements_variant ON product_inventory_movements(variant_id,created_at);
