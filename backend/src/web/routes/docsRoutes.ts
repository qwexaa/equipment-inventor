import { Router } from 'express'
import { authMiddleware } from '../security/authMiddleware.js'
import { generateTransferAct } from '../controllers/docsController.js'

const router = Router()
router.use(authMiddleware)

router.post('/transfer', generateTransferAct)

export default router
