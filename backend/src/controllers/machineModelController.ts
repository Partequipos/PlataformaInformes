import { Request, Response } from 'express';
import {
  getAllMachineModels,
  getMachineModelById,
  createMachineModel,
  updateMachineModel,
  deleteMachineModel,
} from '../models/machineModel';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';

export const listMachineModels = async (_req: Request, res: Response): Promise<void> => {
  try {
    const models = await getAllMachineModels();
    res.json({ success: true, data: models });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching models' });
  }
};

export const getMachineModel = async (req: Request, res: Response): Promise<void> => {
  try {
    const model = await getMachineModelById(req.params.id);
    if (!model) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, data: model });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching model' });
  }
};

export const createMachineModelHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    const model = await createMachineModel(String(name), description);
    res.status(201).json({ success: true, data: model });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ success: false, error: 'A model with that name already exists' });
      return;
    }
    res.status(500).json({ success: false, error: 'Error creating model' });
  }
};

export const updateMachineModelHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    const model = await updateMachineModel(req.params.id, String(name), description);
    if (!model) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, data: model });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ success: false, error: 'A model with that name already exists' });
      return;
    }
    res.status(500).json({ success: false, error: 'Error updating model' });
  }
};

export const deleteMachineModelHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await deleteMachineModel(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error deleting model' });
  }
};
