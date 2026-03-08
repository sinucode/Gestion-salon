-- ============================================
-- Migration 009: Row Level Security (RLS)
-- ============================================

-- Helper functions to extract tenant info from JWT
CREATE OR REPLACE FUNCTION auth_business_id()
RETURNS UUID AS $$
  SELECT NULLIF(auth.jwt()->'app_metadata'->>'business_id', '')::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_location_id()
RETURNS UUID AS $$
  SELECT NULLIF(auth.jwt()->'app_metadata'->>'location_id', '')::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT AS $$
  SELECT auth.jwt()->'app_metadata'->>'role';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE businesses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_addons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_addons  ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_recipes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays_co         ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BUSINESSES
-- ============================================
CREATE POLICY "businesses_select" ON businesses FOR SELECT USING (
  auth_role() = 'super_admin' OR id = auth_business_id()
);
CREATE POLICY "businesses_insert" ON businesses FOR INSERT
  WITH CHECK (auth_role() = 'super_admin');
CREATE POLICY "businesses_update" ON businesses FOR UPDATE USING (
  auth_role() = 'super_admin'
);
CREATE POLICY "businesses_delete" ON businesses FOR DELETE USING (
  auth_role() = 'super_admin'
);

-- ============================================
-- LOCATIONS
-- ============================================
CREATE POLICY "locations_select" ON locations FOR SELECT USING (
  auth_role() = 'super_admin'
  OR business_id = auth_business_id()
);
CREATE POLICY "locations_insert" ON locations FOR INSERT WITH CHECK (
  auth_role() = 'super_admin'
  OR (auth_role() = 'admin' AND business_id = auth_business_id())
);
CREATE POLICY "locations_update" ON locations FOR UPDATE USING (
  auth_role() = 'super_admin'
  OR (auth_role() = 'admin' AND business_id = auth_business_id())
);
CREATE POLICY "locations_delete" ON locations FOR DELETE USING (
  auth_role() = 'super_admin'
  OR (auth_role() = 'admin' AND business_id = auth_business_id())
);

-- ============================================
-- PROFILES
-- ============================================
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  auth_role() = 'super_admin'
  OR business_id = auth_business_id()
  OR id = auth.uid()
);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE USING (
  id = auth.uid()
) WITH CHECK (
  id = auth.uid()
);
CREATE POLICY "profiles_insert_admin" ON profiles FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin')
);
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);

-- ============================================
-- CLIENT INVITES
-- ============================================
CREATE POLICY "invites_select" ON client_invites FOR SELECT USING (
  auth_role() = 'super_admin' OR business_id = auth_business_id()
);
CREATE POLICY "invites_insert" ON client_invites FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin', 'professional')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);

-- ============================================
-- CATEGORIES (Tenant-scoped)
-- ============================================
CREATE POLICY "categories_select" ON categories FOR SELECT USING (
  auth_role() = 'super_admin' OR business_id = auth_business_id()
);
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);

-- ============================================
-- SERVICES (Tenant-scoped)
-- ============================================
CREATE POLICY "services_select" ON services FOR SELECT USING (
  auth_role() = 'super_admin' OR business_id = auth_business_id()
);
CREATE POLICY "services_insert" ON services FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);
CREATE POLICY "services_update" ON services FOR UPDATE USING (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);
CREATE POLICY "services_delete" ON services FOR DELETE USING (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);

-- ============================================
-- SERVICE ADD-ONS
-- ============================================
CREATE POLICY "addons_select" ON service_addons FOR SELECT USING (
  auth_role() = 'super_admin' OR business_id = auth_business_id()
);
CREATE POLICY "addons_mutate" ON service_addons FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);
CREATE POLICY "addons_update" ON service_addons FOR UPDATE USING (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);
CREATE POLICY "addons_delete" ON service_addons FOR DELETE USING (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (
  auth_role() = 'super_admin'
  OR business_id = auth_business_id()
);
CREATE POLICY "appointments_insert" ON appointments FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin', 'professional')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);
CREATE POLICY "appointments_update" ON appointments FOR UPDATE USING (
  auth_role() IN ('super_admin', 'admin', 'professional')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);

-- Appointment sub-tables (access controlled by parent)
CREATE POLICY "appt_services_select" ON appointment_services FOR SELECT USING (true);
CREATE POLICY "appt_services_insert" ON appointment_services FOR INSERT WITH CHECK (true);
CREATE POLICY "appt_addons_select" ON appointment_addons FOR SELECT USING (true);
CREATE POLICY "appt_addons_insert" ON appointment_addons FOR INSERT WITH CHECK (true);

-- ============================================
-- PRODUCTS
-- ============================================
CREATE POLICY "products_select" ON products FOR SELECT USING (
  auth_role() = 'super_admin' OR business_id = auth_business_id()
);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);
CREATE POLICY "products_update" ON products FOR UPDATE USING (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);

-- ============================================
-- SERVICE RECIPES
-- ============================================
CREATE POLICY "recipes_select" ON service_recipes FOR SELECT USING (true);
CREATE POLICY "recipes_insert" ON service_recipes FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin')
);
CREATE POLICY "recipes_update" ON service_recipes FOR UPDATE USING (
  auth_role() IN ('super_admin', 'admin')
);
CREATE POLICY "recipes_delete" ON service_recipes FOR DELETE USING (
  auth_role() IN ('super_admin', 'admin')
);

-- ============================================
-- STOCK MOVEMENTS
-- ============================================
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT USING (
  auth_role() = 'super_admin' OR business_id = auth_business_id()
);
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);

-- ============================================
-- DAMAGE REPORTS
-- ============================================
CREATE POLICY "damages_select" ON damage_reports FOR SELECT USING (
  auth_role() = 'super_admin' OR business_id = auth_business_id()
);
CREATE POLICY "damages_insert" ON damage_reports FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin', 'professional')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);
CREATE POLICY "damages_update" ON damage_reports FOR UPDATE USING (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);

-- ============================================
-- CASH MOVEMENTS
-- ============================================
CREATE POLICY "cash_select" ON cash_movements FOR SELECT USING (
  auth_role() = 'super_admin'
  OR (auth_role() = 'admin' AND business_id = auth_business_id())
  OR (auth_role() = 'professional' AND professional_id = auth.uid())
);
CREATE POLICY "cash_insert" ON cash_movements FOR INSERT WITH CHECK (
  auth_role() IN ('super_admin', 'admin')
  AND (auth_role() = 'super_admin' OR business_id = auth_business_id())
);

-- ============================================
-- FEATURE FLAGS
-- ============================================
CREATE POLICY "ff_select" ON feature_flags FOR SELECT USING (
  auth_role() = 'super_admin' OR business_id = auth_business_id()
);
CREATE POLICY "ff_insert" ON feature_flags FOR INSERT WITH CHECK (
  auth_role() = 'super_admin'
);
CREATE POLICY "ff_update" ON feature_flags FOR UPDATE USING (
  auth_role() = 'super_admin'
);
CREATE POLICY "ff_delete" ON feature_flags FOR DELETE USING (
  auth_role() = 'super_admin'
);

-- ============================================
-- AUDIT LOG (read-only + append)
-- ============================================
CREATE POLICY "audit_select" ON audit_log FOR SELECT USING (
  auth_role() = 'super_admin'
  OR (auth_role() = 'admin' AND business_id = auth_business_id())
);
CREATE POLICY "audit_insert" ON audit_log FOR INSERT WITH CHECK (true);

-- ============================================
-- HOLIDAYS (read-only for all authenticated)
-- ============================================
CREATE POLICY "holidays_select" ON holidays_co FOR SELECT USING (true);
CREATE POLICY "holidays_insert" ON holidays_co FOR INSERT WITH CHECK (
  auth_role() = 'super_admin'
);

-- ============================================
-- DB Function: Approve Appointment Transaction
-- Deducts inventory, creates cash movements
-- ============================================
CREATE OR REPLACE FUNCTION approve_appointment_tx(
  p_appointment_id UUID,
  p_approved_by UUID
)
RETURNS void AS $$
DECLARE
  v_appt RECORD;
  v_svc RECORD;
  v_recipe RECORD;
  v_product RECORD;
  v_total_cost NUMERIC(12,2) := 0;
  v_commission NUMERIC(12,2) := 0;
  v_prof_commission_pct NUMERIC(5,2);
BEGIN
  -- Lock and fetch appointment
  SELECT * INTO v_appt FROM appointments
  WHERE id = p_appointment_id AND status = 'completed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or not in completed status';
  END IF;

  -- Update appointment status
  UPDATE appointments SET
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = now()
  WHERE id = p_appointment_id;

  -- Get professional commission percentage
  SELECT commission_pct INTO v_prof_commission_pct
  FROM profiles WHERE id = v_appt.professional_id;

  -- Process each service in the appointment
  FOR v_svc IN
    SELECT * FROM appointment_services WHERE appointment_id = p_appointment_id
  LOOP
    -- Deduct inventory for each recipe of this service
    FOR v_recipe IN
      SELECT sr.*, p.cost_per_unit, p.stock_qty, p.name as product_name
      FROM service_recipes sr
      JOIN products p ON p.id = sr.product_id
      WHERE sr.service_id = v_svc.service_id
    LOOP
      -- Check sufficient stock
      IF v_recipe.stock_qty < v_recipe.qty_consumed THEN
        RAISE EXCEPTION 'Stock insuficiente para %: disponible %, requerido %',
          v_recipe.product_name, v_recipe.stock_qty, v_recipe.qty_consumed;
      END IF;

      -- Deduct stock
      UPDATE products SET
        stock_qty = stock_qty - v_recipe.qty_consumed
      WHERE id = v_recipe.product_id;

      -- Record stock movement
      INSERT INTO stock_movements (product_id, business_id, location_id, appointment_id, type, qty, cost_total, notes, created_by)
      VALUES (
        v_recipe.product_id, v_appt.business_id, v_appt.location_id, p_appointment_id,
        'consumption', -v_recipe.qty_consumed,
        v_recipe.qty_consumed * v_recipe.cost_per_unit,
        'Consumo automático por cita aprobada',
        p_approved_by
      );

      v_total_cost := v_total_cost + (v_recipe.qty_consumed * v_recipe.cost_per_unit);
    END LOOP;
  END LOOP;

  -- Create income cash movement
  INSERT INTO cash_movements (business_id, location_id, appointment_id, professional_id, type, amount, description)
  VALUES (
    v_appt.business_id, v_appt.location_id, p_appointment_id, v_appt.professional_id,
    'income', v_appt.total_price,
    'Ingreso por cita aprobada'
  );

  -- Create inventory cost cash movement
  IF v_total_cost > 0 THEN
    INSERT INTO cash_movements (business_id, location_id, appointment_id, professional_id, type, amount, description)
    VALUES (
      v_appt.business_id, v_appt.location_id, p_appointment_id, v_appt.professional_id,
      'expense', -v_total_cost,
      'Costo de insumos consumidos'
    );
  END IF;

  -- Create commission cash movement (if applicable)
  IF v_prof_commission_pct > 0 THEN
    v_commission := v_appt.total_price * (v_prof_commission_pct / 100);
    INSERT INTO cash_movements (business_id, location_id, appointment_id, professional_id, type, amount, description)
    VALUES (
      v_appt.business_id, v_appt.location_id, p_appointment_id, v_appt.professional_id,
      'commission', -v_commission,
      FORMAT('Comisión profesional (%s%%)', v_prof_commission_pct)
    );
  END IF;

  -- Audit log
  INSERT INTO audit_log (user_id, business_id, table_name, record_id, action, new_values)
  VALUES (
    p_approved_by, v_appt.business_id, 'appointments', p_appointment_id, 'UPDATE',
    jsonb_build_object(
      'status', 'approved',
      'inventory_cost', v_total_cost,
      'commission', v_commission,
      'total_price', v_appt.total_price
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
