-- ============================================
-- Migration 012: Business Branding
-- ============================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#7c3aed';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#4f46e5';
