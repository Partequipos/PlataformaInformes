import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  listMachineModels,
  getMachineModel,
  createMachineModelHandler,
  updateMachineModelHandler,
  deleteMachineModelHandler,
} from '../controllers/machineModelController';

const router = Router();

router.get('/', listMachineModels);
router.get('/:id', getMachineModel);
router.post('/', authenticateToken, requireRole(['admin']), createMachineModelHandler);
router.put('/:id', authenticateToken, requireRole(['admin']), updateMachineModelHandler);
router.delete('/:id', authenticateToken, requireRole(['admin']), deleteMachineModelHandler);

export default router;
