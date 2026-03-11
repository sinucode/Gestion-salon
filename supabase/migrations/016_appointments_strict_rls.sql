-- ============================================
-- Migration 016: Strict RLS for Appointments
-- Fine-grained per-role visibility & mutation
-- ============================================

-- ────────────────────────────────────────────
-- Helper: get user role from profiles table
-- Uses SECURITY DEFINER to avoid RLS recursion
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ────────────────────────────────────────────
-- Helper: get user business_id from profiles
-- Uses SECURITY DEFINER to avoid RLS recursion
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_business_id(p_user_id UUID)
RETURNS UUID AS $$
  SELECT business_id FROM profiles WHERE id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- DROP existing appointment policies
-- ============================================
DROP POLICY IF EXISTS "appointments_select" ON appointments;
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
DROP POLICY IF EXISTS "appointments_update" ON appointments;
DROP POLICY IF EXISTS "appointments_delete" ON appointments;

-- ============================================
-- SELECT policies
-- ============================================

-- super_admin: acceso irrestricto
CREATE POLICY "appointments_select_super_admin"
  ON appointments FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'super_admin'
  );

-- admin: solo citas de su negocio
CREATE POLICY "appointments_select_admin"
  ON appointments FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'admin'
    AND business_id = get_user_business_id(auth.uid())
  );

-- professional: solo sus propias citas
CREATE POLICY "appointments_select_professional"
  ON appointments FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'professional'
    AND professional_id = auth.uid()
  );

-- client: solo citas donde es el cliente
CREATE POLICY "appointments_select_client"
  ON appointments FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'client'
    AND client_id = auth.uid()
  );

-- ============================================
-- INSERT policies
-- ============================================

-- super_admin: puede crear cualquier cita
CREATE POLICY "appointments_insert_super_admin"
  ON appointments FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) = 'super_admin'
  );

-- admin: puede crear citas dentro de su negocio
CREATE POLICY "appointments_insert_admin"
  ON appointments FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) = 'admin'
    AND business_id = get_user_business_id(auth.uid())
  );

-- professional: puede crear citas asignadas a sí mismo en su negocio
CREATE POLICY "appointments_insert_professional"
  ON appointments FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) = 'professional'
    AND professional_id = auth.uid()
    AND business_id = get_user_business_id(auth.uid())
  );

-- ============================================
-- UPDATE policies
-- ============================================

-- super_admin: puede actualizar cualquier cita
CREATE POLICY "appointments_update_super_admin"
  ON appointments FOR UPDATE
  USING (
    get_user_role(auth.uid()) = 'super_admin'
  );

-- admin: puede actualizar citas de su negocio (reasignar, cancelar, etc.)
CREATE POLICY "appointments_update_admin"
  ON appointments FOR UPDATE
  USING (
    get_user_role(auth.uid()) = 'admin'
    AND business_id = get_user_business_id(auth.uid())
  );

-- professional: solo puede actualizar estado de sus propias citas
CREATE POLICY "appointments_update_professional"
  ON appointments FOR UPDATE
  USING (
    get_user_role(auth.uid()) = 'professional'
    AND professional_id = auth.uid()
  );

-- ============================================
-- DELETE policies
-- ============================================

-- super_admin: puede eliminar cualquier cita
CREATE POLICY "appointments_delete_super_admin"
  ON appointments FOR DELETE
  USING (
    get_user_role(auth.uid()) = 'super_admin'
  );

-- admin: puede eliminar citas de su negocio
CREATE POLICY "appointments_delete_admin"
  ON appointments FOR DELETE
  USING (
    get_user_role(auth.uid()) = 'admin'
    AND business_id = get_user_business_id(auth.uid())
  );
