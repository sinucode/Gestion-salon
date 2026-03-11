-- ============================================
-- Migration 025: Appointment Checkout Transaction
-- ============================================

CREATE OR REPLACE FUNCTION checkout_appointment_tx(
  p_appointment_id UUID,
  p_approved_by UUID,
  p_cash_register_id UUID,
  p_account_id UUID,
  p_additional_products JSONB -- Array of { product_id, qty, price }
) RETURNS void AS $$
DECLARE
  v_business_id UUID;
  v_location_id UUID;
  v_professional_id UUID;
  v_client_id UUID;
  v_services_total NUMERIC;
  v_prods_total NUMERIC := 0;
  v_total_amount NUMERIC;
  v_commission_pct NUMERIC;
  v_commission_amount NUMERIC;
  v_record RECORD;
BEGIN
  -- 1. Gather Appointment Info
  SELECT business_id, location_id, professional_id, client_id, total_price
    INTO v_business_id, v_location_id, v_professional_id, v_client_id, v_services_total
    FROM appointments WHERE id = p_appointment_id;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Cita no encontrada o inválida.';
  END IF;

  -- 2. Validate Cash Register
  IF NOT EXISTS (SELECT 1 FROM cash_registers WHERE id = p_cash_register_id AND status = 'open') THEN
    RAISE EXCEPTION 'La caja seleccionada debe estar abierta.';
  END IF;

  -- 3. Update Appointment Status
  UPDATE appointments 
     SET status = 'approved', 
         approved_by = p_approved_by, 
         approved_at = now() 
   WHERE id = p_appointment_id;

  -- 4. Process Additional Products
  IF p_additional_products IS NOT NULL AND jsonb_array_length(p_additional_products) > 0 THEN
    FOR v_record IN SELECT * FROM jsonb_to_recordset(p_additional_products) AS x(product_id UUID, qty NUMERIC, price NUMERIC) LOOP
      -- Deduct stock
      UPDATE products SET stock_qty = stock_qty - v_record.qty WHERE id = v_record.product_id;
      
      -- Insert stock movement
      INSERT INTO stock_movements (product_id, business_id, location_id, appointment_id, type, qty, created_by)
      VALUES (v_record.product_id, v_business_id, v_location_id, p_appointment_id, 'consumption', v_record.qty, p_approved_by);
      
      v_prods_total := v_prods_total + (v_record.qty * v_record.price);
    END LOOP;
  END IF;

  v_total_amount := v_services_total + v_prods_total;

  -- 5. Calculate and Register Professional Commission (based on SERVICES ONLY)
  SELECT commission_pct INTO v_commission_pct FROM profiles WHERE id = v_professional_id;
  v_commission_amount := (v_services_total * COALESCE(v_commission_pct, 0)) / 100;

  -- Insert Commission movement (Accrual - No account_id if not paid immediately, but for consistency with existing payout logic
  -- we insert it without account_id so it reflects in their professional net_earnings but doesn't double-deduct from cash until payout).
  IF v_commission_amount > 0 THEN
    INSERT INTO cash_movements (
      business_id, location_id, professional_id, cash_register_id, 
      type, amount, description, created_by
    )
    VALUES (
      v_business_id, v_location_id, v_professional_id, p_cash_register_id, 
      'commission', v_commission_amount, 'Comisión por servicios: ' || p_appointment_id, p_approved_by
    );
  END IF;

  -- 6. Register Total Income in Ledger (Caja & Cuenta)
  INSERT INTO cash_movements (
    business_id, location_id, professional_id, account_id, cash_register_id, 
    type, amount, description, created_by
  )
  VALUES (
    v_business_id, v_location_id, v_professional_id, p_account_id, p_cash_register_id, 
    'income', v_total_amount, 'Cobro Cita + Upselling: ' || p_appointment_id, p_approved_by
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
