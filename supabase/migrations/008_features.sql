-- ============================================
-- Migration 008: Feature Flags
-- ============================================

CREATE TABLE feature_flags (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id  UUID REFERENCES locations(id),
  flag_key     TEXT NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT false,
  updated_by   UUID REFERENCES profiles(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::UUID), flag_key)
);
CREATE INDEX idx_ff_business ON feature_flags(business_id);
CREATE INDEX idx_ff_key ON feature_flags(flag_key);
