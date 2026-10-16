-- Capacidad de carga pasa a horómetro numérico en todas las actas.
ALTER TABLE equipment_acts ADD COLUMN IF NOT EXISTS hourmeter NUMERIC;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'equipment_acts'
      AND column_name = 'load_capacity'
  ) THEN
    UPDATE equipment_acts
    SET hourmeter = NULLIF(regexp_replace(load_capacity, '[^0-9.]', '', 'g'), '')::numeric
    WHERE hourmeter IS NULL
      AND load_capacity IS NOT NULL
      AND regexp_replace(load_capacity, '[^0-9.]', '', 'g') ~ '^[0-9]+(\.[0-9]+)?$';

    ALTER TABLE equipment_acts DROP COLUMN load_capacity;
  END IF;
END $$;
