-- ============================================
-- Migration 001: Core Tables
-- Businesses, Locations, Profiles, Client Invites
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUM Types
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'professional', 'client');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'in_progress', 'completed', 'approved', 'cancelled', 'no_show');
CREATE TYPE damage_resolution AS ENUM ('pending', 'deduct_professional', 'absorb_location', 'paid_cash');
CREATE TYPE movement_type AS ENUM ('income', 'expense', 'commission', 'damage_deduction', 'damage_absorb');
CREATE TYPE stock_movement_type AS ENUM ('purchase', 'consumption', 'adjustment', 'damage', 'return');

-- Timezone helper
CREATE OR REPLACE FUNCTION now_bogota()
RETURNS timestamptz AS $$
  SELECT now() AT TIME ZONE 'America/Bogota';
$$ LANGUAGE sql STABLE;

-- ============================================
-- BUSINESSES (Tenants)
-- ============================================
CREATE TABLE businesses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  nit         TEXT,
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- LOCATIONS (Sedes)
-- ============================================
CREATE TABLE locations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  address      TEXT,
  phone        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_locations_business ON locations(business_id);

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id     UUID REFERENCES businesses(id) ON DELETE SET NULL,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  role            user_role NOT NULL DEFAULT 'client',
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  phone           TEXT,
  document_id     TEXT,
  avatar_url      TEXT,
  commission_pct  NUMERIC(5,2) DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_business ON profiles(business_id);
CREATE INDEX idx_profiles_location ON profiles(location_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================
-- CLIENT INVITE TOKENS
-- ============================================
CREATE TABLE client_invites (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id),
  location_id  UUID NOT NULL REFERENCES locations(id),
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  client_name  TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '72 hours'),
  used_at      TIMESTAMPTZ,
  created_by   UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invites_token ON client_invites(token);

-- ============================================
-- Auto-create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_app_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
