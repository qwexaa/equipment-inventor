import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware } from '../security/authMiddleware.js';
import { importEquipment, exportEquipment, exportReport } from '../controllers/importExportController.js';
import { requireRole } from '../security/roleMiddleware.js'

const upload = multer({ dest: process.env.UPLOAD_DIR || './tmp' });
const router = Router();

router.use(authMiddleware);

router.post('/import', requireRole('ADMIN','EDITOR'), upload.single('file'), importEquipment);
router.get('/export', exportEquipment);
router.get('/report', exportReport);

export default router;
