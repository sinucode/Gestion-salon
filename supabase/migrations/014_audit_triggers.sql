-- ============================================
-- Migration 014: Audit Triggers
-- ============================================

-- 1. Make user_id nullable in audit_log to support system actions
ALTER TABLE audit_log ALTER COLUMN user_id DROP NOT NULL;

-- 2. Create the generic function to process audit logs
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_business_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  -- Attempt to get user_id from auth context
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Attempt to get business_id from auth context first, fallback to record data
  BEGIN
    v_business_id := NULLIF(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'business_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_business_id := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    
    -- Try to extract business_id from the new record if not in auth context
    IF v_business_id IS NULL AND v_new_data ? 'business_id' THEN
      v_business_id := (v_new_data->>'business_id')::UUID;
    END IF;

    -- Handle tables where id is the business_id
    IF v_business_id IS NULL AND TG_TABLE_NAME = 'businesses' THEN
        v_business_id := NEW.id;
    END IF;

    INSERT INTO audit_log (user_id, business_id, table_name, record_id, action, new_values)
    VALUES (v_user_id, v_business_id, TG_TABLE_NAME, NEW.id, 'INSERT', v_new_data);
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    
    -- Try to extract business_id from the new record if not in auth context
    IF v_business_id IS NULL AND v_new_data ? 'business_id' THEN
      v_business_id := (v_new_data->>'business_id')::UUID;
    END IF;

    -- Handle tables where id is the business_id
    IF v_business_id IS NULL AND TG_TABLE_NAME = 'businesses' THEN
        v_business_id := NEW.id;
    END IF;

    INSERT INTO audit_log (user_id, business_id, table_name, record_id, action, old_values, new_values)
    VALUES (v_user_id, v_business_id, TG_TABLE_NAME, NEW.id, 'UPDATE', v_old_data, v_new_data);
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    
    -- Try to extract business_id from the old record if not in auth context
    IF v_business_id IS NULL AND v_old_data ? 'business_id' THEN
      v_business_id := (v_old_data->>'business_id')::UUID;
    END IF;

    -- Handle tables where id is the business_id
    IF v_business_id IS NULL AND TG_TABLE_NAME = 'businesses' THEN
        v_business_id := OLD.id;
    END IF;

    INSERT INTO audit_log (user_id, business_id, table_name, record_id, action, old_values)
    VALUES (v_user_id, v_business_id, TG_TABLE_NAME, OLD.id, 'DELETE', v_old_data);
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to easily attach the trigger to any table
CREATE OR REPLACE FUNCTION enable_audit_for_table(target_table_name REGCLASS)
RETURNS void AS $$
DECLARE
  stmt TEXT;
BEGIN
  stmt := format('
    DROP TRIGGER IF EXISTS trg_audit_%1$s ON %1$s;
    CREATE TRIGGER trg_audit_%1$s
      AFTER INSERT OR UPDATE OR DELETE ON %1$s
      FOR EACH ROW EXECUTE FUNCTION process_audit_log();
  ', cast(target_table_name as TEXT));
  
  EXECUTE stmt;
END;
$$ LANGUAGE plpgsql;

-- 4. Enable audit for important tables
SELECT enable_audit_for_table('businesses');
SELECT enable_audit_for_table('locations');
SELECT enable_audit_for_table('profiles');
SELECT enable_audit_for_table('categories');
SELECT enable_audit_for_table('services');
SELECT enable_audit_for_table('products');
SELECT enable_audit_for_table('appointments');
SELECT enable_audit_for_table('cash_movements');
SELECT enable_audit_for_table('stock_movements');
SELECT enable_audit_for_table('feature_flags');
SELECT enable_audit_for_table('damage_reports');
