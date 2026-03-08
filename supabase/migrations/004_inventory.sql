-- ============================================
-- Migration 004: Inventory (Anti-fraud)
-- Products, Recipes, Stock Movements
-- ============================================

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id   UUID NOT NULL REFERENCES locations(id),
  name          TEXT NOT NULL,
  sku           TEXT,
  unit          TEXT NOT NULL DEFAULT 'ml',
  cost_per_unit NUMERIC(12,4) NOT NULL,
  stock_qty     NUMERIC(12,4) NOT NULL DEFAULT 0,
  min_stock     NUMERIC(12,4) NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_business ON products(business_id);
CREATE INDEX idx_products_location ON products(location_id);

CREATE TABLE service_recipes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id   UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty_consumed NUMERIC(12,4) NOT NULL,
  UNIQUE(service_id, product_id)
);

CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id),
  business_id     UUID NOT NULL REFERENCES businesses(id),
  location_id     UUID NOT NULL REFERENCES locations(id),
  appointment_id  UUID REFERENCES appointments(id),
  type            stock_movement_type NOT NULL,
  qty             NUMERIC(12,4) NOT NULL,
  cost_total      NUMERIC(12,2),
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_mov_product ON stock_movements(product_id);
CREATE INDEX idx_stock_mov_location ON stock_movements(location_id);

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
