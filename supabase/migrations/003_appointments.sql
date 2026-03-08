-- ============================================
-- Migration 003: Appointments & Walk-ins
-- ============================================

CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id),
  location_id      UUID NOT NULL REFERENCES locations(id),
  professional_id  UUID NOT NULL REFERENCES profiles(id),
  client_id        UUID REFERENCES profiles(id),
  walk_in_name     TEXT,
  is_walk_in       BOOLEAN NOT NULL DEFAULT false,
  status           appointment_status NOT NULL DEFAULT 'scheduled',
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  total_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  approved_by      UUID REFERENCES profiles(id),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appt_business ON appointments(business_id);
CREATE INDEX idx_appt_location ON appointments(location_id);
CREATE INDEX idx_appt_professional ON appointments(professional_id);
CREATE INDEX idx_appt_status ON appointments(status);
CREATE INDEX idx_appt_starts ON appointments(starts_at);

CREATE TABLE appointment_services (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES services(id),
  price           NUMERIC(12,2) NOT NULL,
  duration_min    INT NOT NULL
);

CREATE TABLE appointment_addons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  addon_id        UUID NOT NULL REFERENCES service_addons(id),
  price           NUMERIC(12,2) NOT NULL,
  duration_min    INT NOT NULL
);

-- Colombian Holidays
CREATE TABLE holidays_co (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date  DATE NOT NULL UNIQUE,
  name  TEXT NOT NULL
);

-- Seed some 2025-2026 Colombian holidays
INSERT INTO holidays_co (date, name) VALUES
  ('2025-01-01', 'Año Nuevo'),
  ('2025-01-06', 'Día de los Reyes Magos'),
  ('2025-03-24', 'Día de San José'),
  ('2025-04-17', 'Jueves Santo'),
  ('2025-04-18', 'Viernes Santo'),
  ('2025-05-01', 'Día del Trabajo'),
  ('2025-06-02', 'Ascensión del Señor'),
  ('2025-06-23', 'Corpus Christi'),
  ('2025-06-30', 'Sagrado Corazón de Jesús'),
  ('2025-06-30', 'San Pedro y San Pablo'),
  ('2025-07-20', 'Día de la Independencia'),
  ('2025-08-07', 'Batalla de Boyacá'),
  ('2025-08-18', 'Asunción de la Virgen'),
  ('2025-10-13', 'Día de la Raza'),
  ('2025-11-03', 'Todos los Santos'),
  ('2025-11-17', 'Independencia de Cartagena'),
  ('2025-12-08', 'Día de la Inmaculada Concepción'),
  ('2025-12-25', 'Navidad'),
  ('2026-01-01', 'Año Nuevo'),
  ('2026-01-12', 'Día de los Reyes Magos'),
  ('2026-03-23', 'Día de San José'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-05-18', 'Ascensión del Señor'),
  ('2026-06-08', 'Corpus Christi'),
  ('2026-06-15', 'Sagrado Corazón de Jesús'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-20', 'Día de la Independencia'),
  ('2026-08-07', 'Batalla de Boyacá'),
  ('2026-08-17', 'Asunción de la Virgen'),
  ('2026-10-12', 'Día de la Raza'),
  ('2026-11-02', 'Todos los Santos'),
  ('2026-11-16', 'Independencia de Cartagena'),
  ('2026-12-08', 'Día de la Inmaculada Concepción'),
  ('2026-12-25', 'Navidad')
ON CONFLICT (date) DO NOTHING;

CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
