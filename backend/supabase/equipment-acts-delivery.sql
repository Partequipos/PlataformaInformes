-- Permite Acta de entrega y guarda la inspección como JSON.
ALTER TABLE equipment_acts DROP CONSTRAINT IF EXISTS equipment_acts_act_type_check;
ALTER TABLE equipment_acts
  ADD CONSTRAINT equipment_acts_act_type_check
  CHECK (act_type IN ('entry', 'exit', 'delivery'));

ALTER TABLE equipment_acts
  ADD COLUMN IF NOT EXISTS inspection JSONB DEFAULT '{}'::jsonb;
