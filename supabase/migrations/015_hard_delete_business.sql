-- ============================================
-- Migration 015: Hard Delete Business Function
-- ============================================
-- Deletes a business and ALL related data permanently.
-- Must be called via RPC as super_admin only.

CREATE OR REPLACE FUNCTION hard_delete_business(business_uuid UUID)
RETURNS void AS $$
BEGIN
    -- 1. Delete appointment_services (via appointments of this business)
    DELETE FROM appointment_services
    WHERE appointment_id IN (
        SELECT id FROM appointments WHERE business_id = business_uuid
    );

    -- 2. Delete appointments
    DELETE FROM appointments WHERE business_id = business_uuid;

    -- 3. Delete cash_movements
    DELETE FROM cash_movements WHERE business_id = business_uuid;

    -- 4. Delete damage_reports
    DELETE FROM damage_reports WHERE business_id = business_uuid;

    -- 5. Delete stock_movements (via products of this business)
    DELETE FROM stock_movements
    WHERE product_id IN (
        SELECT id FROM products WHERE business_id = business_uuid
    );

    -- 6. Delete products (inventory)
    DELETE FROM products WHERE business_id = business_uuid;

    -- 7. Delete client_invites
    DELETE FROM client_invites WHERE business_id = business_uuid;

    -- 8. Delete audit_log entries (temporarily disable immutable trigger)
    ALTER TABLE audit_log DISABLE TRIGGER trg_audit_immutable;
    DELETE FROM audit_log WHERE business_id = business_uuid;
    ALTER TABLE audit_log ENABLE TRIGGER trg_audit_immutable;

    -- 9. Unlink profiles from this business (don't delete the auth user)
    UPDATE profiles SET business_id = NULL, location_id = NULL
    WHERE business_id = business_uuid;

    -- 10. Delete the business itself (CASCADE handles: locations, categories, services, service_products, feature_flags)
    DELETE FROM businesses WHERE id = business_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
