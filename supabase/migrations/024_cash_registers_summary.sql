-- ============================================
-- Migration 024: Cash Registers Summary View
-- ============================================

DROP VIEW IF EXISTS v_cash_registers_summary;

CREATE VIEW v_cash_registers_summary WITH (security_invoker = true) AS
SELECT 
    cr.id,
    cr.business_id,
    cr.location_id,
    cr.opened_by,
    cr.closed_by,
    cr.opened_at,
    cr.closed_at,
    cr.status,
    cr.base_amount,
    cr.final_amount,
    cr.notes,
    po.first_name AS opener_first_name,
    po.last_name AS opener_last_name,
    pc.first_name AS closer_first_name,
    pc.last_name AS closer_last_name,
    COALESCE(SUM(cm.amount) FILTER (WHERE cm.type IN ('income', 'direct_sale', 'transfer_in', 'opening_balance', 'adjustment_in')), 0) AS total_incomes,
    COALESCE(SUM(cm.amount) FILTER (WHERE cm.type IN ('expense', 'commission', 'payout', 'transfer_out', 'damage_deduction', 'adjustment_out')), 0) AS total_outcomes,
    (cr.base_amount + 
     COALESCE(SUM(cm.amount) FILTER (WHERE cm.type IN ('income', 'direct_sale', 'transfer_in', 'opening_balance', 'adjustment_in')), 0) - 
     COALESCE(SUM(cm.amount) FILTER (WHERE cm.type IN ('expense', 'commission', 'payout', 'transfer_out', 'damage_deduction', 'adjustment_out')), 0)
    ) AS net_cash
FROM cash_registers cr
LEFT JOIN profiles po ON cr.opened_by = po.id
LEFT JOIN profiles pc ON cr.closed_by = pc.id
LEFT JOIN cash_movements cm ON cr.id = cm.cash_register_id
GROUP BY cr.id, po.id, pc.id;
