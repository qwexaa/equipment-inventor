import { Router } from 'express';
import { authMiddleware } from '../security/authMiddleware.js';
import { createEquipment, deleteEquipment, getEquipment, listEquipment, updateEquipment } from '../controllers/equipmentController.js';
import { requireRole } from '../security/roleMiddleware.js'

const router = Router();

router.use(authMiddleware);

router.get('/', listEquipment);
router.get('/:id', getEquipment);
router.post('/', requireRole('ADMIN','EDITOR'), createEquipment);
router.put('/:id', requireRole('ADMIN','EDITOR'), updateEquipment);
router.delete('/:id', requireRole('ADMIN'), deleteEquipment);

export default router;
