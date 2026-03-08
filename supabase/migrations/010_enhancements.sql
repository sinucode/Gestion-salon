-- ============================================
-- Migration 010: Enhancements
-- Per-business timezone, Audit restriction, RBAC hierarchy at DB level
-- ============================================

-- 1. Add timezone column to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Bogota';

-- 2. Replace hardcoded now_bogota() with dynamic now_business()
CREATE OR REPLACE FUNCTION now_business(p_business_id UUID)
RETURNS timestamptz AS $$
DECLARE
  v_tz TEXT;
BEGIN
  SELECT timezone INTO v_tz FROM businesses WHERE id = p_business_id;
  IF v_tz IS NULL THEN
    v_tz := 'America/Bogota';
  END IF;
  RETURN now() AT TIME ZONE v_tz;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Restrict audit_log to super_admin only (drop old policy that included admin)
DROP POLICY IF EXISTS "audit_select" ON audit_log;
CREATE POLICY "audit_select" ON audit_log FOR SELECT USING (
  auth_role() = 'super_admin'
);

-- 4. Add profile role hierarchy enforcement via trigger
-- Prevents creating users with a role higher than your own
CREATE OR REPLACE FUNCTION enforce_role_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_role TEXT;
  v_role_rank JSONB := '{"super_admin": 4, "admin": 3, "professional": 2, "client": 1}'::JSONB;
  v_actor_rank INT;
  v_target_rank INT;
BEGIN
  -- Get the role of the acting user
  v_actor_role := auth_role();

  -- super_admin can do anything
  IF v_actor_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  v_actor_rank := (v_role_rank ->> v_actor_role)::INT;
  v_target_rank := (v_role_rank ->> NEW.role::TEXT)::INT;

  -- Actor can only create/update users with a LOWER rank than themselves
  IF v_target_rank IS NULL OR v_actor_rank IS NULL OR v_target_rank >= v_actor_rank THEN
    RAISE EXCEPTION 'No tiene permisos para asignar el rol: %', NEW.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_enforce_role_hierarchy
  BEFORE INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_role_hierarchy();
