-- ============================================
-- Migration 016: Strict Profile RLS
-- ============================================

-- 1. Drop existing policies on profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

-- 2. CREATE NEW POLICIES WITH STRICT LATERAL BLOCK

-- SELECT: Who can see whom?
CREATE POLICY "profiles_select_strict" ON profiles FOR SELECT USING (
  -- Rule 1: super_admin has absolute access
  auth_role() = 'super_admin'
  -- Rule 2: admin can see themselves AND professionals/clients in same business (BUT NOT other admins)
  OR (
    auth_role() = 'admin' 
    AND business_id = auth_business_id()
    AND (id = auth.uid() OR role IN ('professional', 'client'))
  )
  -- Rule 3: professional can see themselves AND clients in same business (BUT NOT other professionals or admins)
  OR (
    auth_role() = 'professional'
    AND business_id = auth_business_id()
    AND (id = auth.uid() OR role = 'client')
  )
  -- Rule 4: client can only see themselves
  OR (
    id = auth.uid()
  )
);

-- INSERT: Who can create whom?
-- (Hierarchy rank is also enforced by trigger trg_enforce_role_hierarchy in migration 010)
CREATE POLICY "profiles_insert_strict" ON profiles FOR INSERT WITH CHECK (
  auth_role() = 'super_admin'
  OR (
    auth_role() IN ('admin', 'professional') 
    AND business_id = auth_business_id()
  )
);

-- UPDATE: Who can edit whom?
CREATE POLICY "profiles_update_strict" ON profiles FOR UPDATE USING (
  -- Rule 1: super_admin absolute
  auth_role() = 'super_admin'
  -- Rule 2: admin can edit themselves OR professionals/clients in same business
  OR (
    auth_role() = 'admin'
    AND business_id = auth_business_id()
    AND (id = auth.uid() OR role IN ('professional', 'client'))
  )
  -- Rule 3: professional can edit themselves OR clients in same business
  OR (
    auth_role() = 'professional'
    AND business_id = auth_business_id()
    AND (id = auth.uid() OR role = 'client')
  )
  -- Rule 4: client only self
  OR (
    id = auth.uid()
  )
) WITH CHECK (
  -- Same rules for checking valid new state
  auth_role() = 'super_admin'
  OR (
    auth_role() = 'admin'
    AND business_id = auth_business_id()
    AND (id = auth.uid() OR role IN ('professional', 'client'))
  )
  OR (
    auth_role() = 'professional'
    AND business_id = auth_business_id()
    AND (id = auth.uid() OR role = 'client')
  )
  OR (
    id = auth.uid()
  )
);

-- DELETE: Who can remove whom?
CREATE POLICY "profiles_delete_strict" ON profiles FOR DELETE USING (
  auth_role() = 'super_admin'
  OR (
    auth_role() = 'admin'
    AND business_id = auth_business_id()
    AND role IN ('professional', 'client')
  )
);
