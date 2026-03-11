-- ============================================
-- Migration 023: Fix Multi-Location RLS
-- ============================================

-- 1. Remove incorrect policy (user reports table as non-existent or wrong)
DROP POLICY IF EXISTS "admin_transfers" ON account_transfers;

-- 2. Apply strict RLS for cash_movements (Admin multi-location access)
DROP POLICY IF EXISTS "admin_cash_movements" ON cash_movements;
CREATE POLICY "admin_cash_movements" ON cash_movements
  FOR ALL USING (
    auth_role() = 'admin'
    AND business_id = auth_business_id()
    AND auth_has_location_access(location_id)
  );

-- 3. Apply strict RLS for inventory (Table name: products)
-- Note: User mentioned 'inventory_items', but existing table is 'products'
DROP POLICY IF EXISTS "admin_inventory" ON products;
CREATE POLICY "admin_inventory" ON products
  FOR ALL USING (
    auth_role() = 'admin'
    AND business_id = auth_business_id()
    AND auth_has_location_access(location_id)
  );

-- 4. Apply strict RLS for locations (Admin multi-location access)
-- Note: Uses 'id' for evaluating access since it is the primary key of the location itself
DROP POLICY IF EXISTS "admin_locations" ON locations;
CREATE POLICY "admin_locations" ON locations
  FOR ALL USING (
    (auth_role() = 'admin' AND business_id = auth_business_id() AND auth_has_location_access(id))
    OR auth_role() = 'super_admin'
  );
