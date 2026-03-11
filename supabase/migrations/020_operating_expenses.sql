-- ============================================
-- Migration 020: Operating Expenses & P&L Fixes
-- ============================================

-- 1. Create Operating Expenses Table
CREATE TABLE operating_expenses (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id      UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
  category         TEXT NOT NULL CHECK (category IN ('Fijo', 'Variable')),
  amount           NUMERIC(12,2) NOT NULL,
  description      TEXT NOT NULL,
  cash_movement_id UUID REFERENCES cash_movements(id) ON DELETE RESTRICT,
  created_by       UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operating_expenses_loc ON operating_expenses(location_id);

-- 2. Setup RLS for Operating Expenses
ALTER TABLE operating_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY op_exp_super_admin ON operating_expenses
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY op_exp_admin ON operating_expenses
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.business_id = operating_expenses.business_id)
  );

-- 3. Replace the old P&L View with specialized financial cascading
DROP VIEW IF EXISTS v_pnl;

CREATE OR REPLACE VIEW v_pnl AS
WITH cash_agg AS (
  SELECT
    business_id,
    location_id,
    DATE(created_at AT TIME ZONE 'America/Bogota') AS date,
    SUM(CASE WHEN type IN ('income', 'direct_sale') THEN amount ELSE 0 END) AS gross_income,
    SUM(CASE WHEN type = 'commission' THEN ABS(amount) ELSE 0 END) AS commissions,
    SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END) AS operating_expenses,
    SUM(CASE WHEN type = 'damage_deduction' THEN ABS(amount) ELSE 0 END) AS damage_deductions
  FROM cash_movements
  GROUP BY business_id, location_id, DATE(created_at AT TIME ZONE 'America/Bogota')
),
stock_agg AS (
  SELECT
    sm.business_id,
    sm.location_id,
    DATE(sm.created_at AT TIME ZONE 'America/Bogota') AS date,
    SUM(ABS(sm.qty) * p.cost_per_unit) AS inventory_cost
  FROM stock_movements sm
  JOIN products p ON p.id = sm.product_id
  WHERE sm.type = 'consumption'
  GROUP BY sm.business_id, sm.location_id, DATE(sm.created_at AT TIME ZONE 'America/Bogota')
)
SELECT
  COALESCE(c.business_id, s.business_id) AS business_id,
  COALESCE(c.location_id, s.location_id) AS location_id,
  COALESCE(c.date, s.date) AS date,
  COALESCE(c.gross_income, 0) AS gross_income,
  COALESCE(s.inventory_cost, 0) AS inventory_cost,
  COALESCE(c.commissions, 0) AS commissions,
  COALESCE(c.operating_expenses, 0) AS operating_expenses,
  (COALESCE(s.inventory_cost, 0) + COALESCE(c.commissions, 0)) AS cost_of_sales,
  (COALESCE(c.gross_income, 0) - (COALESCE(s.inventory_cost, 0) + COALESCE(c.commissions, 0))) AS gross_profit,
  ((COALESCE(c.gross_income, 0) - (COALESCE(s.inventory_cost, 0) + COALESCE(c.commissions, 0))) - COALESCE(c.operating_expenses, 0)) AS net_operating_profit
FROM cash_agg c
FULL OUTER JOIN stock_agg s 
  ON c.business_id = s.business_id 
 AND c.location_id = s.location_id 
 AND c.date = s.date;
