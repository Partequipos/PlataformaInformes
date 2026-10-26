-- Cliente o nombre de empresa del acta. Distinto de quien entrega o recibe.
ALTER TABLE equipment_acts ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);
