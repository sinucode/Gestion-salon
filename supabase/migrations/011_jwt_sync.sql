-- ============================================
-- Migration 011: JWT App Metadata Sync
-- ============================================

-- Function to sync profile changes to auth.users.raw_app_meta_data
CREATE OR REPLACE FUNCTION sync_profile_to_app_metadata()
RETURNS TRIGGER AS $$
DECLARE
  v_current_meta JSONB;
BEGIN
  -- Get current metadata
  SELECT raw_app_meta_data INTO v_current_meta
  FROM auth.users
  WHERE id = NEW.id;

  -- Only update if there's an actual change in the synced fields
  IF (
    (v_current_meta->>'role' IS DISTINCT FROM NEW.role::TEXT) OR
    (v_current_meta->>'business_id' IS DISTINCT FROM NEW.business_id::TEXT) OR
    (v_current_meta->>'location_id' IS DISTINCT FROM NEW.location_id::TEXT)
  ) THEN
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'role', NEW.role,
        'business_id', NEW.business_id,
        'location_id', NEW.location_id
      )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on profiles
DROP TRIGGER IF EXISTS trg_sync_profile_metadata ON profiles;
CREATE TRIGGER trg_sync_profile_metadata
  AFTER INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_to_app_metadata();
