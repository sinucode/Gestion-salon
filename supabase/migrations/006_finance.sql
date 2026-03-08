-- ============================================
-- Migration 006: Finance
-- Cash Movements & P&L View
-- ============================================

CREATE TABLE cash_movements (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id),
  location_id      UUID NOT NULL REFERENCES locations(id),
  appointment_id   UUID REFERENCES appointments(id),
  damage_report_id UUID REFERENCES damage_reports(id),
  professional_id  UUID REFERENCES profiles(id),
  type             movement_type NOT NULL,
  amount           NUMERIC(12,2) NOT NULL,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_business ON cash_movements(business_id);
CREATE INDEX idx_cash_location ON cash_movements(location_id);
CREATE INDEX idx_cash_date ON cash_movements(created_at);
CREATE INDEX idx_cash_professional ON cash_movements(professional_id);

-- P&L Aggregation View
CREATE OR REPLACE VIEW v_pnl AS
SELECT
  cm.business_id,
  cm.location_id,
  DATE(cm.created_at AT TIME ZONE 'America/Bogota') AS date,
  SUM(CASE WHEN cm.type = 'income' THEN cm.amount ELSE 0 END) AS gross_income,
  SUM(CASE WHEN cm.type = 'expense' THEN ABS(cm.amount) ELSE 0 END) AS inventory_cost,
  SUM(CASE WHEN cm.type = 'commission' THEN ABS(cm.amount) ELSE 0 END) AS commissions,
  SUM(CASE WHEN cm.type = 'damage_deduction' THEN ABS(cm.amount) ELSE 0 END) AS damage_deductions,
  SUM(CASE WHEN cm.type = 'damage_absorb' THEN ABS(cm.amount) ELSE 0 END) AS damage_absorbed,
  SUM(CASE WHEN cm.type = 'income' THEN cm.amount ELSE 0 END)
    - SUM(CASE WHEN cm.type IN ('expense','commission','damage_deduction','damage_absorb')
          THEN ABS(cm.amount) ELSE 0 END) AS net_profit
FROM cash_movements cm
GROUP BY cm.business_id, cm.location_id, DATE(cm.created_at AT TIME ZONE 'America/Bogota');

-- Professional Earnings View
CREATE OR REPLACE VIEW v_professional_earnings AS
SELECT
  cm.professional_id,
  cm.business_id,
  cm.location_id,
  DATE(cm.created_at AT TIME ZONE 'America/Bogota') AS date,
  SUM(CASE WHEN cm.type = 'income' THEN cm.amount ELSE 0 END) AS gross_income,
  SUM(CASE WHEN cm.type = 'commission' THEN ABS(cm.amount) ELSE 0 END) AS commission_earned,
  SUM(CASE WHEN cm.type = 'damage_deduction' THEN ABS(cm.amount) ELSE 0 END) AS damage_deducted,
  SUM(CASE WHEN cm.type = 'commission' THEN ABS(cm.amount) ELSE 0 END)
    - SUM(CASE WHEN cm.type = 'damage_deduction' THEN ABS(cm.amount) ELSE 0 END) AS net_earnings
FROM cash_movements cm
WHERE cm.professional_id IS NOT NULL
GROUP BY cm.professional_id, cm.business_id, cm.location_id,
         DATE(cm.created_at AT TIME ZONE 'America/Bogota');
