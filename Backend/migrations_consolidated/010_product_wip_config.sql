-- Add wip_config_id to products table (VARCHAR to match config_id in config_stages)
ALTER TABLE products ADD COLUMN IF NOT EXISTS wip_config_id VARCHAR(100);

-- Create index for faster lookups based on config ID
CREATE INDEX IF NOT EXISTS idx_products_wip_config_id ON products(wip_config_id);
