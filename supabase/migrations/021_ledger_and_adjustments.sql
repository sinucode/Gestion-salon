-- ============================================
-- Migration 021: Ledger & Opening Adjustments
-- ============================================

-- 1. Add adjustment types to enum safely
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'adjustment_in';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'adjustment_out';

-- 2. Enhance cash_movements for auditability
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- 3. Update the balance trigger to handle adjustments
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS trigger AS $$
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    -- INCREASES: income, direct_sale, transfer_in, opening_balance, adjustment_in
    IF NEW.type IN ('income', 'direct_sale', 'transfer_in', 'opening_balance', 'adjustment_in') THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    -- DECREASES: expense, commission, payout, transfer_out, damage_deduction, adjustment_out
    ELSIF NEW.type IN ('expense', 'commission', 'payout', 'transfer_out', 'damage_deduction', 'adjustment_out') THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
