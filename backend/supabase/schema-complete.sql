-- =============================================================================
-- Plataforma Informes — esquema completo para Supabase Postgres
-- Idempotente. No inserta datos de seed (evita pisar migración).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    zone VARCHAR(100),
    brands TEXT[],
    specialty VARCHAR(255),
    rating DECIMAL(3,2) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
    contact VARCHAR(500),
    payment_method VARCHAR(255),
    cost_mtto_250h NUMERIC(14, 2),
    cost_mtto_500h NUMERIC(14, 2),
    cost_mtto_1000h NUMERIC(14, 2),
    cost_mtto_2000h NUMERIC(14, 2),
    cost_desplazamiento_km NUMERIC(14, 2),
    cost_hospedaje_dia NUMERIC(14, 2),
    cost_alimentacion_dia NUMERIC(14, 2),
    cost_hora_viaje_tecnico NUMERIC(14, 2),
    cost_valor_hora_mano_obra NUMERIC(14, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_name VARCHAR(255) NOT NULL,
    machine_type VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    hourmeter INTEGER NOT NULL,
    report_date DATE NOT NULL,
    ott VARCHAR(255),
    reason_of_service TEXT,
    conclusions TEXT,
    overall_suggestions TEXT,
    header_notes TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
    general_status VARCHAR(10) DEFAULT 'PENDING' CHECK (general_status IN ('PENDING', 'CLOSED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Components
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    findings TEXT NOT NULL,
    parameters TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('CORRECTED', 'PENDING')),
    suggestions TEXT,
    priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Photos
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    photo_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Videos
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    video_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suggested parts
CREATE TABLE IF NOT EXISTS suggested_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    part_number VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Catalog tables
CREATE TABLE IF NOT EXISTS machine_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS component_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model VARCHAR(100) NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    resource_url VARCHAR(500) NOT NULL,
    observation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parameter VARCHAR(255) NOT NULL,
    parameter_type VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    min_range NUMERIC NOT NULL,
    max_range NUMERIC NOT NULL,
    limit_range VARCHAR(100),
    resource_url VARCHAR(500) NOT NULL,
    observation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_components_report_id ON components(report_id);
CREATE INDEX IF NOT EXISTS idx_photos_component_id ON photos(component_id);
CREATE INDEX IF NOT EXISTS idx_videos_component_id ON videos(component_id);
CREATE INDEX IF NOT EXISTS idx_suggested_parts_report_id ON suggested_parts(report_id);
CREATE INDEX IF NOT EXISTS idx_users_zone ON users(zone);
CREATE INDEX IF NOT EXISTS idx_users_specialty ON users(specialty);
CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating);

-- updated_at helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_components_updated_at ON components;
CREATE TRIGGER update_components_updated_at
    BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suggested_parts_updated_at ON suggested_parts;
CREATE TRIGGER update_suggested_parts_updated_at
    BEFORE UPDATE ON suggested_parts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_machine_types_updated_at ON machine_types;
CREATE TRIGGER update_machine_types_updated_at
    BEFORE UPDATE ON machine_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_component_types_updated_at ON component_types;
CREATE TRIGGER update_component_types_updated_at
    BEFORE UPDATE ON component_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_resources_updated_at ON resources;
CREATE TRIGGER update_resources_updated_at
    BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_parameters_updated_at ON parameters;
CREATE TRIGGER update_parameters_updated_at
    BEFORE UPDATE ON parameters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: tablas public expuestas a PostgREST (lint rls_disabled_in_public).
-- Backend usa rol postgres (bypassa RLS). Sin políticas = sin acceso anon/authenticated.
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suggested_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.machine_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.component_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parameters ENABLE ROW LEVEL SECURITY;
