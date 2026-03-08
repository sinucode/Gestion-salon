-- ============================================
-- Migration 005: Damages / Novelties
-- ============================================

CREATE TABLE damage_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id),
  location_id      UUID NOT NULL REFERENCES locations(id),
  product_id       UUID NOT NULL REFERENCES products(id),
  professional_id  UUID NOT NULL REFERENCES profiles(id),
  qty_damaged      NUMERIC(12,4) NOT NULL,
  cost_total       NUMERIC(12,2) NOT NULL,
  reason           TEXT,
  resolution       damage_resolution NOT NULL DEFAULT 'pending',
  resolved_by      UUID REFERENCES profiles(id),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_damage_business ON damage_reports(business_id);
CREATE INDEX idx_damage_professional ON damage_reports(professional_id);

CREATE TRIGGER trg_damage_reports_updated_at BEFORE UPDATE ON damage_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
