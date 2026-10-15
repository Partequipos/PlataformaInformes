import pool from '../config/database';

export interface MachineModel {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const getAllMachineModels = async (): Promise<MachineModel[]> => {
  const result = await pool.query('SELECT * FROM machine_models ORDER BY name ASC');
  return result.rows;
};

export const getMachineModelById = async (id: string): Promise<MachineModel | null> => {
  const result = await pool.query('SELECT * FROM machine_models WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const createMachineModel = async (name: string, description?: string): Promise<MachineModel> => {
  const result = await pool.query(
    'INSERT INTO machine_models (name, description) VALUES ($1, $2) RETURNING *',
    [name.trim(), description?.trim() || null]
  );
  return result.rows[0];
};

export const updateMachineModel = async (
  id: string,
  name: string,
  description?: string
): Promise<MachineModel | null> => {
  const result = await pool.query(
    'UPDATE machine_models SET name = $1, description = $2 WHERE id = $3 RETURNING *',
    [name.trim(), description?.trim() || null, id]
  );
  return result.rows[0] || null;
};

export const deleteMachineModel = async (id: string): Promise<boolean> => {
  const result = await pool.query('DELETE FROM machine_models WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
