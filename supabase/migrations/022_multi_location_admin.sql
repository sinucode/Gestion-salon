-- ============================================
-- Migration 022: Multi-Location Admin & Z-Report
-- ============================================

-- 1. Add assigned_locations array to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_locations UUID[] DEFAULT '{}';

-- 2. Helper function: check if admin has access to a location
CREATE OR REPLACE FUNCTION auth_has_location_access(check_location UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_location_id UUID;
  v_assigned UUID[];
BEGIN
  SELECT role, location_id, assigned_locations
    INTO v_role, v_location_id, v_assigned
    FROM profiles WHERE id = auth.uid();

  IF v_role = 'super_admin' THEN RETURN TRUE; END IF;
  IF v_role = 'admin' THEN
    RETURN (check_location = v_location_id) OR (check_location = ANY(COALESCE(v_assigned, '{}')));
  END IF;
  IF v_role = 'professional' THEN
    RETURN (check_location = v_location_id);
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Update admin RLS policies to use granular location check
-- ACCOUNTS
DROP POLICY IF EXISTS "admin_accounts" ON accounts;
CREATE POLICY "admin_accounts" ON accounts
  FOR ALL USING (
    auth_role() = 'admin'
    AND business_id = auth_business_id()
    AND auth_has_location_access(location_id)
  );

-- CASH REGISTERS
DROP POLICY IF EXISTS "admin_cash_registers" ON cash_registers;
CREATE POLICY "admin_cash_registers" ON cash_registers
  FOR ALL USING (
    auth_role() = 'admin'
    AND business_id = auth_business_id()
    AND auth_has_location_access(location_id)
  );

-- PAYOUTS
DROP POLICY IF EXISTS "admin_payouts" ON payouts;
CREATE POLICY "admin_payouts" ON payouts
  FOR ALL USING (
    auth_role() = 'admin'
    AND business_id = auth_business_id()
    AND auth_has_location_access(location_id)
  );

-- ACCOUNT TRANSFERS
DROP POLICY IF EXISTS "admin_transfers" ON account_transfers;
CREATE POLICY "admin_transfers" ON account_transfers
  FOR ALL USING (
    auth_role() = 'admin'
    AND business_id = auth_business_id()
    AND auth_has_location_access(location_id)
  );

-- OPERATING EXPENSES
DROP POLICY IF EXISTS "op_exp_admin" ON operating_expenses;
CREATE POLICY "op_exp_admin" ON operating_expenses
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.business_id = operating_expenses.business_id
        AND auth_has_location_access(operating_expenses.location_id)
    )
  );
