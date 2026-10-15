import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'src/constants/reportModels.ts'), 'utf8');
const names = [...source.matchAll(/value:\s*'([^']+)'/g)].map((match) => match[1].trim()).filter(Boolean);
const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b));
const values = unique.map((name) => `('${name.replace(/'/g, "''")}')`).join(',\n');

const sql = `-- Modelos administrables (mismo patrón que machine_types)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS machine_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_machine_models_updated_at ON machine_models;
CREATE TRIGGER update_machine_models_updated_at
    BEFORE UPDATE ON machine_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE IF EXISTS public.machine_models ENABLE ROW LEVEL SECURITY;

INSERT INTO machine_models (name)
VALUES
${values}
ON CONFLICT (name) DO NOTHING;
`;

fs.writeFileSync(path.join(root, 'backend/supabase/machine-models.sql'), sql);
console.log('models', unique.length);
