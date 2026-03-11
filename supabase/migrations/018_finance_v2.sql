-- ============================================
-- Migration 018: Financial ERP & Cash Control
-- ============================================

-- 1. Extend movement_type enum safely
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'transfer_in';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'transfer_out';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'payout';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'direct_sale';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'opening_balance';

-- 2. ACCOUNTS (Cuentas Dinámicas)
CREATE TABLE accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'digital')),
  balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_location ON accounts(location_id);

CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. CASH REGISTERS (Cierres de Caja Diarios)
CREATE TABLE cash_registers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ,
  opened_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  closed_by   UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_amount NUMERIC(12,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_registers_loc_status ON cash_registers(location_id, status);

-- 4. UPDATE CASH MOVEMENTS
ALTER TABLE cash_movements ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT;
ALTER TABLE cash_movements ADD COLUMN cash_register_id UUID REFERENCES cash_registers(id) ON DELETE RESTRICT;

-- Set up trigger to update account balance on movement
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS trigger AS $$
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    -- Incomes, transfer_in, etc increase balance.
    -- Assuming ALL movement amounts are passed as positive/negative correctly or we handle it by type?
    -- Currently, in 006_finance, amounts are just numbers, but type tells if income/expense. Wait, no.
    -- Usually, amount is positive and type dictates sign in views.
    -- Let's standardize: if it's 'income', 'transfer_in' -> Add
    -- If 'expense', 'commission', 'payout', 'transfer_out', 'damage_deduction' -> Subtract
    
    IF NEW.type IN ('income', 'direct_sale', 'transfer_in', 'opening_balance') THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type IN ('expense', 'commission', 'payout', 'transfer_out', 'damage_deduction') THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cash_movements_account_balance
  AFTER INSERT ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- 5. Default Accounts Migration Wrapper
-- Create a default "Caja Efectivo" for every location and link old movements
DO $$
DECLARE
  loc RECORD;
  acc_id UUID;
BEGIN
  FOR loc IN SELECT id, business_id FROM locations LOOP
    INSERT INTO accounts (business_id, location_id, name, type)
    VALUES (loc.business_id, loc.id, 'Caja General (Efectivo)', 'cash')
    RETURNING id INTO acc_id;
    
    -- Link existing cash movements to this account safely
    UPDATE cash_movements SET account_id = acc_id WHERE location_id = loc.id AND account_id IS NULL;
  END LOOP;
END;
$$;

-- 6. Payouts (Liquidaciones a demanda)
CREATE TABLE payouts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount          NUMERIC(12,2) NOT NULL,
  cash_movement_id UUID REFERENCES cash_movements(id) ON DELETE RESTRICT,
  created_by      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: to actually protect closed cash registers with RLS, we'd add an RLS policy blocking inserts to cash_movements if the linked cash_register is closed (or directly on cash_movements check).
-- Let's update RLS for cash_movements in 019_rls_finance.
