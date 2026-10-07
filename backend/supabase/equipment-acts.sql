-- Actas de entrada / salida de equipos (personal interno: admin, user)
-- Idempotente. RLS habilitado (acceso vía backend postgres).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS equipment_acts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    act_type VARCHAR(20) NOT NULL CHECK (act_type IN ('entry', 'exit')),
    location VARCHAR(255) NOT NULL,
    act_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),

    -- I. Identificación del equipo
    equipment_type VARCHAR(255),
    brand VARCHAR(255),
    line_series VARCHAR(255),
    model_type VARCHAR(255),
    pin_serial VARCHAR(255),
    engine_number VARCHAR(255),
    internal_code VARCHAR(255),
    manufacture_date VARCHAR(50),
    load_capacity VARCHAR(100),
    gps_serial VARCHAR(255),
    gps_install_date VARCHAR(50),

    -- II. Motivo / trabajos
    motive TEXT,
    works TEXT,

    -- III. Estado del equipo
    mechanical_state TEXT,
    lubrication TEXT,
    operation_test TEXT,

    -- V. Firmas
    deliverer_name VARCHAR(255),
    deliverer_cc VARCHAR(100),
    deliverer_signature TEXT,
    receiver_name VARCHAR(255),
    receiver_cc VARCHAR(100),
    receiver_signature TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment_act_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    act_id UUID NOT NULL REFERENCES equipment_acts(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    photo_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment_act_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    act_id UUID NOT NULL REFERENCES equipment_acts(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    video_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipment_act_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    act_id UUID NOT NULL REFERENCES equipment_acts(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    source VARCHAR(50) DEFAULT 'upload',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_acts_user_id ON equipment_acts(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_acts_act_type ON equipment_acts(act_type);
CREATE INDEX IF NOT EXISTS idx_equipment_acts_created_at ON equipment_acts(created_at);
CREATE INDEX IF NOT EXISTS idx_equipment_act_photos_act_id ON equipment_act_photos(act_id);
CREATE INDEX IF NOT EXISTS idx_equipment_act_videos_act_id ON equipment_act_videos(act_id);
CREATE INDEX IF NOT EXISTS idx_equipment_act_attachments_act_id ON equipment_act_attachments(act_id);

DROP TRIGGER IF EXISTS update_equipment_acts_updated_at ON equipment_acts;
CREATE TRIGGER update_equipment_acts_updated_at
    BEFORE UPDATE ON equipment_acts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE IF EXISTS public.equipment_acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.equipment_act_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.equipment_act_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.equipment_act_attachments ENABLE ROW LEVEL SECURITY;
