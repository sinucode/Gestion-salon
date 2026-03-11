-- ============================================
-- Migration 017: Logical Delete & FK Protection
-- ============================================

-- 1. Ensure is_active exists on master tables
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Modify Foreign Keys to prevent physical deletion (RESTRICT)
-- Since we don't know the exact auto-generated name of the constraint in Supabase without querying,
-- we use dynamic SQL to find and replace them.

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- We target foreign keys originating from cash_movements, damage_reports, appointments, stock_movements
  FOR rec IN (
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('cash_movements', 'damage_reports', 'appointments', 'appointment_services', 'appointment_addons', 'stock_movements')
      AND rc.delete_rule = 'CASCADE'
  ) LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE RESTRICT',
      rec.table_name, rec.constraint_name, rec.column_name, rec.foreign_table_name, rec.foreign_column_name);
  END LOOP;
END;
$$;
