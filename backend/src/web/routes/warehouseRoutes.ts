import { Router } from 'express'
import { create, list, remove, update, transferToInventory, importWarehouse, listMovements } from '../controllers/warehouseController.js'
import { authMiddleware } from '../security/authMiddleware.js'
import { requireRole } from '../security/roleMiddleware.js'
import multer from 'multer'

const upload = multer({ dest: process.env.UPLOAD_DIR || './tmp' })

const router = Router()

// RBAC: чтение всем авторизованным, создание/редактирование EDITOR|ADMIN, удаление ADMIN
router.get('/', authMiddleware, list)
router.post('/', authMiddleware, requireRole('ADMIN','EDITOR'), create)
router.put('/:id', authMiddleware, requireRole('ADMIN','EDITOR'), update)
router.delete('/:id', authMiddleware, requireRole('ADMIN'), remove)
router.post('/:id/transfer', authMiddleware, requireRole('ADMIN','EDITOR'), transferToInventory)
router.post('/import', authMiddleware, requireRole('ADMIN','EDITOR'), upload.single('file'), importWarehouse)
router.get('/movements', authMiddleware, requireRole('ADMIN','EDITOR'), listMovements)

export default router
