import { Router } from 'express'
import { authMiddleware } from '../security/authMiddleware.js'
import { statsController } from '../controllers/statsController.js'

const router = Router()

router.use(authMiddleware)

router.get('/', statsController)

export default router
