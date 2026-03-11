-- ============================================
-- Migration 019: RLS & Security for Finance ERP
-- ============================================

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- 1. ACCOUNTS RLS
CREATE POLICY "super_admin_accounts" ON accounts
  FOR ALL USING (auth_role() = 'super_admin');

CREATE POLICY "admin_accounts" ON accounts
  FOR ALL USING (
    auth_role() = 'admin' AND business_id = auth_business_id()
  );

CREATE POLICY "professional_read_accounts" ON accounts
  FOR SELECT USING (
    auth_role() = 'professional' AND location_id = auth_location_id()
  );

-- 2. CASH REGISTERS RLS
CREATE POLICY "super_admin_cash_registers" ON cash_registers
  FOR ALL USING (auth_role() = 'super_admin');

CREATE POLICY "admin_cash_registers" ON cash_registers
  FOR ALL USING (
    auth_role() = 'admin' AND business_id = auth_business_id()
  );

CREATE POLICY "professional_read_cash_registers" ON cash_registers
  FOR SELECT USING (
    auth_role() = 'professional' AND location_id = auth_location_id()
  );

-- 3. PAYOUTS RLS
CREATE POLICY "super_admin_payouts" ON payouts
  FOR ALL USING (auth_role() = 'super_admin');

CREATE POLICY "admin_payouts" ON payouts
  FOR ALL USING (
    auth_role() = 'admin' AND business_id = auth_business_id()
  );

CREATE POLICY "professional_read_own_payouts" ON payouts
  FOR SELECT USING (
    auth_role() = 'professional' AND professional_id = auth.uid()
  );

-- 4. BLOCK CASH MOVEMENTS FOR CLOSED REGISTERS
-- If a cash_register_id is specified, we check if it is open (or super_admin overrides).
-- Since policies on cash_movements already exist, we can add a BEFORE INSERT/UPDATE trigger
-- to enforce the business rule strictly rather than RLS, which is easier and safer to prevent cheating.

CREATE OR REPLACE FUNCTION block_cash_movement_if_closed()
RETURNS trigger AS $$
DECLARE
  register_status TEXT;
  user_role TEXT;
BEGIN
  IF NEW.cash_register_id IS NOT NULL THEN
    SELECT status INTO register_status FROM cash_registers WHERE id = NEW.cash_register_id;
    SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
    
    IF register_status = 'closed' AND user_role != 'super_admin' THEN
      RAISE EXCEPTION 'No se pueden añadir movimientos financieros a un cierre de caja completado (closed). Contacte un super administrador.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cash_movements_closed_register
  BEFORE INSERT OR UPDATE ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION block_cash_movement_if_closed();

-- 5. CUADRE Y SUMA CERO (Transferencias entre cuentas)
CREATE TABLE account_transfers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description     TEXT,
  cash_register_id UUID REFERENCES cash_registers(id) ON DELETE RESTRICT,
  created_by      UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_transfers" ON account_transfers FOR ALL USING (auth_role() = 'super_admin');
CREATE POLICY "admin_transfers" ON account_transfers FOR ALL USING (auth_role() = 'admin' AND business_id = auth_business_id());

-- Un trigger que mueva de cash_movements la entrada y la salida automáticamente o usamos un SP:
-- Mejor es usar un Stored Procedure de base de datos para garantizar Suma Cero.
CREATE OR REPLACE FUNCTION transfer_funds(
  p_from_acc UUID,
  p_to_acc UUID,
  p_amount NUMERIC(12,2),
  p_desc TEXT,
  p_user UUID,
  p_busi UUID,
  p_loc UUID,
  p_reg UUID
) RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
  v_from_bal NUMERIC;
BEGIN
  -- Validar fondos suficientes
  SELECT balance INTO v_from_bal FROM accounts WHERE id = p_from_acc;
  IF v_from_bal < p_amount THEN
    RAISE EXCEPTION 'Fondos insuficientes en la cuenta origen.';
  END IF;

  -- 1. Crear el registro en account_transfers
  INSERT INTO account_transfers (business_id, location_id, from_account_id, to_account_id, amount, description, cash_register_id, created_by)
  VALUES (p_busi, p_loc, p_from_acc, p_to_acc, p_amount, p_desc, p_reg, p_user)
  RETURNING id INTO v_transfer_id;

  -- 2. Movimiento Salida (Transfer Out)
  INSERT INTO cash_movements (business_id, location_id, account_id, cash_register_id, professional_id, type, amount, description)
  VALUES (p_busi, p_loc, p_from_acc, p_reg, p_user, 'transfer_out', p_amount, 'Transferencia Salida: ' || p_desc);

  -- 3. Movimiento Entrada (Transfer In)
  INSERT INTO cash_movements (business_id, location_id, account_id, cash_register_id, professional_id, type, amount, description)
  VALUES (p_busi, p_loc, p_to_acc, p_reg, p_user, 'transfer_in', p_amount, 'Transferencia Entrada: ' || p_desc);

  -- Las actualizaciones de balance se manejan automáticamente por el trigger de accounts (trg_cash_movements_account_balance).

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
